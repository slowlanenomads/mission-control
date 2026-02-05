import React, { useState, useCallback } from 'react'
import { Brain, Search, FileText } from 'lucide-react'
import { useApi } from '../hooks/useApi'

interface MemoryResult {
  file?: string
  path?: string
  line?: number
  lineStart?: number
  lineEnd?: number
  score?: number
  content?: string
  snippet?: string
  match?: string
}

export default function Memory() {
  const [query, setQuery] = useState('')
  const [searchUrl, setSearchUrl] = useState<string | null>(null)
  const { data: results, loading, error } = useApi<any>(searchUrl)

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setSearchUrl(`/api/memory/search?q=${encodeURIComponent(query.trim())}`)
    }
  }, [query])

  const resultList: MemoryResult[] = Array.isArray(results) ? results : (results as any)?.results ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Memory Explorer</h2>
        <p className="text-sm text-gray-500 mt-0.5">Search through agent memory and workspace files</p>
      </div>
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memory... (e.g., 'project ideas', 'user preferences')"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-5 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">Error: {error}</div>
      )}
      {resultList.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{resultList.length} results found</p>
          {resultList.map((result: MemoryResult, i: number) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-start gap-3 mb-3">
                <FileText className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-gray-200 truncate">{result.file || result.path || 'Unknown'}</span>
                    {(result.line || result.lineStart) && (
                      <span className="text-xs text-gray-500 font-mono">
                        L{result.line || result.lineStart}{result.lineEnd && result.lineEnd !== result.lineStart ? `-${result.lineEnd}` : ''}
                      </span>
                    )}
                    {result.score != null && (
                      <span className="text-xs text-gray-600 font-mono">score: {typeof result.score === 'number' ? result.score.toFixed(2) : result.score}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-md p-3 ml-7">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {result.content || result.snippet || result.match || '(no preview)'}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
      {searchUrl && !loading && resultList.length === 0 && !error && (
        <div className="text-center py-20">
          <Brain className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No results found for &quot;{query}&quot;</p>
        </div>
      )}
      {!searchUrl && (
        <div className="text-center py-20">
          <Brain className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Enter a search query to explore agent memory</p>
          <p className="text-xs text-gray-600 mt-1">Searches workspace files, daily notes, and long-term memory</p>
        </div>
      )}
    </div>
  )
}
