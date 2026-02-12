import React, { useState, useCallback, useEffect, createContext, useContext } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

interface ToastContextType {
  toast: (message: string, type?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let counter = 0

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm animate-slide-in ${
              t.type === 'success'
                ? 'bg-green-900/90 border-green-700 text-green-200'
                : 'bg-red-900/90 border-red-700 text-red-200'
            }`}
          >
            {t.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-gray-200">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
