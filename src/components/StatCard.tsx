import { type LucideIcon } from 'lucide-react'
export function StatCard({ icon: Icon, label, value, subtitle, color = 'text-blue-400' }: { icon: LucideIcon; label: string; value: string | number; subtitle?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-gray-800 ${color}`}><Icon size={18} /></div>
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-100">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}
