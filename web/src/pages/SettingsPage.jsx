import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import { CheckCircle2 } from 'lucide-react'
import { fetchVoicemailAudios, uploadVoicemailAudio } from '@/lib/voicemailClient.js'
import {
  fetchBillingUsage,
  fetchBillingStatus,
  startBillingSubscription,
  openBillingPortal,
  centsToDollars,
} from '@/lib/billingClient'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Mock Twilio numbers
const mockNumbers = [
  { id: 1, number: '+18594133796', label: 'Primary (Lexington)' },
  { id: 2, number: '+18722686738', label: 'Chicago Zone' },
  { id: 3, number: '+18594313796', label: 'Lexington 2' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  
  // Profile state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  
  // Twilio numbers state
  const [selectedNumberIds, setSelectedNumberIds] = useState([])
  const [numbersMessage, setNumbersMessage] = useState('')
  
  // Appearance state
  const [theme, setTheme] = useState('dark')

  // Voicemail audio state
  const [voicemailAudios, setVoicemailAudios] = useState([])
  const [audioLoading, setAudioLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [audioName, setAudioName] = useState('')

  // Billing usage state
  const [billingUsage, setBillingUsage] = useState({
    loading: true,
    error: null,
    usageCents: 0,
    events: [],
    billingPeriodStart: null,
    billingPeriodEnd: null,
  })

  // Billing status state
  const [billingStatus, setBillingStatus] = useState({
    loading: true,
    error: null,
    subscriptionStatus: null,
    hasActiveSubscription: false,
  })

  // Initialize from user data
  useEffect(() => {
    if (user) {
      setEmail(user.email || '')
      setName(user.name || '')
      setCompany(user.company || '')
    }
  }, [user])

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    if (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') {
      setTheme(savedTheme)
      applyTheme(savedTheme)
    } else {
      setTheme('dark')
      applyTheme('dark')
    }
  }, [])

  // Load billing usage and status
  useEffect(() => {
    let isMounted = true

    async function loadBilling() {
      try {
        const [usage, status] = await Promise.all([
          fetchBillingUsage(),
          fetchBillingStatus(),
        ])

        if (!isMounted) return

        setBillingUsage({
          loading: false,
          error: null,
          usageCents: usage.usageCents ?? 0,
          events: usage.events ?? [],
          billingPeriodStart: usage.billingPeriodStart ?? null,
          billingPeriodEnd: usage.billingPeriodEnd ?? null,
        })

        setBillingStatus({
          loading: false,
          error: null,
          subscriptionStatus: status.subscriptionStatus ?? null,
          hasActiveSubscription: !!status.hasActiveSubscription,
        })
      } catch (err) {
        console.error('Error loading billing:', err)
        if (!isMounted) return
        setBillingUsage((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load billing',
        }))
        setBillingStatus((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load billing',
        }))
      }
    }

    loadBilling()

    return () => {
      isMounted = false
    }
  }, [])

  // Load voicemail audios
  useEffect(() => {
    const loadAudios = async () => {
      try {
      setAudioLoading(true)
      const list = await fetchVoicemailAudios()
      setVoicemailAudios(list)
    } catch (err) {
      console.error('Error loading voicemail audios:', err)
    } finally {
      setAudioLoading(false)
    }
    }
    loadAudios()
  }, [])

  async function handleUploadVoicemail(e) {
    e.preventDefault()
    const fileInput = e.target.elements.voicemailFile
    if (!fileInput.files || !fileInput.files[0]) {
      alert('Select an audio file to upload')
      return
    }

    const file = fileInput.files[0]

    try {
      setUploading(true)
      const created = await uploadVoicemailAudio(file, audioName)
      setVoicemailAudios(prev => [created, ...prev])
      setAudioName('')
      fileInput.value = ''
    } catch (err) {
      console.error('Upload error:', err)
      alert(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function applyTheme(themeValue) {
    if (themeValue === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      themeValue = prefersDark ? 'dark' : 'light'
    }
    
    if (themeValue === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    }
  }

  function handleThemeChange(newTheme) {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
    console.log('Theme changed to:', newTheme)
  }

  function handleProfileSave(e) {
    e.preventDefault()
    setProfileMessage('')
    
    const formValues = { name, email, company }
    console.log('Profile save', formValues)
    
    setProfileMessage('Profile saved successfully!')
    setTimeout(() => setProfileMessage(''), 3000)
  }

  function handlePasswordSave(e) {
    e.preventDefault()
    setPasswordMessage('')
    
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Passwords do not match')
      return
    }
    
    if (newPassword.length < 8) {
      setPasswordMessage('Password must be at least 8 characters')
      return
    }
    
    const data = { currentPassword, newPassword, confirmPassword }
    console.log('Password change', data)
    
    setPasswordMessage('Password changed successfully!')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => setPasswordMessage(''), 3000)
  }

  function handleNumberToggle(numberId) {
    setSelectedNumberIds(prev => 
      prev.includes(numberId)
        ? prev.filter(id => id !== numberId)
        : [...prev, numberId]
    )
  }

  function handleNumbersSave() {
    console.log('Twilio pool', selectedNumberIds)
    setNumbersMessage('Numbers saved successfully!')
    setTimeout(() => setNumbersMessage(''), 3000)
  }

  async function handleActivateBilling() {
    try {
      await startBillingSubscription()
      const status = await fetchBillingStatus()
      setBillingStatus({
        loading: false,
        error: null,
        subscriptionStatus: status.subscriptionStatus ?? null,
        hasActiveSubscription: !!status.hasActiveSubscription,
      })
    } catch (err) {
      console.error('Error activating billing:', err)
      setBillingStatus((prev) => ({
        ...prev,
        error: err.message || 'Failed to start billing',
      }))
    }
  }

  async function handleManageBilling() {
    try {
      await openBillingPortal()
    } catch (err) {
      console.error('Error opening billing portal:', err)
      setBillingStatus((prev) => ({
        ...prev,
        error: err.message || 'Failed to open billing portal',
      }))
    }
  }

  // Guard against undefined user
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Your company name"
              />
            </div>
            {profileMessage && (
              <Alert variant={profileMessage.includes('success') ? 'default' : 'destructive'}>
                <AlertDescription className="flex items-center gap-2">
                  {profileMessage.includes('success') && <CheckCircle2 className="h-4 w-4" />}
                  {profileMessage}
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {passwordMessage && (
              <Alert variant={passwordMessage.includes('success') ? 'default' : 'destructive'}>
                <AlertDescription className="flex items-center gap-2">
                  {passwordMessage.includes('success') && <CheckCircle2 className="h-4 w-4" />}
                  {passwordMessage}
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit">Change Password</Button>
          </form>
        </CardContent>
      </Card>

      {/* Twilio Numbers Section */}
      <Card>
        <CardHeader>
          <CardTitle>Twilio Numbers</CardTitle>
          <CardDescription>Manage your Twilio phone numbers pool</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {mockNumbers.map((num) => (
              <div
                key={num.id}
                className="flex items-center justify-between p-3 border border-slate-800 rounded-md bg-slate-900/50"
              >
                <div className="flex-1">
                  <div className="font-mono text-sm text-slate-50">{num.number}</div>
                  <div className="text-xs text-slate-400 mt-1">{num.label}</div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedNumberIds.includes(num.id)}
                    onChange={() => handleNumberToggle(num.id)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm text-slate-400">Include in rotation</span>
                </label>
              </div>
            ))}
          </div>
          {numbersMessage && (
            <Alert variant={numbersMessage.includes('success') ? 'default' : 'destructive'}>
              <AlertDescription className="flex items-center gap-2">
                {numbersMessage.includes('success') && <CheckCircle2 className="h-4 w-4" />}
                {numbersMessage}
              </AlertDescription>
            </Alert>
          )}
          <Button onClick={handleNumbersSave}>Save Numbers</Button>
        </CardContent>
      </Card>

      {/* Voicemail Audio Library Section */}
      <Card>
        <CardHeader>
          <CardTitle>Voicemail Audio Library</CardTitle>
          <CardDescription>Upload voicemail messages (MP3/WAV) and reuse them across campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUploadVoicemail} className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="audio-name">Display name</Label>
                <Input
                  id="audio-name"
                  type="text"
                  value={audioName}
                  onChange={e => setAudioName(e.target.value)}
                  placeholder="Example: Busy season intro"
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="voicemail-file">Audio file (MP3/WAV)</Label>
                <Input
                  id="voicemail-file"
                  name="voicemailFile"
                  type="file"
                  accept="audio/*"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload audio'}
              </Button>
            </div>
          </form>

          <Separator className="my-4" />

          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Saved audio files</h4>
            {audioLoading ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : voicemailAudios.length === 0 ? (
              <p className="text-xs text-slate-500">No voicemail audio uploaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {voicemailAudios.map(audio => (
                  <li
                    key={audio.id}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
                  >
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-medium text-slate-200">{audio.name}</span>
                      <span className="text-[10px] text-slate-500 truncate">{audio.url}</span>
                    </div>
                    <audio controls className="ml-4 h-8">
                      <source src={audio.url} />
                      Your browser does not support audio.
                    </audio>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the appearance of your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex flex-col gap-3 mt-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-md border border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={theme === 'dark'}
                    onChange={() => handleThemeChange('dark')}
                    className="w-4 h-4 text-green-600 border-slate-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm text-slate-50">Dark</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-md border border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={theme === 'light'}
                    onChange={() => handleThemeChange('light')}
                    className="w-4 h-4 text-green-600 border-slate-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm text-slate-50">Light</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-md border border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <input
                    type="radio"
                    name="theme"
                    value="system"
                    checked={theme === 'system'}
                    onChange={() => handleThemeChange('system')}
                    className="w-4 h-4 text-green-600 border-slate-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm text-slate-50">System</span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Usage-based voicemail billing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            {billingUsage.loading ? (
              <div className="text-sm text-muted-foreground">Loading usage…</div>
            ) : billingUsage.error ? (
              <div className="text-sm text-destructive">{billingUsage.error}</div>
            ) : (
              <>
                <p className="text-sm">
                  This period:{' '}
                  <span className="font-semibold">
                    ${centsToDollars(billingUsage.usageCents).toFixed(2)}
                  </span>
                </p>
                {billingUsage.billingPeriodStart && billingUsage.billingPeriodEnd && (
                  <p className="text-xs text-muted-foreground">
                    Current period:{' '}
                    {new Date(billingUsage.billingPeriodStart).toLocaleDateString()} –{' '}
                    {new Date(billingUsage.billingPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <p className="text-sm">
              Subscription status:{' '}
              <span className="font-mono">
                {billingStatus.subscriptionStatus || 'none'}
              </span>
            </p>
            {billingStatus.error && (
              <p className="text-xs text-destructive mt-1">{billingStatus.error}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              size="sm"
              variant={billingStatus.hasActiveSubscription ? 'outline' : 'default'}
              onClick={handleActivateBilling}
              disabled={billingStatus.loading}
            >
              {billingStatus.hasActiveSubscription
                ? 'Refresh Subscription'
                : 'Activate Billing'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManageBilling}
              disabled={billingStatus.loading}
            >
              Manage Billing
            </Button>
          </div>

          <Separator className="my-4" />

          <div>
            <h3 className="text-sm font-medium mb-2">Recent billable events</h3>
            {billingUsage.loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : billingUsage.events.length === 0 ? (
              <div className="text-sm text-muted-foreground">No billable events yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Date</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Unit price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingUsage.events.slice(0, 10).map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(ev.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{ev.units}</TableCell>
                      <TableCell>${centsToDollars(ev.unitPriceCents).toFixed(2)}</TableCell>
                      <TableCell>${centsToDollars(ev.totalCents).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
