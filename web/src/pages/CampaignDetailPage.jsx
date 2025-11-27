import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCampaign, fetchCampaignLeads, uploadCampaignLeadsCsv, blastCampaign } from '@/lib/campaignClient';
import { useTwilioStatus } from '@/contexts/TwilioStatusContext.jsx';
import { fetchVoicemailAudios, attachVoicemailToCampaign } from '@/lib/voicemailClient.js';
import { formatDateTime, formatPhone } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

function getStatusBadge(status) {
  if (!status) return <Badge variant="outline">Unknown</Badge>;
  const statusLower = status.toLowerCase();
  if (statusLower.includes('machine') || statusLower === 'amd-machine') {
    return <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20">Machine</Badge>;
  }
  if (statusLower.includes('human') || statusLower === 'amd-human') {
    return <Badge className="bg-yellow-500/10 text-yellow-300 border-yellow-500/20">Human</Badge>;
  }
  if (statusLower.includes('no-answer') || statusLower === 'no-answer') {
    return <Badge className="bg-gray-500/10 text-gray-300 border-gray-500/20">No Answer</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const campaignId = parseInt(id, 10);
  const { loading: twilioLoading, hasConfig: twilioConnected } = useTwilioStatus();

  const [campaign, setCampaign] = useState(null);
  const [leads, setLeads] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [blasting, setBlasting] = useState(false);
  const [voicemailAudios, setVoicemailAudios] = useState([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [selectedAudioId, setSelectedAudioId] = useState(null);
  const [savingAudio, setSavingAudio] = useState(false);

  const selectedAudio = useMemo(
    () => {
      if (!selectedAudioId || !Array.isArray(voicemailAudios)) return null;
      return voicemailAudios.find(a => a.id === selectedAudioId) || null;
    },
    [voicemailAudios, selectedAudioId]
  );

  useEffect(() => {
    if (!campaignId || Number.isNaN(campaignId)) {
      setError('Invalid campaign id');
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const [campaignData, leadsData, logsRes] = await Promise.all([
          fetchCampaign(campaignId),
          fetchCampaignLeads(campaignId),
          fetch(`/call-logs?campaignId=${campaignId}`, {
            method: 'GET',
            credentials: 'include',
          }).then((r) => {
            if (!r.ok) throw new Error(`Failed to load call logs: ${r.status}`);
            return r.json();
          }),
        ]);

        if (!isMounted) return;
        setCampaign(campaignData);
        setLeads(leadsData);
        setCallLogs(logsRes.logs || []);
        setError(null);
      } catch (err) {
        console.error('Error loading campaign detail:', err);
        if (!isMounted) return;
        setError('Failed to load campaign data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [campaignId]);

  // Load voicemail audios
  useEffect(() => {
    const loadAudios = async () => {
      try {
        setAudioLoading(true);
        const list = await fetchVoicemailAudios();
        setVoicemailAudios(list);
        if (campaign && campaign.voicemailAudioId) {
          setSelectedAudioId(campaign.voicemailAudioId);
        }
      } catch (err) {
        console.error('Error loading campaign audios:', err);
      } finally {
        setAudioLoading(false);
      }
    };
    loadAudios();
  }, [campaign]);

  async function handleSaveCampaignAudio() {
    if (!campaign || !selectedAudioId) {
      return;
    }

    try {
      setSavingAudio(true);
      const updated = await attachVoicemailToCampaign(campaign.id, selectedAudioId);
      // Reload campaign to get updated voicemailAudioId
      const campaignData = await fetchCampaign(campaign.id);
      setCampaign(campaignData);
    } catch (err) {
      console.error('Error attaching voicemail:', err);
      alert(err.message || 'Failed to attach voicemail audio');
    } finally {
      setSavingAudio(false);
    }
  }

  async function handleUploadCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const text = await file.text();
      await uploadCampaignLeadsCsv(campaignId, text);

      const leadsData = await fetchCampaignLeads(campaignId);
      setLeads(leadsData);
      setError(null);
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError(err.message || 'Failed to upload CSV');
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected if needed
      e.target.value = '';
    }
  }

  async function handleBlast() {
    if (twilioLoading) {
      // Block while status is loading
      return;
    }

    if (!twilioConnected) {
      // Guide user to settings
      alert('Twilio not connected. Connect your Twilio account in Settings → Twilio before blasting.');
      navigate('/app/settings?focus=twilio');
      return;
    }

    try {
      setBlasting(true);
      setError(null);
      await blastCampaign(campaignId);
      
      // Reload campaign data and call logs
      const [campaignData, logsRes] = await Promise.all([
        fetchCampaign(campaignId),
        fetch(`/call-logs?campaignId=${campaignId}`, {
          method: 'GET',
          credentials: 'include',
        }).then((r) => {
          if (!r.ok) throw new Error(`Failed to load call logs: ${r.status}`);
          return r.json();
        }),
      ]);
      
      setCampaign(campaignData);
      setCallLogs(logsRes.logs || []);
    } catch (err) {
      if (err.code === 'TWILIO_NOT_CONFIGURED') {
        // Safety net in case backend reports no config
        alert('Twilio not configured. Connect your Twilio account in Settings → Twilio before blasting.');
        navigate('/app/settings?focus=twilio');
        return;
      }

      console.error('Error starting blast:', err);
      setError(err.message || 'Error starting blast');
    } finally {
      setBlasting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-10 text-slate-400">
        Loading campaign...
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/app/campaigns')}>
          ← Back to Campaigns
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/app/campaigns')}>
          ← Back to Campaigns
        </Button>
        <Alert>
          <AlertDescription>Campaign not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const leadCount = campaign._count?.leads || 0;
  const callLogCount = campaign._count?.callLogs || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="outline"
            onClick={() => navigate('/app/campaigns')}
            className="mb-4"
          >
            ← Back to Campaigns
          </Button>
          <h1 className="text-2xl font-semibold text-slate-50">{campaign.name}</h1>
          <p className="text-slate-400 text-sm mt-1">Campaign details and management</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Campaign Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Information</CardTitle>
          <CardDescription>Overview and statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-slate-400">Status</div>
              <Badge className="mt-1 bg-emerald-500/10 text-emerald-300 text-xs px-2 py-0.5 border-0">
                {campaign.status || 'draft'}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-slate-400">From Number</div>
              <div className="text-slate-50 font-medium mt-1">{campaign.fromNumber}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Created</div>
              <div className="text-slate-50 font-medium mt-1">{formatDateTime(campaign.createdAt)}</div>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-6">
            <div>
              <div className="text-sm text-slate-400">Leads</div>
              <div className="text-2xl font-semibold text-slate-50 mt-1">{leadCount}</div>
            </div>
            <Separator orientation="vertical" className="h-12" />
            <div>
              <div className="text-sm text-slate-400">Call Logs</div>
              <div className="text-2xl font-semibold text-slate-50 mt-1">{callLogCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voicemail Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle>Voicemail Message</CardTitle>
          <CardDescription>Choose which voicemail audio will be played when calls for this campaign hit voicemail</CardDescription>
        </CardHeader>
        <CardContent>
          {audioLoading ? (
            <p className="text-xs text-slate-400">Loading audio library…</p>
          ) : voicemailAudios.length === 0 ? (
            <p className="text-xs text-slate-500">
              No voicemail audio uploaded yet. Upload one in Settings → Twilio.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={selectedAudioId || ''}
                  onChange={e => setSelectedAudioId(Number(e.target.value) || null)}
                >
                  <option value="">Select voicemail audio</option>
                  {voicemailAudios.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={handleSaveCampaignAudio}
                  disabled={!selectedAudioId || savingAudio}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAudio ? 'Saving…' : 'Save voicemail'}
                </Button>
              </div>

              {selectedAudio && (
                <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-100">
                      Currently selected audio
                    </span>
                    <span className="text-xs text-slate-300">
                      {selectedAudio.name}
                    </span>
                    <span className="text-[10px] text-slate-500 break-all">
                      {selectedAudio.url}
                    </span>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <audio controls className="h-8 max-w-xs">
                      <source src={selectedAudio.url} />
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage your campaign</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="csv-upload" className="block text-sm font-medium text-slate-400 mb-2">
                Upload Leads (CSV)
              </label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleUploadCsv}
                disabled={uploading}
                className="cursor-pointer"
              />
              <p className="text-xs text-slate-500 mt-1">
                CSV must have "name" and "phone" (or "number") columns
              </p>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleBlast}
                disabled={blasting || twilioLoading || leadCount === 0}
                className="bg-indigo-500 hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {blasting ? 'Blasting…' : 'Start Blast'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
          <CardDescription>{leads.length} leads in this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No leads yet. Upload a CSV file to add leads.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>{lead.name || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-sm">{formatPhone(lead.number)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.status || 'queued'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">
                      {formatDateTime(lead.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Call Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Call Logs</CardTitle>
          <CardDescription>{callLogs.length} call logs for this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {callLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No call logs yet. Start a blast to see call logs here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Name</TableHead>
                  <TableHead>Lead Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Success</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.leadName || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-sm">{formatPhone(log.leadNumber)}</TableCell>
                    <TableCell>{getStatusBadge(log.status || log.answeredBy)}</TableCell>
                    <TableCell>{log.duration ? `${log.duration}s` : 'N/A'}</TableCell>
                    <TableCell className="text-sm text-slate-400">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>
                      {log.success ? (
                        <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">Delivered</Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-300 border-red-500/20">Failed</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

