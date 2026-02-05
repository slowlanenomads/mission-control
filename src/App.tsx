import React, { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import CronJobs from './pages/CronJobs'
import Memory from './pages/Memory'
import SettingsPage from './pages/SettingsPage'
import Todos from './pages/Todos'
import Login from './pages/Login'

function AppShell() {
  const { user, loading, needsSetup, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  // Loading spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl mb-4 block">🦞</span>
          <div className="w-6 h-6 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  // Not authenticated — show login/setup
  if (!user || needsSetup) {
    return <Login />
  }

  // Authenticated — show dashboard
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <Sidebar
        onLogout={logout}
        username={user.username}
        mobileOpen={sidebarOpen}
        onClose={closeSidebar}
      />

      <div className="lg:ml-56">
        <header className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
          <div className="flex items-center justify-between px-4 sm:px-8 py-4">
            <div className="flex items-center gap-3">
              {/* Hamburger — mobile only */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
              >
                <Menu size={22} />
              </button>
              <h2 className="text-lg font-semibold text-gray-200">🦞 Mission Control</h2>
              <div className="hidden sm:flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Live</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 font-mono hidden sm:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/cron" element={<CronJobs />} />
            <Route path="/todos" element={<Todos />} />
            <Route path="/memory" element={<Memory />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
