import React from 'react'

const colorMap: Record<string, string> = {
  green: 'bg-green-400/10 text-green-400 border-green-400/20',
  blue: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  purple: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  orange: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
  yellow: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  red: 'bg-red-400/10 text-red-400 border-red-400/20',
  gray: 'bg-gray-400/10 text-gray-400 border-gray-400/20',
}

const dotColorMap: Record<string, string> = {
  green: 'bg-green-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
  yellow: 'bg-yellow-400',
  red: 'bg-red-400',
  gray: 'bg-gray-400',
}

interface StatusBadgeProps {
  color?: string
  dot?: boolean
  children: React.ReactNode
  // Legacy support
  variant?: string
  label?: string
}

export function StatusBadge({ color, dot, children, variant, label }: StatusBadgeProps) {
  const resolvedColor = color || variant || 'gray'
  const text = children || label || variant || ''
  const classes = colorMap[resolvedColor] || colorMap.gray

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${classes}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColorMap[resolvedColor] || dotColorMap.gray}`} />}
      {text}
    </span>
  )
}

export default StatusBadge
