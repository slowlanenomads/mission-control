import React from 'react'
import { Settings, Server, Radio, Cpu, Shield, Globe } from 'lucide-react'

interface ConfigItem {
  label: string
  value: string
  mono?: boolean
}

function ConfigSection({ title, icon: Icon, items }: { title: string; icon: React.ComponentType<any>; items: ConfigItem[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-gray-800/50">
        {items.map((item: ConfigItem, i: number) => (
          <div key={i} className="px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-400">{item.label}</span>
            <span className={`text-sm text-gray-200 ${item.mono ? 'font-mono' : ''}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Settings &amp; Info</h2>
        <p className="text-sm text-gray-500 mt-0.5">Gateway configuration and system information</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConfigSection title="Gateway" icon={Server} items={[
          { label: 'Version', value: '1.x', mono: true },
          { label: 'Port', value: '18789', mono: true },
          { label: 'API Endpoint', value: 'http://127.0.0.1:18789', mono: true },
          { label: 'Status', value: 'Running' },
        ]} />
        <ConfigSection title="Model" icon={Cpu} items={[
          { label: 'Default Model', value: 'claude-opus-4-5', mono: true },
          { label: 'Provider', value: 'Anthropic' },
          { label: 'Max Tokens', value: '200,000', mono: true },
          { label: 'Thinking', value: 'Enabled' },
        ]} />
        <ConfigSection title="Channels" icon={Radio} items={[
          { label: 'Primary Channel', value: 'Telegram' },
          { label: 'Capabilities', value: 'inlineButtons' },
          { label: 'Heartbeat', value: 'Enabled' },
          { label: 'Cron', value: 'Enabled' },
        ]} />
        <ConfigSection title="Security" icon={Shield} items={[
          { label: 'Auth', value: 'Bearer Token' },
          { label: 'CORS', value: 'Enabled' },
          { label: 'Password Store', value: 'GPG Encrypted' },
        ]} />
        <ConfigSection title="Dashboard" icon={Globe} items={[
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
