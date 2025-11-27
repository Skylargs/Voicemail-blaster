import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, PhoneCall, Settings, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { useTwilioStatus } from '@/contexts/TwilioStatusContext.jsx'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/app/dashboard' },
  { label: 'Campaigns', icon: FolderKanban, path: '/app/campaigns' },
  { label: 'Call Logs', icon: PhoneCall, path: '/app/call-logs' },
  { label: 'Settings', icon: Settings, path: '/app/settings' },
]

function getInitials(email) {
  if (!email) return 'U'
  const parts = email.split('@')[0].split('.')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { loading: twilioLoading, hasConfig: twilioConnected } = useTwilioStatus()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 border-r border-slate-800">
        <div className="flex flex-col h-full">
          {/* Logo/Product Name */}
          <div className="flex items-center h-16 px-6 border-b border-slate-800">
            <h1 className="text-xl font-semibold text-slate-50">BusyLine Voicemail Blaster</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-slate-50'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-50'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-64">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/70 backdrop-blur sticky top-0 z-10">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            {/* Twilio status indicator */}
            <button
              type="button"
              onClick={() => navigate('/app/settings?focus=twilio')}
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800 transition"
            >
              <span
                className={`mr-1 h-2 w-2 rounded-full ${
                  twilioConnected ? 'bg-emerald-400 animate-[pulse_1.8s_ease-in-out_infinite]' : 'bg-red-400'
                }`}
              />
              {twilioLoading
                ? 'Checking Twilio…'
                : twilioConnected
                ? 'Twilio: Connected'
                : 'Twilio: Not connected'}
            </button>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-slate-400 hidden sm:inline">{user?.email}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-slate-800 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}


