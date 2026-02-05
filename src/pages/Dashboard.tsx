import React from 'react'
import { Activity, MessageSquare, Clock, Users, Zap, Cpu } from 'lucide-react'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
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
  sessionKey?: string
}

function kindColor(kind: string): 'blue' | 'purple' | 'orange' | 'gray' {
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

export default function Dashboard() {
  const { data: sessions, loading: sessionsLoading } = useApi<Session[]>('/api/sessions', { interval: 15000 })
  const { data: sessionStatus } = useApi<SessionStatus>('/api/session-status', { interval: 30000 })
  const { data: cronData } = useApi<any>('/api/cron', { interval: 60000 })

  const sessionList: Session[] = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []
  const activeSessions = sessionList.filter(s => s.status === 'active').length
  const totalMessages = sessionList.reduce((sum, s) => sum + (s.messageCount || 0), 0)
  const cronJobs = Array.isArray(cronData) ? cronData : (cronData as any)?.jobs ?? []
  const activeCron = cronJobs.filter((j: any) => j.enabled !== false).length
  const subagentCount = sessionList.filter(s => s.kind === 'subagent').length

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 bg-gray-900 border border-gray-800 rounded-xl px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 pulse-dot" />
          <span className="text-sm font-medium text-green-400">Online</span>
        </div>
        <div className="w-px h-5 bg-gray-700" />
        <div className="text-sm text-gray-400">
          <span className="text-gray-500">Model:</span>{' '}
          <span className="font-mono text-gray-300">{sessionStatus?.model || 'claude-opus-4-5'}</span>
        </div>
        <div className="w-px h-5 bg-gray-700" />
        <div className="text-sm text-gray-400">
          <span className="text-gray-500">Sessions:</span>{' '}
          <span className="font-mono text-gray-300">{sessionList.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Active Sessions" value={activeSessions} subtitle={`${sessionList.length} total`} color="text-green-400" />
        <StatCard icon={MessageSquare} label="Messages Today" value={totalMessages} subtitle="across all sessions" color="text-blue-400" />
        <StatCard icon={Clock} label="Cron Jobs" value={activeCron} subtitle={`${cronJobs.length} total`} color="text-orange-400" />
        <StatCard icon={Users} label="Sub-agents" value={subagentCount} subtitle="spawned from sessions" color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
          <div className="divide-y divide-gray-800/50 max-h-[420px] overflow-y-auto">
            {activityFeed.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500 text-sm">
                {sessionsLoading ? 'Loading activity...' : 'No recent activity'}
              </div>
            ) : (
              activityFeed.map((item, i) => (
                <div key={`${item.sessionKey}-${i}`} className={`px-6 py-3 border-l-2 ${kindAccent(item.kind)} hover:bg-gray-800/30 transition-colors`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge color={kindColor(item.kind)} dot>{item.kind}</StatusBadge>
                      <span className="text-xs text-gray-500 font-mono">{item.sessionKey.slice(0, 20)}...</span>
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
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-sm">Session Status</h3>
          </div>
          <div className="p-6 space-y-5">
            {sessionStatus ? (
              <>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Model</p>
                  <p className="font-mono text-sm text-gray-200">{sessionStatus.model || '\u2014'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Input Tokens</p>
                  <span className="text-2xl font-bold text-blue-400">{sessionStatus.inputTokens?.toLocaleString() ?? '\u2014'}</span>
                  <div className="mt-2 w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(((sessionStatus.inputTokens || 0) / 200000) * 100, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Output Tokens</p>
                  <span className="text-2xl font-bold text-green-400">{sessionStatus.outputTokens?.toLocaleString() ?? '\u2014'}</span>
                  <div className="mt-2 w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(((sessionStatus.outputTokens || 0) / 32000) * 100, 100)}%` }} />
                  </div>
                </div>
                {sessionStatus.cost != null && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estimated Cost</p>
                    <p className="text-xl font-bold text-yellow-400">${sessionStatus.cost.toFixed(4)}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-500 text-sm py-8">Loading session data...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
