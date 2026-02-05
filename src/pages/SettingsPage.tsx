import React from 'react'
import { Settings, Server, Radio, Cpu, Shield, Globe } from 'lucide-react'
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
}

interface ConfigItem {
  label: string
  value: string
  mono?: boolean
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

export default function SettingsPage() {
  const { data: config, loading: configLoading } = useApi<GatewayConfig>('/api/gateway/config', { interval: 60000 })
  const { data: status, loading: statusLoading } = useApi<GatewayStatus>('/api/gateway/status', { interval: 15000 })

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
          { label: 'Port', value: '18789', mono: true },
          { label: 'API Endpoint', value: 'http://127.0.0.1:18789', mono: true },
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
          { label: 'Version', value: '0.2.0', mono: true },
          { label: 'Dashboard Port', value: '3333', mono: true },
          { label: 'Frontend', value: 'React + Vite + Tailwind' },
          { label: 'Backend', value: 'Express + TSX' },
          { label: 'Auto-refresh', value: '15-30s intervals' },
        ]} />
        <ConfigSection title="Environment" icon={Settings} items={[
          { label: 'OS', value: 'Linux 6.8.0 (x64)', mono: true },
          { label: 'Node.js', value: 'v22.22.0', mono: true },
          { label: 'Workspace', value: '/root/clawd', mono: true },
          { label: 'Timezone', value: 'UTC (display: EST)' },
        ]} />
      </div>
    </div>
  )
}
