import React from 'react'
import { Activity, MessageSquare, Clock, Users, Zap, Cpu, DollarSign, TrendingUp } from 'lucide-react'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import { SkeletonStatCard, SkeletonActivityFeed } from '../components/Skeleton'
import { useApi } from '../hooks/useApi'
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

export default function Dashboard() {
  const { data: sessions, loading: sessionsLoading } = useApi<Session[]>('/api/sessions', { interval: 15000 })
  const { data: sessionStatus, loading: statusLoading } = useApi<SessionStatus>('/api/session-status', { interval: 30000 })
  const { data: cronData, loading: cronLoading } = useApi<any>('/api/cron', { interval: 60000 })

  const sessionList: Session[] = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []
  const activeSessions = sessionList.filter(s => s.status === 'active').length
  const totalMessages = sessionList.reduce((sum, s) => sum + (s.messageCount || 0), 0)
  const cronJobs = Array.isArray(cronData) ? cronData : (cronData as any)?.jobs ?? []
  const activeCron = cronJobs.filter((j: any) => j.enabled !== false).length
  const subagentCount = sessionList.filter(s => s.kind === 'subagent').length

  const totalTokens = (sessionStatus?.inputTokens || 0) + (sessionStatus?.outputTokens || 0)
  const costPer1k = totalTokens > 0 && sessionStatus?.cost != null
    ? ((sessionStatus.cost / totalTokens) * 1000)
    : null

  const activityFeed = sessionList
    .filter(s => s.recentMessages && s.recentMessages.length > 0)
    .flatMap(s =>
      (s.recentMessages || []).map(msg => ({
        sessionKey: s.sessionKey,
        kind: s.kind,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15)

  const isInitialLoad = sessionsLoading && sessionList.length === 0

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-gray-900 border border-gray-800 rounded-xl px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 pulse-dot" />
          <span className="text-sm font-medium text-green-400">Online</span>
        </div>
        <div className="w-px h-5 bg-gray-700 hidden sm:block" />
        <div className="text-sm text-gray-400">
          <span className="text-gray-500">Model:</span>{' '}
          <span className="font-mono text-gray-300">{sessionStatus?.model || 'claude-opus-4-5'}</span>
        </div>
        <div className="w-px h-5 bg-gray-700 hidden sm:block" />
        <div className="text-sm text-gray-400">
          <span className="text-gray-500">Sessions:</span>{' '}
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
          <StatCard icon={Activity} label="Active Sessions" value={activeSessions} subtitle={`${sessionList.length} total`} color="text-green-400" />
          <StatCard icon={MessageSquare} label="Messages Today" value={totalMessages} subtitle="across all sessions" color="text-blue-400" />
          <StatCard icon={Clock} label="Cron Jobs" value={activeCron} subtitle={`${cronJobs.length} total`} color="text-orange-400" loading={cronLoading && cronJobs.length === 0} />
          <StatCard icon={Users} label="Sub-agents" value={subagentCount} subtitle="spawned from sessions" color="text-purple-400" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <h3 className="font-semibold text-sm">Recent Activity</h3>
            </div>
            {sessionsLoading && (
              <span className="text-[10px] text-gray-500 font-mono animate-pulse">refreshing...</span>
            )}
          </div>
          {isInitialLoad ? (
            <SkeletonActivityFeed />
          ) : (
            <div className="divide-y divide-gray-800/50 max-h-[420px] overflow-y-auto">
              {activityFeed.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500 text-sm">
                  No recent activity
                </div>
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

        {/* Session Status + Cost */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-sm">Usage & Cost</h3>
          </div>
          <div className="p-6 space-y-5">
            {statusLoading && !sessionStatus ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <div className="h-3 w-20 bg-gray-800 rounded animate-pulse mb-2" />
                    <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : sessionStatus ? (
              <>
                {/* Model */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Model</p>
                  <p className="font-mono text-sm text-gray-200">{sessionStatus.model || '\u2014'}</p>
                </div>

                {/* Token bars */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Input Tokens</p>
                    <span className="text-xs font-mono text-gray-400">{sessionStatus.inputTokens?.toLocaleString() ?? '0'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-blue-400">{formatTokens(sessionStatus.inputTokens || 0)}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all" style={{ width: `${Math.min(((sessionStatus.inputTokens || 0) / 200000) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Output Tokens</p>
                    <span className="text-xs font-mono text-gray-400">{sessionStatus.outputTokens?.toLocaleString() ?? '0'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-green-400">{formatTokens(sessionStatus.outputTokens || 0)}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all" style={{ width: `${Math.min(((sessionStatus.outputTokens || 0) / 32000) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>

                {/* Cost section */}
                {sessionStatus.cost != null && (
                  <div className="border-t border-gray-800 pt-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Cost Breakdown</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Session Cost</p>
                        <p className="text-lg font-bold text-yellow-400">${sessionStatus.cost.toFixed(4)}</p>
                      </div>
                      {costPer1k != null && (
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase mb-1">Per 1K Tokens</p>
                          <p className="text-lg font-bold text-orange-400">${costPer1k.toFixed(4)}</p>
                        </div>
                      )}
                    </div>
                    {sessionStatus.dailyCost != null && (
                      <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase mb-1">Est. Daily Cost</p>
                          <p className="text-lg font-bold text-red-400">${sessionStatus.dailyCost.toFixed(2)}</p>
                        </div>
                        <TrendingUp className="w-5 h-5 text-red-400/50" />
                      </div>
                    )}
                  </div>
                )}

                {/* Total tokens summary */}
                <div className="border-t border-gray-800 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Total Tokens</span>
                    <span className="font-mono text-gray-300 font-medium">{totalTokens.toLocaleString()}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 text-sm py-8">No session data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
