import { useState, useEffect, useCallback } from 'react'
export function useApi<T>(url: string, refreshInterval?: number) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [url])
  useEffect(() => {
    fetchData()
    if (refreshInterval) { const id = setInterval(fetchData, refreshInterval); return () => clearInterval(id) }
  }, [fetchData, refreshInterval])
  return { data, loading, error, refetch: fetchData }
}
