import React, { useState, useCallback } from 'react'
import { CheckSquare, Plus, Trash2, Circle, CheckCircle2, Tag, Calendar } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { SkeletonTodoRow } from '../components/Skeleton'
import { useApi } from '../hooks/useApi'

interface Todo {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  category?: string
  dueDate?: string
  createdAt: string
  completedAt?: string
}

type Filter = 'all' | 'active' | 'completed'

const priorityColors: Record<string, string> = {
  high: 'red',
  medium: 'yellow',
  low: 'gray',
}

const priorityLabels: Record<string, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
}

export default function Todos() {
  const { data, loading, refetch } = useApi<Todo[]>('/api/todos', { interval: 30000 })
  const todos: Todo[] = Array.isArray(data) ? data : (data as any)?.todos ?? []

  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [category, setCategory] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filteredTodos = todos.filter(t => {
    if (filter === 'active') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  const activeCount = todos.filter(t => !t.completed).length
  const completedCount = todos.filter(t => t.completed).length

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: text.trim(),
          priority,
          category: category.trim() || undefined,
          dueDate: dueDate || undefined,
        }),
      })
      setText('')
      setCategory('')
      setDueDate('')
      refetch()
    } catch (e) {
      console.error('Failed to add todo:', e)
    } finally {
      setSubmitting(false)
    }
  }, [text, priority, category, dueDate, submitting, refetch])

  const toggleTodo = useCallback(async (id: string, completed: boolean) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed: !completed }),
      })
      refetch()
    } catch (e) {
      console.error('Failed to toggle todo:', e)
    }
  }, [refetch])

  const deleteTodo = useCallback(async (id: string) => {
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE', credentials: 'include' })
      refetch()
    } catch (e) {
      console.error('Failed to delete todo:', e)
    }
  }, [refetch])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Tasks</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {activeCount} active{completedCount > 0 && ` · ${completedCount} completed`}
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-colors"
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Priority:</span>
            {(['low', 'medium', 'high'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                  priority === p
                    ? p === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : p === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="bg-gray-950 border border-gray-800 rounded px-2.5 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-24 sm:w-32 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded px-2.5 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-600 transition-colors [color-scheme:dark]"
            />
          </div>
        </div>
      </form>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {([
          { key: 'all', label: 'All', count: todos.length },
          { key: 'active', label: 'Active', count: activeCount },
          { key: 'completed', label: 'Completed', count: completedCount },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label} <span className="text-gray-600 ml-1">{count}</span>
          </button>
        ))}
      </div>

      {/* Todo list */}
      {loading && todos.length === 0 ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <SkeletonTodoRow key={i} />)}
        </div>
      ) : filteredTodos.length === 0 ? (
        <div className="text-center py-20">
          <CheckSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">
            {filter === 'all' ? 'No tasks yet. Add one above!' :
             filter === 'active' ? 'No active tasks. All done! 🎉' :
             'No completed tasks yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className={`group bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-3 hover:border-gray-700 transition-all ${
                todo.completed ? 'opacity-60' : ''
              }`}
            >
              <button
                onClick={() => toggleTodo(todo.id, todo.completed)}
                className="flex-shrink-0 transition-colors"
              >
                {todo.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-600 hover:text-gray-400" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm ${todo.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                    {todo.text}
                  </span>
                  <StatusBadge color={priorityColors[todo.priority]}>{priorityLabels[todo.priority]}</StatusBadge>
                  {todo.category && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-400/10 border border-cyan-400/20 rounded-full text-[10px] text-cyan-400 font-medium">
                      <Tag className="w-2.5 h-2.5" />
                      {todo.category}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  {todo.dueDate && (
                    <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {todo.dueDate}
                    </span>
                  )}
                  {todo.completedAt && (
                    <span className="text-[10px] text-green-500/70 font-mono">
                      Done {new Date(todo.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
