import { LogOut, LayoutDashboard, FolderKanban, PhoneCall, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Layout({ userEmail, onLogout, children, currentPage = 'Dashboard' }) {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '#' },
    { label: 'Campaigns', icon: FolderKanban, href: '#' },
    { label: 'Call Logs', icon: PhoneCall, href: '#' },
    { label: 'Settings', icon: Settings, href: '#' },
  ]

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      {/* Sidebar - hidden on mobile, visible on desktop */}
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
              const isActive = item.label === currentPage
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-slate-800 text-slate-50' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-50'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </a>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-64">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/70 backdrop-blur sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-slate-50">{currentPage}</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:inline">{userEmail}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="border-slate-800 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full space-y-6">
          {children}
        </main>
      </div>
    </div>
  )
}


