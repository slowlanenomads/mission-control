import React, { useState } from 'react'
import { Clock, ChevronDown, ChevronRight, Play, Pause, Trash2, Plus, RotateCw, Power } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonCronRow } from '../components/Skeleton'
import { useApi } from '../hooks/useApi'
import { useAction } from '../hooks/useAction'
import { useToast } from '../components/Toast'
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

function CronJobRow({ job, onRefresh }: { job: CronJob; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const { toast } = useToast()
  const runAction = useAction()
  const toggleAction = useAction()
  const deleteAction = useAction()

  const { data: runsData, loading: runsLoading } = useApi<any>(
    expanded ? `/api/cron/${encodeURIComponent(job.id)}/runs` : null
  )
  const runs: CronRun[] = Array.isArray(runsData) ? runsData : (runsData as any)?.runs ?? []

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await runAction.execute(`/api/cron/${encodeURIComponent(job.id)}/run`, { method: 'POST' })
    toast(res.ok ? `Triggered "${job.name || job.id}"` : `Failed: ${res.error}`, res.ok ? 'success' : 'error')
    if (res.ok) onRefresh()
  }

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const newEnabled = !job.enabled
    const res = await toggleAction.execute(`/api/cron/${encodeURIComponent(job.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: newEnabled }),
    })
    toast(res.ok ? `${newEnabled ? 'Enabled' : 'Disabled'} "${job.name || job.id}"` : `Failed: ${res.error}`, res.ok ? 'success' : 'error')
    if (res.ok) onRefresh()
  }

  const handleDelete = async () => {
    const res = await deleteAction.execute(`/api/cron/${encodeURIComponent(job.id)}`, { method: 'DELETE' })
    toast(res.ok ? `Deleted "${job.name || job.id}"` : `Failed: ${res.error}`, res.ok ? 'success' : 'error')
    setDeleteConfirm(false)
    if (res.ok) onRefresh()
  }

  return (
    <>
      <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900 hover:border-gray-700 transition-colors">
        <div className="w-full px-5 py-4 flex items-center gap-4">
          <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-gray-300">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div className={`p-1.5 rounded-lg ${job.enabled ? 'bg-green-500/10' : 'bg-gray-800'}`}>
            {job.enabled ? <Play className="w-4 h-4 text-green-400" /> : <Pause className="w-4 h-4 text-gray-500" />}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="flex-1 min-w-0 text-left">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
              <span className="text-sm font-medium text-gray-200 truncate">{job.name || job.text || job.id}</span>
              <StatusBadge color={job.enabled ? 'green' : 'gray'} dot>{job.enabled ? 'Active' : 'Disabled'}</StatusBadge>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500">
              <span className="font-mono bg-gray-800 px-2 py-0.5 rounded">{job.schedule}</span>
              {job.lastRun && <span>Last: {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}</span>}
              {job.nextRun && <span>Next: {formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}</span>}
            </div>
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRun}
              disabled={runAction.loading}
              title="Run Now"
              className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
            >
              <RotateCw className={`w-4 h-4 ${runAction.loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleToggle}
              disabled={toggleAction.loading}
              title={job.enabled ? 'Disable' : 'Enable'}
              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${job.enabled ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
            >
              <Power className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(true) }}
              title="Delete"
              className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
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
                  {runs.slice(0, 10).map((run, i) => (
                    <div key={run.runId || i} className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
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
      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Cron Job"
        message={`Are you sure you want to delete "${job.name || job.id}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
        loading={deleteAction.loading}
      />
    </>
  )
}

function CreateJobModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('')
  const [payloadType, setPayloadType] = useState('agentTurn')
  const [message, setMessage] = useState('')
  const [sessionTarget, setSessionTarget] = useState('isolated')
  const { toast } = useToast()
  const action = useAction()

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await action.execute('/api/cron', {
      method: 'POST',
      body: JSON.stringify({
        name,
        schedule,
        payloadType,
        text: message,
        sessionTarget,
      }),
    })
    if (res.ok) {
      toast(`Created cron job "${name}"`)
      setName(''); setSchedule(''); setMessage('')
      onCreated()
      onClose()
    } else {
      toast(`Failed: ${res.error}`, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Create Cron Job</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500" placeholder="my-job" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Schedule (cron expression)</label>
            <input value={schedule} onChange={e => setSchedule(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-gray-500" placeholder="0 */6 * * *" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Payload Type</label>
              <select value={payloadType} onChange={e => setPayloadType(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500">
                <option value="agentTurn">Agent Turn</option>
                <option value="systemEvent">System Event</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Session Target</label>
              <select value={sessionTarget} onChange={e => setSessionTarget(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500">
                <option value="isolated">Isolated</option>
                <option value="main">Main</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Message / Prompt</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 resize-none" placeholder="What should the agent do?" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={action.loading} className="px-4 py-2 text-sm bg-blue-600 border border-blue-500 rounded-lg text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
              {action.loading ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CronJobs() {
  const { data: cronData, loading, refetch } = useApi<any>('/api/cron', { interval: 30000 })
  const [showCreate, setShowCreate] = useState(false)
  const jobs: CronJob[] = Array.isArray(cronData) ? cronData : (cronData as any)?.jobs ?? []
  const activeCount = jobs.filter(j => j.enabled !== false).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Cron Jobs</h2>
          <p className="text-sm text-gray-500 mt-0.5">{jobs.length} jobs configured &middot; {activeCount} active</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 border border-blue-500 rounded-lg text-xs text-white hover:bg-blue-500 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Job
        </button>
      </div>
      {loading && jobs.length === 0 ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <SkeletonCronRow key={i} />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No cron jobs configured</div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <CronJobRow key={job.id} job={job} onRefresh={refetch} />
          ))}
        </div>
      )}
      <CreateJobModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={refetch} />
    </div>
  )
}
