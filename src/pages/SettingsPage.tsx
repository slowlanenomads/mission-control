import React, { useState } from 'react'
import { Settings, Server, Radio, Cpu, Shield, Globe, Key, Eye, EyeOff, Activity, Info } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { Skeleton } from '../components/Skeleton'

interface GatewayConfig {
  version?: string
  model?: string
  defaultModel?: string
  provider?: string
  channel?: string
  channels?: string[]
  capabilities?: string
  thinking?: string
  maxTokens?: number
  heartbeat?: boolean | string
  cron?: boolean | string
  [key: string]: any
}

interface GatewayStatus {
  ok?: boolean
  status?: string
  error?: string
  version?: string
  os?: string
  nodeVersion?: string
  port?: number
  uptime?: number
}

interface ConfigItem {
  label: string
  value: string
  mono?: boolean
}

interface VersionInfo {
  openclaw: string
  node: string
  mc: string
}

interface LiveSessionStatus {
  raw?: string
  model?: string
  version?: string
  commit?: string
  tokens?: { input: number; output: number; total: number }
  cache?: { hitPercent: number; cachedTokens: number; newTokens: number }
  context?: { used: number; max: number; percent: number; compactions: number }
  usage?: { windowPercentLeft: number; windowTimeLeft: string; weekPercentLeft: number; weekTimeLeft: string }
  runtime?: { mode: string; thinking: string; elevated: boolean }
  queue?: { name: string; depth: number }
  updated?: string
}

