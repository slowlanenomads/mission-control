import React, { useState, useEffect, useCallback } from 'react'
import { Bot, ChevronDown, ChevronRight, Clock, Cpu, Hash, Zap, CheckCircle, TrendingUp } from 'lucide-react'

interface SubAgentRun {
  id: string
  task: string
  status: string
  model: string
  startedAt: string
  completedAt?: string
  durationMs: number
  findings?: string
  tokensIn?: number
  tokensOut?: number
  sessionKey?: string
  type?: 'subagent' | 'cron'
  cost?: number
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.round((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function isWithinDays(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() < days * 86400000
}

type TimeRange = 'today' | '7d' | '30d' | 'all'
type StatusFilter = 'all' | 'completed' | 'failed'
type TypeFilter = 'all' | 'subagent' | 'cron'

export default function SubAgents() {
  const [runs, setRuns] = useState<SubAgentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/subagent-runs?limit=200')
      const data = await res.json()
      setRuns(data.runs || [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRuns(); const i = setInterval(fetchRuns, 30000); return () => clearInterval(i) }, [fetchRuns])

  // Filter
  const filtered = runs.filter(r => {
    if (statusFilter === 'completed' && r.status !== 'completed') return false
    if (statusFilter === 'failed' && r.status !== 'failed') return false
    if (typeFilter !== 'all' && r.type !== typeFilter) return false
    const ts = r.completedAt || r.startedAt
    if (timeRange === 'today' && !isToday(ts)) return false
    if (timeRange === '7d' && !isWithinDays(ts, 7)) return false
    if (timeRange === '30d' && !isWithinDays(ts, 30)) return false
    return true
  })

  // Stats
  const totalRuns = runs.length
  const runsToday = runs.filter(r => isToday(r.completedAt || r.startedAt)).length
  const completed = runs.filter(r => r.status === 'completed').length
  const successRate = totalRuns > 0 ? Math.round((completed / totalRuns) * 100) : 0
  const totalTokens = runs.reduce((sum, r) => sum + (r.tokensIn || 0) + (r.tokensOut || 0), 0)

  const statusIcon = (s: string) => s === 'completed' ? '✅' : s === 'failed' ? '❌' : '🔄'
  const statusColor = (s: string) => s === 'completed' ? 'text-green-400' : s === 'failed' ? 'text-red-400' : 'text-blue-400'

  const btnClass = (active: boolean) =>
    `px-3 py-1 text-xs rounded-lg transition-colors ${active ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot size={24} className="text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-100">Sub-Agents</h1>
            <p className="text-sm text-gray-500">Historical run log</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Runs', value: totalRuns, icon: <Hash size={16} className="text-purple-400" /> },
          { label: 'Today', value: runsToday, icon: <Zap size={16} className="text-yellow-400" /> },
          { label: 'Success Rate', value: `${successRate}%`, icon: <CheckCircle size={16} className="text-green-400" /> },
          { label: 'Total Tokens', value: formatNumber(totalTokens), icon: <TrendingUp size={16} className="text-blue-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-gray-500">{s.label}</span></div>
            <div className="text-xl font-bold text-gray-100">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 mr-1">Time:</span>
        {(['today', '7d', '30d', 'all'] as TimeRange[]).map(t => (
          <button key={t} className={btnClass(timeRange === t)} onClick={() => setTimeRange(t)}>
            {t === 'today' ? 'Today' : t === '7d' ? 'Last 7 days' : t === '30d' ? 'Last 30 days' : 'All'}
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-4 mr-1">Type:</span>
        {(['all', 'subagent', 'cron'] as TypeFilter[]).map(t => (
          <button key={t} className={btnClass(typeFilter === t)} onClick={() => setTypeFilter(t)}>
            {t === 'all' ? 'All' : t === 'subagent' ? '🤖 Sub-Agents' : '⏰ Cron'}
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-4 mr-1">Status:</span>
        {(['all', 'completed', 'failed'] as StatusFilter[]).map(s => (
          <button key={s} className={btnClass(statusFilter === s)} onClick={() => setStatusFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading && !runs.length ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg h-12 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">No runs found</div>
      ) : (
        <div className="space-y-1">
          {filtered.map((r, idx) => {
            const expanded = expandedRow === r.id
            return (
              <div key={r.id} className={`border border-gray-800 rounded-lg overflow-hidden ${idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
                  onClick={() => setExpandedRow(expanded ? null : r.id)}
                >
                  {expanded ? <ChevronDown size={14} className="text-gray-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
                  <span className="text-base shrink-0">{statusIcon(r.status)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${r.type === 'cron' ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-300'}`}>
                    {r.type === 'cron' ? 'CRON' : 'AGENT'}
                  </span>
                  <span className="text-sm text-gray-300 flex-1 truncate">{r.task.length > 80 ? r.task.slice(0, 80) + '…' : r.task}</span>
                  <span className="text-xs text-gray-500 hidden sm:block w-32 text-right">{r.model}</span>
                  <span className="text-xs text-gray-500 hidden md:block w-20 text-right flex items-center justify-end gap-1"><Clock size={11} />{formatDuration(r.durationMs)}</span>
                  <span className="text-xs text-gray-500 hidden md:block w-20 text-right">{formatNumber((r.tokensIn || 0) + (r.tokensOut || 0))}</span>
                  <span className="text-xs text-gray-500 w-20 text-right">{r.completedAt ? timeAgo(r.completedAt) : '—'}</span>
                </div>
                {expanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-800 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-500">
                      <div><span className="text-gray-600">Model:</span> {r.model}</div>
                      <div><span className="text-gray-600">Duration:</span> {formatDuration(r.durationMs)}</div>
                      <div><span className="text-gray-600">Tokens In:</span> {formatNumber(r.tokensIn || 0)}</div>
                      <div><span className="text-gray-600">Tokens Out:</span> {formatNumber(r.tokensOut || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Task</div>
                      <div className="text-sm text-gray-300">{r.task}</div>
                    </div>
                    {r.findings && (
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Findings</div>
                        <div className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3">{r.findings}</div>
                      </div>
                    )}
                    {r.startedAt && (
                      <div className="text-xs text-gray-600">
                        Started: {new Date(r.startedAt).toLocaleString()} → Completed: {r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
