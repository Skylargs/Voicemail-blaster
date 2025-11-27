import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import CampaignCard from '@/components/CampaignCard'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [fromNumber, setFromNumber] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadCampaigns()
  }, [])

  async function loadCampaigns() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/campaigns', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setCampaigns(Array.isArray(data) ? data : [])
      } else if (response.status === 401) {
        // Auth will be handled by ProtectedRoute
      } else {
        setError('Failed to load campaigns')
      }
    } catch (err) {
      console.error('Error loading campaigns:', err)
      setError('Network error loading campaigns')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCampaign(e) {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      const response = await fetch('/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name: campaignName, fromNumber })
      })

      if (response.ok) {
        setCampaignName('')
        setFromNumber('')
        setShowCreateDialog(false)
        loadCampaigns()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create campaign')
      }
    } catch (err) {
      console.error('Create campaign error:', err)
      setError('Failed to create campaign')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Campaigns</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your voicemail campaigns</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          Create Campaign
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400">
          Loading campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-slate-400 mb-4">
              No campaigns yet. Create one to get started.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              Create Your First Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onRefresh={loadCampaigns}
            />
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Create a new voicemail campaign
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCampaign}>
            <div className="space-y-4 py-4">
              {error && showCreateDialog && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="My Campaign"
                  required
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-number">From Number</Label>
                <Input
                  id="from-number"
                  value={fromNumber}
                  onChange={(e) => setFromNumber(e.target.value)}
                  placeholder="+1234567890"
                  required
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground">
                  Twilio phone number in E.164 format
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  setCampaignName('')
                  setFromNumber('')
                  setError('')
                }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

