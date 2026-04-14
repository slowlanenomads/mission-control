import React, { useState } from 'react'
import { Activity, MessageSquare, Clock, Users, Zap, Cpu, DollarSign, TrendingUp, RefreshCw, RotateCw, FileText, Database, ChevronDown, ChevronUp, Info } from 'lucide-react'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonStatCard, SkeletonActivityFeed } from '../components/Skeleton'
import { useApi } from '../hooks/useApi'
import { useAction } from '../hooks/useAction'
import { useToast } from '../components/Toast'
import { formatDistanceToNow } from 'date-fns'

interface Session {
  sessionKey: string
  kind: string
  status: string
  lastActivity: string
  messageCount: number
  recentMessages?: Array<{ role: string; content: string; timestamp: string }>
}

interface SessionStatus {
  model?: string
  inputTokens?: number
  outputTokens?: number
  cost?: number
  dailyCost?: number
  sessionKey?: string
}

interface GatewayStatus {
  ok: boolean
  status: 'connected' | 'error'
  error?: string
}

interface LiveSessionStatus {
  raw?: string
  model?: string
  version?: string
  commit?: string
  authProfile?: string
  tokens?: { input: number; output: number; total: number }
  cache?: { hitPercent: number; cachedTokens: number; newTokens: number }
  context?: { used: number; max: number; percent: number; compactions: number }
  usage?: {
    windowPercentLeft: number
    windowTimeLeft: string
    weekPercentLeft: number
    weekTimeLeft: string
    windowLabel?: string
    weekLabel?: string
    windowResetAt?: string | null
    weekResetAt?: string | null
    source?: string
  }
  runtime?: { mode: string; thinking: string; elevated: boolean }
  queue?: { name: string; depth: number }
  fastMode?: boolean | null
  dreamingEnabled?: boolean | null
  sessionKey?: string
  updated?: string
  parseWarnings?: string[]
  parseError?: string
}

function kindColor(kind: string): string {
  if (kind === 'main') return 'blue'
  if (kind === 'subagent') return 'purple'
  if (kind === 'cron') return 'orange'
  return 'gray'
}

function kindAccent(kind: string): string {
  if (kind === 'main') return 'border-l-blue-500'
  if (kind === 'subagent') return 'border-l-purple-500'
  if (kind === 'cron') return 'border-l-orange-500'
  return 'border-l-gray-500'
}

