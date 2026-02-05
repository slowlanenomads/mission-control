const c: Record<string,string> = { active:'bg-green-400/10 text-green-400 border-green-400/20', main:'bg-blue-400/10 text-blue-400 border-blue-400/20', subagent:'bg-purple-400/10 text-purple-400 border-purple-400/20', cron:'bg-orange-400/10 text-orange-400 border-orange-400/20', disabled:'bg-gray-400/10 text-gray-400 border-gray-400/20', error:'bg-red-400/10 text-red-400 border-red-400/20' }
export function StatusBadge({ variant, label }: { variant: string; label?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${c[variant]||c.disabled}`}>{label||variant}</span>
}
