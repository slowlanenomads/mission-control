import React from 'react'
import { DollarSign, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react'
import StatCard from '../components/StatCard'
import { useApi } from '../hooks/useApi'

interface DailyCost {
  date: string
  cost: number
  models: Array<{
    model: string
    cost: number
    color: string
  }>
}

interface ModelBreakdown {
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  percentage: number
}

interface CostSummaryData {
  totalCost30Days: number
  todayCost: number
  totalInputTokens: number
  totalOutputTokens: number
  dailyCosts: DailyCost[]
  modelBreakdown: ModelBreakdown[]
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function formatCurrency(amount: number): string {
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const MODEL_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-red-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'
]

export default function CostTracker() {
  const { data: costSummary, loading } = useApi<CostSummaryData>('/api/cost/summary', { interval: 60000 })

  if (loading && !costSummary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="w-6 h-6 text-yellow-400" />
          <h1 className="text-2xl font-bold text-gray-100">Cost Tracker</h1>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
              <div className="h-4 w-24 bg-gray-800 rounded mb-2" />
              <div className="h-8 w-20 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const dailyCosts = costSummary?.dailyCosts || []
  const modelBreakdown = costSummary?.modelBreakdown || []
  const maxDailyCost = Math.max(...dailyCosts.map(d => d.cost), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-gray-100">Cost Tracker</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Cost (30 days)"
          value={formatCurrency(costSummary?.totalCost30Days || 0)}
          subtitle="last 30 days"
          color="text-yellow-400"
          loading={loading && !costSummary}
        />
        <StatCard
          icon={TrendingUp}
          label="Today's Cost"
          value={formatCurrency(costSummary?.todayCost || 0)}
          subtitle="current session"
          color="text-green-400"
          loading={loading && !costSummary}
        />
        <StatCard
          icon={ArrowUp}
          label="Input Tokens"
          value={formatTokens(costSummary?.totalInputTokens || 0)}
          subtitle={`${(costSummary?.totalInputTokens || 0).toLocaleString()} total`}
          color="text-blue-400"
          loading={loading && !costSummary}
        />
        <StatCard
          icon={ArrowDown}
          label="Output Tokens"
          value={formatTokens(costSummary?.totalOutputTokens || 0)}
          subtitle={`${(costSummary?.totalOutputTokens || 0).toLocaleString()} total`}
          color="text-purple-400"
          loading={loading && !costSummary}
        />
      </div>

      {/* Daily Cost Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-6">Daily Cost Trends</h2>
        
        {dailyCosts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No cost data available</div>
        ) : (
          <div className="space-y-4">
            {dailyCosts.map((day, index) => {
              const barWidth = maxDailyCost > 0 ? (day.cost / maxDailyCost) * 100 : 0
              
              return (
                <div key={day.date} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-400 w-12 text-right">
                        {formatDate(day.date)}
                      </span>
                      <div className="flex-1 h-6 bg-gray-800 rounded-lg overflow-hidden relative min-w-[200px]">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-lg transition-all duration-300"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-200 min-w-[60px] text-right">
                      {formatCurrency(day.cost)}
                    </span>
                  </div>
                  
                  {/* Model breakdown dots */}
                  {day.models.length > 0 && (
                    <div className="flex items-center gap-1 ml-16">
                      {day.models.map((model, modelIndex) => (
                        <div
                          key={model.model}
                          className={`w-2 h-2 rounded-full ${MODEL_COLORS[modelIndex % MODEL_COLORS.length]} opacity-80`}
                          title={`${model.model}: ${formatCurrency(model.cost)}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Model Breakdown Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-200">Model Breakdown</h2>
        </div>
        
        {modelBreakdown.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No model data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr className="text-left">
                  <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Model</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Input Tokens</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Output Tokens</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Cost</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {modelBreakdown.map((model, index) => (
                  <tr key={model.model} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${MODEL_COLORS[index % MODEL_COLORS.length]}`}
                        />
                        <span className="text-sm font-medium text-gray-200">{model.model}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-300">{formatTokens(model.inputTokens)}</div>
                      <div className="text-xs text-gray-500">{model.inputTokens.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-300">{formatTokens(model.outputTokens)}</div>
                      <div className="text-xs text-gray-500">{model.outputTokens.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-yellow-400">{formatCurrency(model.cost)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm text-gray-300">{model.percentage.toFixed(1)}%</span>
                        <div className="w-12 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${MODEL_COLORS[index % MODEL_COLORS.length]} transition-all`}
                            style={{ width: `${model.percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}