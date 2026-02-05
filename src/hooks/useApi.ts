import { useState, useEffect, useCallback } from 'react'

interface UseApiOptions {
  interval?: number
}

export function useApi<T>(url: string | null, options?: UseApiOptions) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!url) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(url, { credentials: 'include' })
      if (res.status === 401) {
        // Session expired — reload to show login
        window.location.reload()
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    fetchData()
    if (options?.interval && url) {
      const id = setInterval(fetchData, options.interval)
      return () => clearInterval(id)
    }
  }, [fetchData, options?.interval, url])

  return { data, loading, error, refetch: fetchData }
}
