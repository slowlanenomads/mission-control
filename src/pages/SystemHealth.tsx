import React, { useState, useEffect, useRef } from 'react'
import { Server, Activity, HardDrive, RefreshCw, RotateCw, AlertTriangle, Cpu, Info } from 'lucide-react'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import { useApi } from '../hooks/useApi'
import { useAction } from '../hooks/useAction'
import { useToast } from '../components/Toast'

interface SystemHealthData {
  services: Array<{
    name: string
    status: 'active' | 'inactive'
  }>
  cpu: {
    cores: number
    model: string
    loadAvg: {
      '1m': number
      '5m': number
      '15m': number
    }
  }
  memory: {
    total: number
    used: number
    free: number
    percent: number
  }
  disk: {
    total: number
    used: number
    available: number
    percent: number
  }
  uptime: number // seconds
}

interface LogData {
  lines: Array<{
    timestamp: string
    message: string
  }>
}

interface LiveSessionStatus {
  raw?: string
  model?: string
  version?: string
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

const SERVICES = ['empire-backend', 'empire-backend-dev', 'mission-control', 'nginx', 'openclaw-gateway']

function formatBytes(bytes: number): string {
  return (bytes / 1073741824).toFixed(1) + ' GB'
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function getUtilizationBar(value: number, max: number, color: string = 'blue'): JSX.Element {
  const percentage = Math.min((value / max) * 100, 100)
  const colorClass = color === 'red' ? 'from-red-600 to-red-400' : 
                    color === 'yellow' ? 'from-yellow-600 to-yellow-400' :
                    'from-blue-600 to-blue-400'
  
  return (
    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
      <div 
        className={`h-full bg-gradient-to-r ${colorClass} rounded-full transition-all`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export default function SystemHealth() {
  const { data: systemHealth, loading: healthLoading } = useApi<SystemHealthData>('/api/system/health', { interval: 10000 })
  const { data: liveStatus, loading: liveStatusLoading } = useApi<LiveSessionStatus>('/api/session-status-live', { interval: 30000 })
  const { toast } = useToast()
  const restartAction = useAction()
  const [restartConfirm, setRestartConfirm] = useState<string | null>(null)
  
  // Log viewer state
  const [selectedService, setSelectedService] = useState('empire-backend')
  const [selectedLines, setSelectedLines] = useState(100)
  const { data: logData, loading: logLoading, refetch: refetchLogs } = useApi<LogData>(`/api/system/logs/${selectedService}?lines=${selectedLines}`)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current && logData?.lines) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logData?.lines])

  const handleRestart = async (serviceName: string) => {
    const res = await restartAction.execute(`/api/system/restart/${serviceName}`, { method: 'POST' })
    toast(res.ok ? `${serviceName} restart initiated` : `Restart failed: ${res.error}`, res.ok ? 'success' : 'error')
    setRestartConfirm(null)
  }

  const handleLogRefresh = () => {
    refetchLogs()
    toast('Logs refreshed', 'success')
  }

  if (healthLoading && !systemHealth) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Server className="w-6 h-6 text-cyan-400" />
          <h1 className="text-2xl font-bold text-gray-100">System Health</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
              <div className="h-4 w-24 bg-gray-800 rounded mb-2" />
              <div className="h-6 w-16 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const services = systemHealth?.services || []
  const cpu = systemHealth?.cpu
  const memory = systemHealth?.memory
  const disk = systemHealth?.disk
  const uptime = systemHealth?.uptime

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Server className="w-6 h-6 text-cyan-400" />
        <h1 className="text-2xl font-bold text-gray-100">System Health</h1>
      </div>

      {/* Service Status Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Service Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {SERVICES.map(serviceName => {
            const service = services.find(s => s.name === serviceName)
            const isActive = service?.status === 'active'
            const canRestart = serviceName !== 'openclaw-gateway'
            
            return (
              <div key={serviceName} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-200 truncate">{serviceName}</h3>
                  <StatusBadge color={isActive ? 'green' : 'red'} dot>
                    {isActive ? 'active' : 'inactive'}
                  </StatusBadge>
                </div>
                {canRestart && (
                  <button
                    onClick={() => setRestartConfirm(serviceName)}
                    disabled={restartAction.loading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    <RotateCw className={`w-3 h-3 ${restartAction.loading ? 'animate-spin' : ''}`} />
                    Restart
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Live Session Status */}
      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Live Session Status</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          {liveStatusLoading && !liveStatus ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-800 rounded-lg" />)}
            </div>
          ) : liveStatus ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Model</p>
                  <p className="text-sm text-gray-200 font-mono break-all">{liveStatus.model || '—'}</p>
                </div>
                {liveStatus.updated && <span className="text-[11px] text-gray-400 font-mono bg-gray-800/70 px-2 py-0.5 rounded">updated {liveStatus.updated}</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Tokens</p>
                  <p className="text-lg font-bold text-cyan-400">{formatTokens(liveStatus.tokens?.total)}</p>
                  <p className="text-[10px] text-gray-500">{formatTokens(liveStatus.tokens?.input)} in / {formatTokens(liveStatus.tokens?.output)} out</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-1 mb-1">
                    <p className="text-[10px] text-gray-500 uppercase">Cache</p>
                    <span title="Cache hit rate for recent prompt/context reuse."><Info className="w-3 h-3 text-gray-600" /></span>
                  </div>
                  <p className="text-lg font-bold text-green-400">{liveStatus.cache?.hitPercent ?? 0}%</p>
                  <p className="text-[10px] text-gray-500">{formatTokens(liveStatus.cache?.cachedTokens)} cached</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-1 mb-1">
                    <p className="text-[10px] text-gray-500 uppercase">Context</p>
                    <span title="How full the model context window is."><Info className="w-3 h-3 text-gray-600" /></span>
                  </div>
                  <p className={`text-lg font-bold ${
                    (liveStatus.context?.percent || 0) >= 75 ? 'text-red-400' :
                    (liveStatus.context?.percent || 0) >= 55 ? 'text-yellow-400' : 'text-cyan-400'
                  }`}>{liveStatus.context?.percent ?? 0}%</p>
                  <p className="text-[10px] text-gray-500">{formatTokens(liveStatus.context?.used)} / {formatTokens(liveStatus.context?.max)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Remaining</p>
                  <p className="text-lg font-bold text-green-400">{liveStatus.usage?.windowPercentLeft ?? 0}%</p>
                  <p className="text-[10px] text-gray-500">{liveStatus.usage?.windowTimeLeft || '—'} · week {liveStatus.usage?.weekPercentLeft ?? 0}%</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {liveStatus.runtime && <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">{liveStatus.runtime.mode} · think {liveStatus.runtime.thinking}</span>}
                {liveStatus.runtime?.elevated && <span className="text-[10px] bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded font-mono">elevated</span>}
                {liveStatus.queue && <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">queue {liveStatus.queue.name} ({liveStatus.queue.depth})</span>}
                {!!liveStatus.context?.compactions && <span className="text-[10px] bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded font-mono">{liveStatus.context.compactions} compactions</span>}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No live session status available</div>
          )}
        </div>
      </div>

      {/* System Gauges */}
      {cpu && memory && disk && (
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">System Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CPU Load */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gray-800 text-blue-400">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-200">CPU Load</h3>
                  <p className="text-xs text-gray-500">Load averages</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">1m</span>
                  <div className="flex items-center gap-2 flex-1 ml-3">
                    {getUtilizationBar(cpu.loadAvg['1m'], cpu.cores, 
                      cpu.loadAvg['1m'] / cpu.cores > 0.8 ? 'red' : 
                      cpu.loadAvg['1m'] / cpu.cores > 0.6 ? 'yellow' : 'blue')}
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {((cpu.loadAvg['1m'] / cpu.cores) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">5m</span>
                  <div className="flex items-center gap-2 flex-1 ml-3">
                    {getUtilizationBar(cpu.loadAvg['5m'], cpu.cores,
                      cpu.loadAvg['5m'] / cpu.cores > 0.8 ? 'red' : 
                      cpu.loadAvg['5m'] / cpu.cores > 0.6 ? 'yellow' : 'blue')}
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {((cpu.loadAvg['5m'] / cpu.cores) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">15m</span>
                  <div className="flex items-center gap-2 flex-1 ml-3">
                    {getUtilizationBar(cpu.loadAvg['15m'], cpu.cores,
                      cpu.loadAvg['15m'] / cpu.cores > 0.8 ? 'red' : 
                      cpu.loadAvg['15m'] / cpu.cores > 0.6 ? 'yellow' : 'blue')}
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {((cpu.loadAvg['15m'] / cpu.cores) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Memory */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gray-800 text-green-400">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-200">Memory</h3>
                  <p className="text-xs text-gray-500">{formatBytes(memory.used)} / {formatBytes(memory.total)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl font-bold text-green-400">
                  {memory.percent.toFixed(1)}%
                </span>
                {getUtilizationBar(memory.used, memory.total, 
                  memory.percent > 80 ? 'red' : 
                  memory.percent > 60 ? 'yellow' : 'blue')}
              </div>
            </div>

            {/* Disk */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gray-800 text-purple-400">
                  <HardDrive size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-200">Disk Space</h3>
                  <p className="text-xs text-gray-500">{formatBytes(disk.used)} / {formatBytes(disk.total)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl font-bold text-purple-400">
                  {disk.percent.toFixed(1)}%
                </span>
                {getUtilizationBar(disk.used, disk.total,
                  disk.percent > 80 ? 'red' : 
                  disk.percent > 60 ? 'yellow' : 'blue')}
              </div>
              <div className="text-xs text-gray-500 mt-3">
                Uptime: {formatUptime(uptime || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Viewer */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">Log Viewer</h2>
          <button
            onClick={handleLogRefresh}
            disabled={logLoading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${logLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-gray-800 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Service:</label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-gray-200 focus:border-gray-600 focus:outline-none"
              >
                {SERVICES.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Lines:</label>
              <select
                value={selectedLines}
                onChange={(e) => setSelectedLines(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-gray-200 focus:border-gray-600 focus:outline-none"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
          
          {/* Logs */}
          <div 
            ref={logContainerRef}
            className="bg-gray-950 p-4 h-96 overflow-y-auto font-mono text-xs"
          >
            {logLoading && logData?.lines?.length === 0 ? (
              <div className="text-gray-500 text-center py-8">Loading logs...</div>
            ) : logData?.lines?.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No logs found</div>
            ) : (
              <div className="space-y-1">
                {logData?.lines?.map((line, i) => (
                  <div key={i} className="flex">
                    <span className="text-gray-500 mr-3 flex-shrink-0">
                      {line.timestamp}
                    </span>
                    <span className="text-gray-300 break-all">
                      {line.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restart Confirmation Dialog */}
      <ConfirmDialog
        open={restartConfirm !== null}
        title={`Restart ${restartConfirm}`}
        message={`This will restart the ${restartConfirm} service. It may cause temporary disruption. Continue?`}
        confirmLabel="Restart"
        onConfirm={() => restartConfirm && handleRestart(restartConfirm)}
        onCancel={() => setRestartConfirm(null)}
        loading={restartAction.loading}
      />
    </div>
  )
}