function formatTokens(n?: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function LiveStatusCompact({ status, loading }: { status?: LiveSessionStatus; loading?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold">Live Session Status</h3>
        </div>
        {status?.updated && <span className="text-[11px] text-gray-400 font-mono bg-gray-800/70 px-2 py-0.5 rounded">updated {status.updated}</span>}
      </div>
      <div className="p-6">
        {loading && !status ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        ) : status ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Model</p>
              <p className="text-sm text-gray-200 font-mono break-all">{status.model || '—'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Tokens</p>
                <p className="text-sm font-bold text-cyan-400">{formatTokens(status.tokens?.total)}</p>
                <p className="text-[10px] text-gray-500">{formatTokens(status.tokens?.input)} in / {formatTokens(status.tokens?.output)} out</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-[10px] text-gray-500 uppercase">Context</p>
                  <span title="How full the current model context window is.">
                    <Info className="w-3 h-3 text-gray-600" />
                  </span>
                </div>
                <p className={`text-sm font-bold ${
                  (status.context?.percent || 0) >= 75 ? 'text-red-400' :
                  (status.context?.percent || 0) >= 55 ? 'text-yellow-400' : 'text-cyan-400'
                }`}>{status.context?.percent ?? 0}%</p>
                <p className="text-[10px] text-gray-500">{formatTokens(status.context?.used)} / {formatTokens(status.context?.max)}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Cache</p>
                <p className="text-sm font-bold text-green-400">{status.cache?.hitPercent ?? 0}% hit</p>
                <p className="text-[10px] text-gray-500">{formatTokens(status.cache?.cachedTokens)} cached</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Remaining</p>
                <p className="text-sm font-bold text-green-400">{status.usage?.windowPercentLeft ?? 0}%</p>
                <p className="text-[10px] text-gray-500">{status.usage?.windowTimeLeft || '—'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {status.runtime && <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">{status.runtime.mode} · think {status.runtime.thinking}</span>}
              {status.queue && <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">queue {status.queue.name} ({status.queue.depth})</span>}
              {!!status.context?.compactions && <span className="text-[10px] bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded font-mono">{status.context.compactions} compactions</span>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No live status available</p>
        )}
      </div>
    </div>
  )
}

function ConfigSection({ title, icon: Icon, items, loading }: { title: string; icon: React.ComponentType<any>; items: ConfigItem[]; loading?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-gray-800/50">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="px-6 py-3 flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))
        ) : (
          items.map((item: ConfigItem, i: number) => (
            <div key={i} className="px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">{item.label}</span>
              <span className={`text-sm text-gray-200 ${item.mono ? 'font-mono' : ''}`}>{item.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function PasswordChangeSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [isChanging, setIsChanging] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match')
      return
    }

    setIsChanging(true)
    setMessage('')

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => setIsOpen(false), 2000)
      } else {
        setMessage(data.error || 'Failed to change password')
      }
    } catch (error) {
      setMessage('Network error occurred')
    } finally {
      setIsChanging(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
        <Key className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold">Change Password</h3>
      </div>
      <div className="p-6">
        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Change Password
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Confirm New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="flex items-center gap-2 px-3 py-1 text-xs text-gray-400 hover:text-gray-300"
              >
                {showPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showPasswords ? 'Hide' : 'Show'} passwords
              </button>
            </div>
            {message && (
              <div className={`text-sm ${message.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                {message}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isChanging}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                {isChanging ? 'Changing...' : 'Change Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setMessage('')
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
            <div className="text-xs text-gray-500">
              Password must be at least 8 characters.
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { data: config, loading: configLoading } = useApi<GatewayConfig>('/api/gateway/config', { interval: 60000 })
  const { data: status, loading: statusLoading } = useApi<GatewayStatus>('/api/gateway/status', { interval: 15000 })
  const { data: versionInfo, loading: versionLoading } = useApi<VersionInfo>('/api/system/version', { interval: 120000 })
  const { data: liveStatus, loading: liveStatusLoading } = useApi<LiveSessionStatus>('/api/session-status-live', { interval: 30000 })

  const isConnected = status?.ok === true
  const isLoading = configLoading || statusLoading

  const model = config?.defaultModel || config?.model || 'Unknown'
  const version = config?.version || 'Unknown'
  const channel = config?.channel || (config?.channels ? config.channels.join(', ') : 'Unknown')
  const capabilities = config?.capabilities || 'Unknown'
  const thinking = config?.thinking || 'Unknown'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Settings &amp; Info</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gateway configuration and system information</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-400 pulse-dot' : statusLoading ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
          <span className={`text-sm font-medium ${isConnected ? 'text-green-400' : statusLoading ? 'text-yellow-400' : 'text-red-400'}`}>
            {isConnected ? 'Connected' : statusLoading ? 'Checking...' : 'Disconnected'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConfigSection title="Gateway" icon={Server} loading={isLoading && !config} items={[
          { label: 'Version', value: version, mono: true },
          { label: 'Port', value: status?.port ? String(status.port) : '18789', mono: true },
          { label: 'API Endpoint', value: `http://127.0.0.1:${status?.port || 18789}`, mono: true },
          { label: 'Status', value: isConnected ? 'Running' : 'Unknown' },
        ]} />
        <ConfigSection title="Model" icon={Cpu} loading={isLoading && !config} items={[
          { label: 'Default Model', value: model, mono: true },
          { label: 'Provider', value: model.includes('claude') ? 'Anthropic' : model.includes('gpt') ? 'OpenAI' : 'Unknown' },
          { label: 'Thinking', value: thinking },
        ]} />
        <ConfigSection title="Channels" icon={Radio} loading={isLoading && !config} items={[
          { label: 'Primary Channel', value: channel },
          { label: 'Capabilities', value: capabilities },
          { label: 'Heartbeat', value: config?.heartbeat != null ? String(config.heartbeat) : 'Unknown' },
          { label: 'Cron', value: config?.cron != null ? String(config.cron) : 'Unknown' },
        ]} />
        <ConfigSection title="Security" icon={Shield} items={[
          { label: 'Auth', value: 'Bearer Token' },
          { label: 'CORS', value: 'Enabled' },
          { label: 'Password Store', value: 'GPG Encrypted' },
        ]} />
        <ConfigSection title="Dashboard" icon={Globe} items={[
          { label: 'Version', value: versionInfo?.mc || '0.3.0', mono: true },
          { label: 'Dashboard Port', value: '3333', mono: true },
          { label: 'Frontend', value: 'React + Vite + Tailwind' },
          { label: 'Backend', value: 'Express + TSX' },
          { label: 'Auto-refresh', value: '15-30s intervals' },
        ]} />
        <ConfigSection title="Environment" icon={Settings} loading={versionLoading && !versionInfo} items={[
          { label: 'OpenClaw Version', value: versionInfo?.openclaw || 'Unknown', mono: true },
          { label: 'Node.js', value: versionInfo?.node || status?.nodeVersion || config?.nodeVersion || 'v22.22.0', mono: true },
          { label: 'OS', value: status?.os || config?.os || 'Linux 6.8.0 (x64)', mono: true },
          { label: 'Workspace', value: config?.workspace || '/root/.openclaw/workspace', mono: true },
        ]} />
        <div className="lg:col-span-2">
          <LiveStatusCompact status={liveStatus} loading={liveStatusLoading} />
        </div>
        <div className="lg:col-span-2">
          <PasswordChangeSection />
        </div>
      </div>
    </div>
  )
}
