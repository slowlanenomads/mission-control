import { NavLink } from 'react-router-dom'
import { LayoutDashboard, MessageSquare, Clock, Brain, Settings, LogOut, CheckSquare } from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sessions', icon: MessageSquare, label: 'Sessions' },
  { to: '/cron', icon: Clock, label: 'Cron Jobs' },
  { to: '/todos', icon: CheckSquare, label: 'Tasks' },
  { to: '/memory', icon: Brain, label: 'Memory' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  onLogout?: () => void
  username?: string
}

export function Sidebar({ onLogout, username }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-gray-900 border-r border-gray-800 flex flex-col z-50">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦞</span>
          <div>
            <h1 className="font-bold text-sm text-gray-100">Mission Control</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
              <span className="text-[10px] text-green-400 uppercase tracking-wider font-medium">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-3 border-t border-gray-800">
        {username && (
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs text-gray-400 truncate">
              Signed in as <span className="text-gray-300 font-medium">{username}</span>
            </span>
          </div>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-gray-800/50 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        )}
        <p className="text-[10px] text-gray-600 px-2 mt-2">OpenClaw v0.2.0</p>
      </div>
    </aside>
  )
}

export default Sidebar