function truncate(str: string, len: number): string {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '\u2026' : str
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function formatPercent(n: number): string {
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`
}

function hasVisibleMessageContent(message?: { content?: string | null }): boolean {
  return Boolean(message?.content && message.content.trim())
}

export default function Dashboard() {
  const { data: sessions, loading: sessionsLoading } = useApi<Session[]>('/api/sessions?activeMinutes=180&messageLimit=3', { interval: 15000 })
  const { data: sessionStatus, loading: statusLoading } = useApi<SessionStatus>('/api/session-status', { interval: 30000 })
  const { data: liveStatus, loading: liveLoading } = useApi<LiveSessionStatus>('/api/session-status-live', { interval: 30000 })
  const { data: cronData, loading: cronLoading, error: cronError } = useApi<any>('/api/cron', { interval: 60000 })
  const { data: gatewayStatus } = useApi<GatewayStatus>('/api/gateway/status', { interval: 15000 })
  const { toast } = useToast()
  const syncAction = useAction()
  const restartAction = useAction()
  const [restartConfirm, setRestartConfirm] = useState(false)
  const [showRawStatus, setShowRawStatus] = useState(false)

  const sessionList: Session[] = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []
  const gatewayConnected = gatewayStatus?.ok !== false
  const statusStripModel = liveStatus?.model || sessionStatus?.model || '—'
  const visibleSessions = sessionList.length
  const visibleRecentMessages = sessionList.reduce(
    (sum, s) => sum + ((s.recentMessages || []).filter(hasVisibleMessageContent).length),
    0,
  )
  const sessionsWithPreview = sessionList.filter(s => (s.recentMessages || []).some(hasVisibleMessageContent)).length
  const cronJobs = Array.isArray(cronData) ? cronData : (cronData as any)?.jobs ?? []
  const activeCron = cronJobs.filter((j: any) => j.enabled !== false).length
  const subagentCount = sessionList.filter(s => s.kind === 'subagent').length

  const totalTokens = (sessionStatus?.inputTokens || 0) + (sessionStatus?.outputTokens || 0)
  const costPer1k = totalTokens > 0 && sessionStatus?.cost != null ? ((sessionStatus.cost / totalTokens) * 1000) : null

  const activityFeed = sessionList
    .filter(s => s.recentMessages && s.recentMessages.some(hasVisibleMessageContent))
    .flatMap(s => (s.recentMessages || [])
      .filter(hasVisibleMessageContent)
      .map(msg => ({ sessionKey: s.sessionKey, kind: s.kind, role: msg.role, content: msg.content, timestamp: msg.timestamp })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15)

  const isInitialLoad = sessionsLoading && sessionList.length === 0

  const handleSync = async () => {
    const res = await syncAction.execute('/api/actions/sync', { method: 'POST' })
    toast(res.ok ? 'Sync triggered' : `Sync failed: ${res.error}`, res.ok ? 'success' : 'error')
  }

  const handleRestart = async () => {
    const res = await restartAction.execute('/api/actions/restart-gateway', { method: 'POST' })
    toast(res.ok ? 'Gateway restart initiated' : `Restart failed: ${res.error}`, res.ok ? 'success' : 'error')
    setRestartConfirm(false)
  }

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-gray-900 border border-gray-800 rounded-xl px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${gatewayConnected ? 'bg-green-400 pulse-dot' : 'bg-yellow-400'}`} />
          <span className={`text-sm font-medium ${gatewayConnected ? 'text-green-400' : 'text-yellow-400'}`}>
            {gatewayConnected ? 'Gateway connected' : 'Gateway degraded'}
          </span>
        </div>
        <div className="w-px h-5 bg-gray-700 hidden sm:block" />
        <div className="text-sm text-gray-400">
          <span className="text-gray-500">Model:</span>{' '}
          <span className="font-mono text-gray-300">{statusStripModel}</span>
        </div>
        <div className="w-px h-5 bg-gray-700 hidden sm:block" />
        <div className="text-sm text-gray-400">
          <span className="text-gray-500">Visible sessions:</span>{' '}
          <span className="font-mono text-gray-300">{sessionList.length}</span>
        </div>
      </div>

      {/* Stat cards */}
      {isInitialLoad ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Activity} label="Visible Sessions" value={visibleSessions} subtitle="last 3h snapshot" color="text-green-400" />
          <StatCard icon={MessageSquare} label="Preview Messages" value={visibleRecentMessages} subtitle={`${sessionsWithPreview} session${sessionsWithPreview !== 1 ? 's' : ''} with text preview`} color="text-blue-400" />
          <StatCard icon={Clock} label="Cron Jobs" value={cronError ? '—' : activeCron} subtitle={cronError ? 'cron data unavailable' : `${cronJobs.length} total`} color="text-orange-400" loading={cronLoading && cronJobs.length === 0 && !cronError} />
          <StatCard icon={Users} label="Sub-agent Sessions" value={subagentCount} subtitle="visible in last 3h" color="text-purple-400" />
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-yellow-400" />
          <h3 className="font-semibold text-sm">Quick Actions</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleSync} disabled={syncAction.loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 hover:bg-gray-700 disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${syncAction.loading ? 'animate-spin' : ''}`} /> Run Sync
          </button>
          <button onClick={() => setRestartConfirm(true)} disabled={restartAction.loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-red-800 rounded-lg text-sm text-red-300 hover:bg-red-900/30 disabled:opacity-50 transition-colors">
            <RotateCw className={`w-4 h-4 ${restartAction.loading ? 'animate-spin' : ''}`} /> Restart Gateway
          </button>
          <a href="/memory" className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 hover:bg-gray-700 transition-colors">
            <FileText className="w-4 h-4" /> View Logs
          </a>
          <a href="/empire" className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 hover:bg-gray-700 transition-colors">
            <Database className="w-4 h-4" /> Empire Status
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <h3 className="font-semibold text-sm">Recent Activity</h3>
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">preview feed only</span>
            </div>
            {sessionsLoading && <span className="text-[10px] text-gray-500 font-mono animate-pulse">refreshing...</span>}
          </div>
          {isInitialLoad ? (
            <SkeletonActivityFeed />
          ) : (
            <div className="divide-y divide-gray-800/50 max-h-[420px] overflow-y-auto">
              {activityFeed.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500 text-sm">No preview activity in the current 3h snapshot</div>
              ) : (
                activityFeed.map((item, i) => (
                  <div key={`${item.sessionKey}-${i}`} className={`px-6 py-3 border-l-2 ${kindAccent(item.kind)} hover:bg-gray-800/30 transition-colors`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge color={kindColor(item.kind)} dot>{item.kind}</StatusBadge>
                        <span className="text-xs text-gray-500 font-mono hidden sm:inline">{item.sessionKey.slice(0, 20)}...</span>
                      </div>
                      <span className="text-xs text-gray-500 font-mono">
                        {item.timestamp ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      <span className="text-gray-500 font-mono text-xs">[{item.role}]</span>{' '}
                      {truncate(item.content, 140)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Live Session Status */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm">Live Session Status</h3>
            </div>
            {liveStatus?.updated && <span className="text-[11px] text-gray-400 font-mono bg-gray-800/70 px-2 py-0.5 rounded">updated {liveStatus.updated}</span>}
          </div>
          <div className="p-5 space-y-4">
            {liveLoading && !liveStatus ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i}><div className="h-3 w-20 bg-gray-800 rounded animate-pulse mb-1" /><div className="h-5 w-32 bg-gray-800 rounded animate-pulse" /></div>
                ))}
              </div>
            ) : liveStatus ? (
              <>
                {/* Model */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Model</p>
                  <p className="font-mono text-sm text-gray-200 truncate">{liveStatus.model || '\u2014'}</p>
                  {liveStatus.version && <p className="text-[10px] text-gray-600 font-mono mt-0.5">OpenClaw {liveStatus.version}{liveStatus.commit ? ` (${liveStatus.commit})` : ''}</p>}
                </div>

                {/* Tokens */}
                {liveStatus.tokens && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Tokens</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-gray-500 uppercase mb-0.5">In</p>
                        <p className="text-sm font-bold text-blue-400">{formatTokens(liveStatus.tokens.input)}</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-gray-500 uppercase mb-0.5">Out</p>
                        <p className="text-sm font-bold text-green-400">{formatTokens(liveStatus.tokens.output)}</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-gray-500 uppercase mb-0.5">Total</p>
                        <p className="text-sm font-bold text-gray-300">{formatTokens(liveStatus.tokens.total)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cache */}
                {liveStatus.cache && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cache</p>
                        <span title="How much of the prompt/context was served from cache instead of being newly processed.">
                          <Info className="w-3 h-3 text-gray-600 hover:text-gray-400" />
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${
                        liveStatus.cache.hitPercent >= 80 ? 'text-green-400' :
                        liveStatus.cache.hitPercent >= 40 ? 'text-yellow-400' : 'text-gray-400'
                      }`}>{liveStatus.cache.hitPercent}% hit</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          liveStatus.cache.hitPercent >= 80 ? 'bg-green-500' :
                          liveStatus.cache.hitPercent >= 40 ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}
                        style={{ width: `${liveStatus.cache.hitPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-gray-600">{formatTokens(liveStatus.cache.cachedTokens)} cached</span>
                      <span className="text-[9px] text-gray-600">{formatTokens(liveStatus.cache.newTokens)} new</span>
                    </div>
                  </div>
                )}

                {/* Context */}
                {liveStatus.context && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Context</p>
                        <span title="How full the active context window is. Higher percentages mean you're closer to compaction or truncation pressure.">
                          <Info className="w-3 h-3 text-gray-600 hover:text-gray-400" />
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {liveStatus.context.compactions > 0 && (
                          <span
                            className="text-[9px] bg-orange-900/40 text-orange-400 px-1.5 py-0.5 rounded"
                            title="Number of times the conversation context has been compacted to stay within the model window."
                          >
                            {liveStatus.context.compactions} compaction{liveStatus.context.compactions !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className={`text-xs font-bold ${
                          liveStatus.context.percent >= 75 ? 'text-red-400' :
                          liveStatus.context.percent >= 55 ? 'text-yellow-400' : 'text-cyan-400'
                        }`}>{liveStatus.context.percent}%</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          liveStatus.context.percent >= 75 ? 'bg-red-500' :
                          liveStatus.context.percent >= 55 ? 'bg-yellow-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${liveStatus.context.percent}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-gray-600 mt-1">{formatTokens(liveStatus.context.used)} / {formatTokens(liveStatus.context.max)}</p>
                  </div>
                )}

                {/* Usage remaining */}
                {liveStatus.usage && (
                  <div className="border-t border-gray-800/50 pt-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Remaining</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-800/50 rounded-lg p-2" title={liveStatus.usage.windowResetAt ? `Resets ${new Date(liveStatus.usage.windowResetAt).toLocaleString()}` : undefined}>
                        <p className="text-[9px] text-gray-500 uppercase mb-0.5">Session</p>
                        <p className={`text-sm font-bold ${
                          liveStatus.usage.windowPercentLeft <= 20 ? 'text-red-400' :
                          liveStatus.usage.windowPercentLeft <= 50 ? 'text-yellow-400' : 'text-green-400'
                        }`}>{formatPercent(liveStatus.usage.windowPercentLeft)}</p>
                        <p className="text-[9px] text-gray-500 font-mono">{liveStatus.usage.windowTimeLeft}</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-2" title={liveStatus.usage.weekResetAt ? `Resets ${new Date(liveStatus.usage.weekResetAt).toLocaleString()}` : undefined}>
                        <p className="text-[9px] text-gray-500 uppercase mb-0.5">Week</p>
                        <p className={`text-sm font-bold ${
                          liveStatus.usage.weekPercentLeft <= 20 ? 'text-red-400' :
                          liveStatus.usage.weekPercentLeft <= 50 ? 'text-yellow-400' : 'text-green-400'
                        }`}>{formatPercent(liveStatus.usage.weekPercentLeft)}</p>
                        <p className="text-[9px] text-gray-500 font-mono">{liveStatus.usage.weekTimeLeft}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thinking + Runtime + Queue */}
                {(liveStatus.runtime || liveStatus.queue) && (
                  <div className="border-t border-gray-800/50 pt-3 space-y-3">
                    {liveStatus.runtime && (
                      <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-800/80">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Thinking</p>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                              liveStatus.runtime.thinking === 'off' ? 'bg-gray-800 text-gray-400' :
                              liveStatus.runtime.thinking === 'minimal' || liveStatus.runtime.thinking === 'low' ? 'bg-blue-900/30 text-blue-400' :
                              liveStatus.runtime.thinking === 'medium' ? 'bg-purple-900/40 text-purple-400' :
                              'bg-fuchsia-900/40 text-fuchsia-400'
                            }`}
                            title="Current session thinking level"
                          >
                            {liveStatus.runtime.thinking || 'off'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${liveStatus.fastMode === true ? 'bg-cyan-900/30 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}>
                            fast: {liveStatus.fastMode === true ? 'on' : liveStatus.fastMode === false ? 'off' : 'unknown'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${liveStatus.dreamingEnabled === true ? 'bg-violet-900/30 text-violet-400' : 'bg-gray-800 text-gray-400'}`}>
                            dreaming: {liveStatus.dreamingEnabled === true ? 'on' : liveStatus.dreamingEnabled === false ? 'off' : 'unknown'}
                          </span>
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">runtime: {liveStatus.runtime.mode}</span>
                          {liveStatus.runtime.elevated && (
                            <span className="text-[10px] bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded font-mono">elevated</span>
                          )}
                          {liveStatus.queue && (
                            <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                              queue: {liveStatus.queue.name} ({liveStatus.queue.depth})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Legacy cost section if available */}
                {sessionStatus?.cost != null && (
                  <div className="border-t border-gray-800/50 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-3 h-3 text-yellow-400" />
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cost</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-800/50 rounded-lg p-2">
                        <p className="text-[9px] text-gray-500 uppercase mb-0.5">Session</p>
                        <p className="text-sm font-bold text-yellow-400">${sessionStatus.cost.toFixed(4)}</p>
                      </div>
                      {costPer1k != null && (
                        <div className="bg-gray-800/50 rounded-lg p-2">
                          <p className="text-[9px] text-gray-500 uppercase mb-0.5">Per 1K</p>
                          <p className="text-sm font-bold text-orange-400">${costPer1k.toFixed(4)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Parse warnings if any */}
                {liveStatus.parseWarnings && liveStatus.parseWarnings.length > 0 && (
                  <p className="text-[9px] text-gray-600">⚠ partial parse: {liveStatus.parseWarnings.join(', ')}</p>
                )}

                {/* Raw status debug */}
                {liveStatus.raw && (
                  <div className="border-t border-gray-800/50 pt-3">
                    <button
                      onClick={() => setShowRawStatus(v => !v)}
                      className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <span>Debug / Raw Status</span>
                      {showRawStatus ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showRawStatus && (
                      <pre className="mt-2 text-[10px] leading-relaxed font-mono text-gray-400 bg-gray-950 border border-gray-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                        {liveStatus.raw}
                      </pre>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-500 text-sm py-8">No session data available</div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={restartConfirm}
        title="Restart Gateway"
        message="This will restart the OpenClaw gateway. Active sessions may be interrupted. Continue?"
        confirmLabel="Restart"
        onConfirm={handleRestart}
        onCancel={() => setRestartConfirm(false)}
        loading={restartAction.loading}
      />
    </div>
  )
}
