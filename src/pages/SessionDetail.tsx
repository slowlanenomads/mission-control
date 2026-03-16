import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

interface UsageInfo {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: number
  cacheHitRate: number
}

interface ContentPart {
  type: 'text' | 'toolCall' | 'toolResult' | 'thinking'
  text?: string
  name?: string
  id?: string
  toolCallId?: string
  arguments?: string
}

interface Message {
  role: string
  timestamp: string
  id: string
  content: ContentPart[]
  usage?: UsageInfo
  cumulative?: { tokens: number; cost: number }
}

interface ToolBreakdown {
  name: string
  count: number
  totalTokensOut: number
}

interface TranscriptData {
  session: {
    id: string
    startedAt: string
    completedAt: string
    model: string
    thinkingLevel: string
    durationMs: number
    deleted: boolean
  }
  stats: {
    messageCount: number
    userMessages: number
    assistantMessages: number
    toolResultMessages: number
    toolCallCount: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheRead: number
    totalCacheWrite: number
    totalTokens: number
    totalCost: number
    overallCacheHitRate: number
    toolBreakdown: ToolBreakdown[]
  }
  messages: Message[]
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return `${m}m ${rs}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n: number) {
  return `$${n.toFixed(4)}`
}

function formatTime(ts: string) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      hour12: true,
    })
  } catch { return ts }
}

function relativeTime(ts1: string, ts2: string) {
  try {
    const ms = new Date(ts2).getTime() - new Date(ts1).getTime()
    return formatDuration(Math.max(0, ms))
  } catch { return '' }
}

const roleColors: Record<string, string> = {
  user: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  assistant: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  toolResult: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  unknown: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
}

const roleLabels: Record<string, string> = {
  user: '👤 User',
  assistant: '🤖 Assistant',
  toolResult: '🔧 Tool Result',
}

export default function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<TranscriptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set())
  const [showTools, setShowTools] = useState(true)
  const [showThinking, setShowThinking] = useState(false)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    fetch(`/api/transcript/${sessionId}`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  const toggleExpand = (idx: number) => {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const expandAll = () => {
    if (!data) return
    setExpandedMessages(new Set(data.messages.map((_, i) => i)))
  }

  const collapseAll = () => setExpandedMessages(new Set())

  // Search functionality
  const getMessageText = (message: Message): string => {
    return message.content?.map(part => part.text || '').join(' ') || ''
  }

  const highlightText = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm.trim()) return text
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : part
    )
  }

  if (loading) return <div className="p-8 text-gray-400">Loading transcript...</div>
  if (error) return <div className="p-8 text-red-400">Error: {error}</div>
  if (!data) return <div className="p-8 text-gray-400">No data</div>

  const { session, stats, messages } = data
  
  // Filter messages based on search
  const filteredMessages = searchText.trim() 
    ? messages.filter((message, index) => {
        const messageText = getMessageText(message).toLowerCase()
        return messageText.includes(searchText.toLowerCase())
      })
    : messages

  const filteredIndices = searchText.trim()
    ? messages.map((message, index) => {
        const messageText = getMessageText(message).toLowerCase()
        return messageText.includes(searchText.toLowerCase()) ? index : -1
      }).filter(index => index !== -1)
    : messages.map((_, index) => index)

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/subagents')}
        className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1"
      >
        ← Back to Sub-Agents
      </button>

      {/* Header */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h1 className="text-lg font-semibold text-white">Session Detail</h1>
          <code className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">{session.id}</code>
          {session.deleted && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">DELETED</span>}
          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">{session.model}</span>
          {session.thinkingLevel && (
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">thinking: {session.thinkingLevel}</span>
          )}
        </div>
        <div className="text-xs text-gray-400">
          Started: {formatTime(session.startedAt)} → Completed: {formatTime(session.completedAt)} • Duration: {formatDuration(session.durationMs)}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        <StatCard label="Messages" value={String(stats.messageCount)} />
        <StatCard label="User Msgs" value={String(stats.userMessages)} />
        <StatCard label="Assistant Msgs" value={String(stats.assistantMessages)} />
        <StatCard label="Tool Calls" value={String(stats.toolCallCount)} />
        <StatCard label="Total Tokens" value={formatTokens(stats.totalTokens)} />
        <StatCard label="Total Cost" value={formatCost(stats.totalCost)} />
        <StatCard label="Input Tokens" value={formatTokens(stats.totalInputTokens)} />
        <StatCard label="Output Tokens" value={formatTokens(stats.totalOutputTokens)} />
        <StatCard label="Cache Read" value={formatTokens(stats.totalCacheRead)} />
        <StatCard label="Cache Write" value={formatTokens(stats.totalCacheWrite)} />
        <StatCard label="Cache Hit %" value={`${stats.overallCacheHitRate}%`} />
        <StatCard label="Duration" value={formatDuration(session.durationMs)} />
      </div>

      {/* Tool Breakdown */}
      {stats.toolBreakdown.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-2">Tool Usage Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {stats.toolBreakdown.map(t => (
              <div key={t.name} className="bg-gray-900/50 rounded px-3 py-2">
                <div className="text-xs text-amber-400 font-mono">{t.name}</div>
                <div className="text-sm text-white">{t.count} calls</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={expandAll} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-gray-300">
          Expand All
        </button>
        <button onClick={collapseAll} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-gray-300">
          Collapse All
        </button>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showTools} onChange={e => setShowTools(e.target.checked)} className="rounded" />
          Show tool calls
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showThinking} onChange={e => setShowThinking(e.target.checked)} className="rounded" />
          Show thinking
        </label>
        <span className="ml-auto text-xs text-gray-500">
          {searchText.trim() ? `${filteredMessages.length} of ${messages.length}` : `${messages.length}`} messages
        </span>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search messages..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 pr-8"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchText.trim() && (
          <span className="text-xs text-gray-400">
            {filteredMessages.length} results
          </span>
        )}
      </div>

      {/* Message Timeline */}
      <div className="space-y-1">
        {filteredMessages.map((msg, filteredIdx) => {
          const idx = filteredIndices[filteredIdx]
          // Filter tool results if hidden
          if (!showTools && msg.role === 'toolResult') return null
          // Check if this message is only tool calls
          const hasOnlyToolCalls = msg.content?.every((p: ContentPart) => p.type === 'toolCall')
          if (!showTools && hasOnlyToolCalls) return null

          const expanded = expandedMessages.has(idx)
          const colorClass = roleColors[msg.role] || roleColors.unknown
          const prevTs = idx > 0 ? messages[idx - 1].timestamp : session.startedAt
          const elapsed = relativeTime(prevTs, msg.timestamp)

          return (
            <div key={idx} className={`border rounded-lg ${colorClass} transition-all`}>
              {/* Message header — always visible */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5"
                onClick={() => toggleExpand(idx)}
              >
                <span className="text-[10px] w-5 text-center opacity-60">{expanded ? '▼' : '▶'}</span>
                <span className="text-xs font-medium w-24 shrink-0">{roleLabels[msg.role] || msg.role}</span>
                <span className="text-xs text-gray-400 w-36 shrink-0">{formatTime(msg.timestamp)}</span>
                {elapsed && <span className="text-[10px] text-gray-500">+{elapsed}</span>}

                {/* Preview */}
                <span className="text-xs text-gray-400 flex-1 truncate">
                  {msg.content?.map((p: ContentPart) => {
                    if (p.type === 'text') {
                      const preview = p.text?.slice(0, 100) || ''
                      return searchText.trim() ? highlightText(preview, searchText) : preview
                    }
                    if (p.type === 'toolCall') return `🔧 ${p.name}`
                    if (p.type === 'toolResult') return `📋 result`
                    if (p.type === 'thinking') return `💭 thinking`
                    return ''
                  }).filter(Boolean).reduce((acc, curr, idx) => {
                    if (idx === 0) return curr
                    return <>{acc} | {curr}</>
                  }, '' as React.ReactNode)}
                </span>

                {/* Usage badge */}
                {msg.usage && (
                  <div className="flex gap-2 shrink-0 text-[10px] text-gray-500">
                    <span>↓{formatTokens(msg.usage.input + msg.usage.cacheRead)}</span>
                    <span>↑{formatTokens(msg.usage.output)}</span>
                    <span>{formatCost(msg.usage.cost)}</span>
                    <span className="text-cyan-400/60">{msg.usage.cacheHitRate}% cache</span>
                  </div>
                )}
              </div>

              {/* Expanded content */}
              {expanded && (
                <div className="px-3 pb-3 border-t border-white/10">
                  {msg.content?.map((part: ContentPart, pi: number) => {
                    if (part.type === 'thinking' && !showThinking) return null
                    return (
                      <div key={pi} className="mt-2">
                        {part.type === 'text' && (
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                            {searchText.trim() ? highlightText(part.text || '', searchText) : part.text}
                          </pre>
                        )}
                        {part.type === 'toolCall' && (
                          <div className="bg-gray-900/60 rounded p-2">
                            <div className="text-xs text-amber-400 font-mono mb-1">🔧 {part.name}</div>
                            <pre className="text-[10px] text-gray-500 whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
                              {part.arguments}
                            </pre>
                          </div>
                        )}
                        {part.type === 'toolResult' && showTools && (
                          <div className="bg-gray-900/40 rounded p-2">
                            <div className="text-[10px] text-gray-500 mb-1">📋 Tool Result</div>
                            <pre className="text-[10px] text-gray-500 whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
                              {part.text}
                            </pre>
                          </div>
                        )}
                        {part.type === 'thinking' && showThinking && (
                          <div className="bg-cyan-900/20 rounded p-2">
                            <div className="text-[10px] text-cyan-400 mb-1">💭 Thinking</div>
                            <pre className="text-[10px] text-cyan-300/60 whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
                              {part.text}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Usage details */}
                  {msg.usage && (
                    <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-500 border-t border-white/5 pt-2">
                      <span>Input: {msg.usage.input.toLocaleString()}</span>
                      <span>Output: {msg.usage.output.toLocaleString()}</span>
                      <span>Cache Read: {msg.usage.cacheRead.toLocaleString()}</span>
                      <span>Cache Write: {msg.usage.cacheWrite.toLocaleString()}</span>
                      <span>Total: {msg.usage.totalTokens.toLocaleString()}</span>
                      <span>Cost: {formatCost(msg.usage.cost)}</span>
                      <span className="text-cyan-400/60">Cache: {msg.usage.cacheHitRate}%</span>
                      {msg.cumulative && (
                        <>
                          <span className="border-l border-gray-600 pl-3">Cumulative: {formatTokens(msg.cumulative.tokens)}</span>
                          <span>Running Cost: {formatCost(msg.cumulative.cost)}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  )
}
