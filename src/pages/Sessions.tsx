import React, { useState } from 'react'
import { MessageSquare, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'
import { formatDistanceToNow } from 'date-fns'

interface Session {
  sessionKey: string
  kind: string
  status: string
  lastActivity: string
  messageCount: number
  model?: string
}

interface HistoryMessage {
  role: string
  content: string
  timestamp: string
}

function kindColor(kind: string): 'blue' | 'purple' | 'orange' | 'gray' {
  if (kind === 'main') return 'blue'
  if (kind === 'subagent') return 'purple'
  if (kind === 'cron') return 'orange'
  return 'gray'
}

function statusColor(status: string): 'green' | 'yellow' | 'gray' {
  if (status === 'active') return 'green'
  if (status === 'idle') return 'yellow'
  return 'gray'
}

function SessionRow({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false)
  const { data: history, loading: historyLoading } = useApi<any>(
    expanded ? `/api/sessions/${encodeURIComponent(session.sessionKey)}/history` : null
  )

  const messages: HistoryMessage[] = Array.isArray(history) ? history : (history as any)?.messages ?? []

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900 hover:border-gray-700 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-gray-500">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-sm text-gray-200 truncate max-w-[300px]">{session.sessionKey}</span>
            <StatusBadge color={kindColor(session.kind)}>{session.kind}</StatusBadge>
            <StatusBadge color={statusColor(session.status)} dot>{session.status}</StatusBadge>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{session.messageCount} messages</span>
            {session.model && <span className="font-mono">{session.model}</span>}
            {session.lastActivity && (
              <span>{formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })}</span>
            )}
          </div>
        </div>
        <MessageSquare className="w-4 h-4 text-gray-600" />
      </button>
      {expanded && (
        <div className="border-t border-gray-800 bg-gray-950/50">
          {historyLoading ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500 animate-pulse">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">No messages found</div>
          ) : (
            <div className="divide-y divide-gray-800/50 max-h-[400px] overflow-y-auto">
              {messages.slice(0, 30).map((msg: HistoryMessage, i: number) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono font-medium ${msg.role === 'user' ? 'text-blue-400' : msg.role === 'assistant' ? 'text-green-400' : 'text-gray-500'}`}>
                      {msg.role}
                    </span>
                    {msg.timestamp && (
                      <span className="text-[10px] text-gray-600 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                    {(msg.content || '').slice(0, 500)}{(msg.content || '').length > 500 ? '...' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Sessions() {
  const { data: sessions, loading, refetch } = useApi<any>('/api/sessions', { interval: 30000 })
  const sessionList: Session[] = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Sessions</h2>
          <p className="text-sm text-gray-500 mt-0.5">Browse and inspect active sessions</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {loading && sessionList.length === 0 ? (
        <div className="text-center py-20 text-gray-500">Loading sessions...</div>
      ) : sessionList.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No sessions found</div>
      ) : (
        <div className="space-y-3">
          {sessionList.map((session: Session) => (
            <SessionRow key={session.sessionKey} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}
