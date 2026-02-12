import React, { useState } from 'react'
import { MessageSquare, ChevronDown, ChevronRight, RefreshCw, Send } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { SkeletonSessionRow } from '../components/Skeleton'
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
  model?: string
}

interface HistoryMessage {
  role: string
  content: string
  timestamp: string
}

function kindColor(kind: string): string {
  if (kind === 'main') return 'blue'
  if (kind === 'subagent') return 'purple'
  if (kind === 'cron') return 'orange'
  return 'gray'
}

function statusColor(status: string): string {
  if (status === 'active') return 'green'
  if (status === 'idle') return 'yellow'
  return 'gray'
}

function SessionRow({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false)
  const [msgText, setMsgText] = useState('')
  const { toast } = useToast()
  const sendAction = useAction()
  const { data: history, loading: historyLoading } = useApi<any>(
    expanded ? `/api/sessions/${encodeURIComponent(session.sessionKey)}/history` : null
  )

  const messages: HistoryMessage[] = Array.isArray(history) ? history : (history as any)?.messages ?? []

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!msgText.trim()) return
    const res = await sendAction.execute(`/api/sessions/${encodeURIComponent(session.sessionKey)}/send`, {
      method: 'POST',
      body: JSON.stringify({ message: msgText.trim() }),
    })
    if (res.ok) {
      toast(`Message sent to ${session.sessionKey.slice(0, 25)}...`)
      setMsgText('')
    } else {
      toast(`Failed: ${res.error}`, 'error')
    }
  }

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
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
            <span className="font-mono text-sm text-gray-200 truncate max-w-[200px] sm:max-w-[300px]">{session.sessionKey}</span>
            <StatusBadge color={kindColor(session.kind)}>{session.kind}</StatusBadge>
            <StatusBadge color={statusColor(session.status)} dot>{session.status}</StatusBadge>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500">
            <span>{session.messageCount} messages</span>
            {session.model && <span className="font-mono">{session.model}</span>}
            {session.lastActivity && (
              <span>{formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })}</span>
            )}
          </div>
        </div>
        <MessageSquare className="w-4 h-4 text-gray-600 hidden sm:block" />
      </button>
      {expanded && (
        <div className="border-t border-gray-800 bg-gray-950/50">
          {/* Send message */}
          <form onSubmit={handleSend} className="px-5 py-3 border-b border-gray-800/50 flex gap-2">
            <input
              type="text"
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              placeholder="Send a message to this session..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <button
              type="submit"
              disabled={sendAction.loading || !msgText.trim()}
              className="px-3 py-2 bg-blue-600 border border-blue-500 rounded-lg text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <Send className={`w-4 h-4 ${sendAction.loading ? 'animate-pulse' : ''}`} />
            </button>
          </form>

          {historyLoading ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500 animate-pulse">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">No messages found</div>
          ) : (
            <div className="divide-y divide-gray-800/50 max-h-[400px] overflow-y-auto">
              {messages.slice(0, 30).map((msg, i) => (
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
  const { data: sessions, loading, error, refetch } = useApi<any>('/api/sessions', { interval: 30000 })
  const sessionList: Session[] = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Sessions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {sessionList.length > 0 ? `${sessionList.length} session${sessionList.length !== 1 ? 's' : ''} active` : 'Browse and inspect active sessions'}
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {error && !sessions ? (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-8 text-center">
          <p className="text-sm text-red-400 mb-1">Failed to load sessions</p>
          <p className="text-xs text-gray-500 font-mono mb-4">{error}</p>
          <button onClick={refetch} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-700 transition-colors">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : loading && sessionList.length === 0 ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <SkeletonSessionRow key={i} />)}
        </div>
      ) : sessionList.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No active sessions</p>
          <p className="text-xs text-gray-600 mt-1">Sessions appear here when the agent is running</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessionList.map(session => (
            <SessionRow key={session.sessionKey} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}
