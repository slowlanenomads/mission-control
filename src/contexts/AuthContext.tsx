import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface AuthUser {
  id: string
  username: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  needsSetup: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  setup: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthState>(null!)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if we have a valid session on load
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        } else if (res.status === 401) {
          // Check if setup is needed
          const setupRes = await fetch('/api/auth/status')
          if (setupRes.ok) {
            const status = await setupRes.json()
            setNeedsSetup(!status.hasUsers)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setNeedsSetup(false)
        return true
      }
      setError(data.error || 'Login failed')
      return false
    } catch (e: any) {
      setError('Connection failed')
      return false
    }
  }, [])

  const setup = useCallback(async (username: string, password: string): Promise<boolean> => {
    setError(null)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setNeedsSetup(false)
        return true
      }
      setError(data.error || 'Setup failed')
      return false
    } catch (e: any) {
      setError('Connection failed')
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setUser(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, error, login, setup, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}
