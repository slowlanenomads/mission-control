import React, { useState } from 'react'
import { Clock, ChevronDown, ChevronRight, Play, Pause } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'
import { formatDistanceToNow } from 'date-fns'

interface CronJob {
  id: string
  name?: string
  text?: string
  schedule: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
  model?: string
  channel?: string
}

interface CronRun {
  runId?: string
  startedAt: string
  finishedAt?: string
  status: string
  summary?: string
}

function CronJobRow({ job }: { job: CronJob }) {
  const [expanded, setExpanded] = useState(false)
  const { data: runsData, loading: runsLoading } = useApi<any>(
    expanded ? `/api/cron/${encodeURIComponent(job.id)}/runs` : null
  )
  const runs: CronRun[] = Array.isArray(runsData) ? runsData : (runsData as any)?.runs ?? []

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900 hover:border-gray-700 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-gray-500">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className={`p-1.5 rounded-lg ${job.enabled ? 'bg-green-500/10' : 'bg-gray-800'}`}>
          {job.enabled ? <Play className="w-4 h-4 text-green-400" /> : <Pause className="w-4 h-4 text-gray-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-medium text-gray-200 truncate">{job.name || job.text || job.id}</span>
            <StatusBadge color={job.enabled ? 'green' : 'gray'} dot>{job.enabled ? 'Active' : 'Disabled'}</StatusBadge>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="font-mono bg-gray-800 px-2 py-0.5 rounded">{job.schedule}</span>
            {job.lastRun && <span>Last: {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}</span>}
            {job.nextRun && <span>Next: {formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}</span>}
            {job.channel && <span className="text-gray-600">#{job.channel}</span>}
          </div>
        </div>
        <Clock className="w-4 h-4 text-gray-600" />
      </button>
      {expanded && (
        <div className="border-t border-gray-800 bg-gray-950/50">
          {job.text && (
            <div className="px-5 py-3 border-b border-gray-800/50">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Prompt</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{job.text}</p>
            </div>
          )}
          <div className="px-5 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Recent Runs</p>
            {runsLoading ? (
              <div className="py-4 text-center text-sm text-gray-500 animate-pulse">Loading runs...</div>
            ) : runs.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No runs recorded</div>
            ) : (
              <div className="space-y-2">
                {runs.slice(0, 10).map((run: CronRun, i: number) => (
                  <div key={run.runId || i} className="flex items-center gap-3 text-sm">
                    <StatusBadge color={run.status === 'success' ? 'green' : run.status === 'error' ? 'red' : 'yellow'}>{run.status}</StatusBadge>
                    <span className="font-mono text-xs text-gray-400">{new Date(run.startedAt).toLocaleString()}</span>
                    {run.summary && <span className="text-xs text-gray-500 truncate">{run.summary}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CronJobs() {
  const { data: cronData, loading } = useApi<any>('/api/cron', { interval: 30000 })
  const jobs: CronJob[] = Array.isArray(cronData) ? cronData : (cronData as any)?.jobs ?? []
  const activeCount = jobs.filter((j: CronJob) => j.enabled !== false).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Cron Jobs</h2>
        <p className="text-sm text-gray-500 mt-0.5">{jobs.length} jobs configured &middot; {activeCount} active</p>
      </div>
      {loading && jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-500">Loading cron jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No cron jobs configured</div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: CronJob) => (
            <CronJobRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
