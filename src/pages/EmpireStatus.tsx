import React from 'react'
import { Database, Clock, Users, FileText, CreditCard, ExternalLink } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'
import { formatDistanceToNow } from 'date-fns'

interface SyncStatus {
  isRunning: boolean
  lastRun?: string
  progress?: {
    current: number
    total: number
    stage: string
  }
}

interface EmpireCounts {
  customers: number
  subscriptions: number
  invoices: number
}

interface EmpireService {
  name: 'dev' | 'prod'
  status: 'online' | 'offline'
  sync: SyncStatus
  counts?: EmpireCounts
}

interface EmpireStatusData {
  services: EmpireService[]
}

function formatLastSync(lastRun?: string): string {
  if (!lastRun) return 'Never'
  try {
    return formatDistanceToNow(new Date(lastRun), { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

function ServiceCard({ service }: { service: EmpireService }) {
  const isOnline = service.status === 'online'
  const { sync, counts } = service
  
  if (!isOnline) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 opacity-60">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-200 capitalize">{service.name}</h3>
          <StatusBadge color="gray" dot>Service Offline</StatusBadge>
        </div>
        <div className="text-center text-gray-500 py-8">
          <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Service is currently offline</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-200 capitalize">{service.name}</h3>
        <StatusBadge color="green" dot>Online</StatusBadge>
      </div>

      {/* Sync Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Sync Status</span>
          </div>
          <StatusBadge color={sync.isRunning ? 'yellow' : 'green'}>
            {sync.isRunning ? 'Running' : 'Idle'}
          </StatusBadge>
        </div>
        
        <div className="text-sm text-gray-400 mb-2">
          Last sync: <span className="text-gray-300">{formatLastSync(sync.lastRun)}</span>
        </div>

        {sync.isRunning && sync.progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{sync.progress.stage}</span>
              <span className="text-gray-400">{sync.progress.current} / {sync.progress.total}</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${(sync.progress.current / sync.progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Counts */}
      {counts && (
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-gray-800 rounded-lg mx-auto mb-2">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-gray-100">{counts.customers.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Customers</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-gray-800 rounded-lg mx-auto mb-2">
              <FileText className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-xl font-bold text-gray-100">{counts.subscriptions.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Subscriptions</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-gray-800 rounded-lg mx-auto mb-2">
              <CreditCard className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-gray-100">{counts.invoices.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Invoices</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EmpireStatus() {
  const { data: empireStatus, loading } = useApi<EmpireStatusData>('/api/empire/status', { interval: 30000 })

  if (loading && !empireStatus) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-100">Empire Status</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
              <div className="h-6 w-24 bg-gray-800 rounded mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-32 bg-gray-800 rounded" />
                <div className="h-4 w-28 bg-gray-800 rounded" />
                <div className="h-4 w-36 bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const services = empireStatus?.services || []
  const devService = services.find(s => s.name === 'dev')
  const prodService = services.find(s => s.name === 'prod')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-6 h-6 text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-100">Empire Status</h1>
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dev Service */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-gray-200">Development</h2>
            <div className="w-2 h-2 rounded-full bg-orange-400" />
          </div>
          {devService ? (
            <ServiceCard service={devService} />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 opacity-60">
              <div className="text-center text-gray-500 py-8">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Prod Service */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-gray-200">Production</h2>
            <div className="w-2 h-2 rounded-full bg-green-400" />
          </div>
          {prodService ? (
            <ServiceCard service={prodService} />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 opacity-60">
              <div className="text-center text-gray-500 py-8">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="http://76.13.107.133:8080/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 hover:border-orange-400/30 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-200 group-hover:text-orange-300 transition-colors">
                  Development Dashboard
                </h3>
                <p className="text-sm text-gray-500">Empire Dev Environment</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-colors" />
          </a>

          <a
            href="http://76.13.107.133/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 hover:border-green-400/30 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-200 group-hover:text-green-300 transition-colors">
                  Production Dashboard
                </h3>
                <p className="text-sm text-gray-500">Empire Live Environment</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-green-400 transition-colors" />
          </a>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">System Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-sm text-gray-300">Empire Services</span>
            <StatusBadge color="blue">Monitoring</StatusBadge>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-sm text-gray-300">Data Sync</span>
            <StatusBadge color="green">Active</StatusBadge>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-sm text-gray-300">API Health</span>
            <StatusBadge color="purple">Healthy</StatusBadge>
          </div>
        </div>
      </div>
    </div>
  )
}