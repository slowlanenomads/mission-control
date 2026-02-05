import React from 'react'
import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  subtitle?: string
  color?: string
  loading?: boolean
}

export function StatCard({ icon: Icon, label, value, subtitle, color = 'text-blue-400', loading }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-gray-800 ${color}`}><Icon size={18} /></div>
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      {loading ? (
        <>
          <div className="h-7 w-16 bg-gray-800 rounded animate-pulse mb-2" />
          <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-100">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </>
      )}
    </div>
  )
}

export default StatCard
