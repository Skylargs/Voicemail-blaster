import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTwilioStatus } from '@/contexts/TwilioStatusContext.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

export default function CampaignCard({ campaign, onRefresh }) {
  const navigate = useNavigate()
  const { loading: twilioLoading, hasConfig: twilioConnected } = useTwilioStatus()
  const [showAddLeads, setShowAddLeads] = useState(false)
  const [leadsText, setLeadsText] = useState('')
  const [addingLeads, setAddingLeads] = useState(false)
  const [error, setError] = useState('')
  const [blastResult, setBlastResult] = useState(null)

  function formatDate(dateString) {
    try {
      const date = new Date(dateString)
      return date.toLocaleString()
    } catch {
      return dateString
    }
  }

  async function handleAddLeads() {
    if (!leadsText.trim()) {
      setError('Please enter leads')
      return
    }

    setAddingLeads(true)
    setError('')

    try {
      const lines = leadsText.trim().split('\n').filter(line => line.trim())
      const leads = lines.map(line => {
        const [name, number] = line.split(',').map(s => s.trim())
        return { name: name || null, number }
      }).filter(lead => lead.number)

      if (leads.length === 0) {
        setError('No valid leads found. Format: name,phone')
        setAddingLeads(false)
        return
      }

      const response = await fetch(`/campaigns/${campaign.id}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ leads })
      })

      if (response.ok) {
        setLeadsText('')
        setShowAddLeads(false)
        setError('')
        onRefresh()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add leads')
      }
    } catch (err) {
      console.error('Add leads error:', err)
      setError('Failed to add leads')
    } finally {
      setAddingLeads(false)
    }
  }

  async function handleBlast() {
    if (twilioLoading) {
      return
    }

    if (!twilioConnected) {
      alert('Twilio not connected. Connect your Twilio account in Settings → Twilio before blasting.')
      navigate('/app/settings?focus=twilio')
      return
    }

    setError('')
    setBlastResult(null)

    try {
      const response = await fetch(`/campaigns/${campaign.id}/blast`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        setBlastResult(data)
        onRefresh()
      } else {
        // Handle TWILIO_NOT_CONFIGURED error
        if (data && data.code === 'TWILIO_NOT_CONFIGURED') {
          alert('Twilio not configured. Connect your Twilio account in Settings → Twilio before blasting.')
          navigate('/app/settings?focus=twilio')
          return
        }
        setError(data.error || 'Failed to start blast')
      }
    } catch (err) {
      console.error('Blast error:', err)
      setError('Failed to start blast')
    }
  }

  const leadCount = campaign._count?.leads || 0
  const callLogCount = campaign._count?.callLogs || 0

  return (
    <>
      <motion.div
        whileHover={{ y: -2, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1 flex-1">
              <h3 
                className="text-lg font-semibold text-slate-50 cursor-pointer hover:text-indigo-400 transition-colors"
                onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
              >
                {campaign.name || 'Untitled Campaign'}
              </h3>
              <div className="text-xs text-slate-400 space-y-0.5">
                <div>From: {campaign.fromNumber}</div>
                <div>Created: {formatDate(campaign.createdAt)}</div>
              </div>
            </div>
            <Badge 
              className="rounded-full bg-emerald-500/10 text-emerald-300 text-xs px-2 py-0.5 border-0"
            >
              {campaign.status || 'draft'}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-400 mb-4">
            <span>Leads: <span className="text-slate-50 font-medium">{leadCount}</span></span>
            <Separator orientation="vertical" className="h-4" />
            <span>Calls: <span className="text-slate-50 font-medium">{callLogCount}</span></span>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {blastResult && (
            <Alert className="mb-4">
              <AlertDescription>
                <strong>Blast started!</strong> {JSON.stringify(blastResult, null, 2)}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
              className="border-slate-800 hover:bg-slate-800"
            >
              View Details
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAddLeads(true)}
              className="border-slate-800 hover:bg-slate-800"
            >
              Add Leads
            </Button>
            <Button
              onClick={handleBlast}
              disabled={leadCount === 0 || twilioLoading}
              className="bg-indigo-500 hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Start Blast
            </Button>
          </div>
        </div>
      </motion.div>

      <Dialog open={showAddLeads} onOpenChange={setShowAddLeads}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Leads</DialogTitle>
            <DialogDescription>
              Paste leads below (format: name,phone - one per line)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leads-text">Leads</Label>
              <Textarea
                id="leads-text"
                value={leadsText}
                onChange={(e) => setLeadsText(e.target.value)}
                placeholder="John Doe,+1234567890&#10;Jane Smith,+0987654321"
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Each line should contain: name,phone
              </p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddLeads(false)
                setLeadsText('')
                setError('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddLeads}
              disabled={addingLeads}
            >
              {addingLeads ? 'Adding...' : 'Add Leads'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

