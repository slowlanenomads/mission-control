import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  error: string
  onRetry?: () => void
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-8 text-center">
      <AlertTriangle className="w-8 h-8 text-red-400/60 mx-auto mb-3" />
      <p className="text-sm text-red-400 mb-1">Something went wrong</p>
      <p className="text-xs text-gray-500 font-mono mb-4">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  )
}

export default ErrorState
