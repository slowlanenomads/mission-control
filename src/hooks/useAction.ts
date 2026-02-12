import { useState, useCallback } from 'react'

export function useAction() {
  const [loading, setLoading] = useState(false)

  const execute = useCallback(async (url: string, options: RequestInit = {}): Promise<{ ok: boolean; data?: any; error?: string }> => {
    setLoading(true)
    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers as any },
        ...options,
      })
      if (res.status === 401) {
        window.location.reload()
        return { ok: false, error: 'Session expired' }
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        return { ok: false, error: data?.error || `HTTP ${res.status}` }
      }
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e.message }
    } finally {
      setLoading(false)
    }
  }, [])

  return { execute, loading }
}
