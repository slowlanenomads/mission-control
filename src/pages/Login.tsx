import React, { useState } from 'react'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { needsSetup, login, setup, error, clearError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isSetup = needsSetup

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (isSetup && password !== confirmPassword) {
      return // Form validation handles this
    }

    setSubmitting(true)
    try {
      if (isSetup) {
        await setup(username, password)
      } else {
        await login(username, password)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const passwordMismatch = isSetup && confirmPassword && password !== confirmPassword

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 mb-4">
            <span className="text-3xl">🦞</span>
          </div>
          <h1 className="text-xl font-bold text-gray-100">Mission Control</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSetup ? 'Create your admin account' : 'Sign in to continue'}
          </p>
        </div>

        {/* Setup notice */}
        {isSetup && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">First-time setup</span>
            </div>
            <p className="text-xs text-blue-300/70">
              No admin account exists yet. Create one to secure your dashboard.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-colors"
              placeholder="admin"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 pr-10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-colors"
                placeholder="••••••••"
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                minLength={isSetup ? 8 : undefined}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isSetup && (
              <p className="text-[10px] text-gray-600 mt-1">Minimum 8 characters</p>
            )}
          </div>

          {isSetup && (
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-gray-900 border rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 transition-colors ${
                  passwordMismatch
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
                    : 'border-gray-800 focus:border-gray-600 focus:ring-gray-600'
                }`}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              {passwordMismatch && (
                <p className="text-[10px] text-red-400 mt-1">Passwords don't match</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || (isSetup && (password !== confirmPassword || password.length < 8))}
            className="w-full bg-gray-100 text-gray-900 rounded-lg px-4 py-3 text-sm font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isSetup ? 'Creating account...' : 'Signing in...'}
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                {isSetup ? 'Create Admin Account' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-700 mt-8">
          OpenClaw Mission Control • Secured
        </p>
      </div>
    </div>
  )
}
