import React, { useState, useCallback, useEffect } from 'react'
import { Brain, Search, FileText, FolderOpen, ArrowLeft, Clock, HardDrive, Save, Edit3, X } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAction } from '../hooks/useAction'
import { useToast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'
import { formatDistanceToNow } from 'date-fns'

interface MemoryFile {
  name: string
  path: string
  size: number
  modified: string
}

interface FileContent {
  path: string
  content: string
  size: number
  modified: string
}

interface SearchResult {
  file?: string
  path?: string
  line?: number
  lineStart?: number
  lineEnd?: number
  score?: number
  content?: string
  snippet?: string
  match?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function FileIcon({ name }: { name: string }) {
  const isDaily = /^\d{4}-\d{2}-\d{2}/.test(name)
  const isCore = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md'].includes(name)
  return (
    <div className={`p-2 rounded-lg flex-shrink-0 ${isCore ? 'bg-purple-500/10 text-purple-400' : isDaily ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>
      {isCore ? <Brain size={16} /> : <FileText size={16} />}
    </div>
  )
}

export default function Memory() {
  const [view, setView] = useState<'files' | 'search' | 'viewer'>('files')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchUrl, setSearchUrl] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const { toast } = useToast()
  const saveAction = useAction()

  const { data: files, loading: filesLoading } = useApi<MemoryFile[]>('/api/memory/files', { interval: 30000 })
  const { data: fileContent, loading: contentLoading, refetch: refetchFile } = useApi<FileContent>(
    selectedFile ? `/api/memory/file?path=${encodeURIComponent(selectedFile)}` : null
  )
  const { data: searchResults, loading: searchLoading } = useApi<any>(searchUrl)

  const fileList: MemoryFile[] = Array.isArray(files) ? files : []
  const resultList: SearchResult[] = Array.isArray(searchResults) ? searchResults : (searchResults as any)?.results ?? []
  const coreFiles = fileList.filter(f => !f.path.startsWith('memory/'))
  const dailyFiles = fileList.filter(f => f.path.startsWith('memory/'))

  useEffect(() => {
    if (fileContent?.content && !editing) {
      setEditContent(fileContent.content)
    }
  }, [fileContent?.content])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setSearchUrl(`/api/memory/search?q=${encodeURIComponent(query.trim())}`)
      setView('search')
    }
  }, [query])

  const openFile = useCallback((filePath: string) => {
    setSelectedFile(filePath)
    setView('viewer')
    setEditing(false)
  }, [])

  const goBack = useCallback(() => {
    setView('files')
    setSelectedFile(null)
    setEditing(false)
  }, [])

  const handleSave = async () => {
    if (!selectedFile) return
    const res = await saveAction.execute('/api/memory/file', {
      method: 'PUT',
      body: JSON.stringify({ path: selectedFile, content: editContent }),
    })
    if (res.ok) {
      toast(`Saved ${selectedFile}`)
      setEditing(false)
      refetchFile()
    } else {
      toast(`Failed to save: ${res.error}`, 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'files' && (
            <button onClick={goBack} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold">
              {view === 'viewer' && selectedFile ? selectedFile : view === 'search' ? 'Search Results' : 'Memory'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {view === 'files' ? `${fileList.length} files in workspace` :
               view === 'search' ? `${resultList.length} results for "${query}"` :
               fileContent ? formatBytes(fileContent.size) : 'Loading...'}
            </p>
          </div>
        </div>
        {view === 'viewer' && selectedFile && !contentLoading && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setEditContent(fileContent?.content || '') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-700 transition-colors">
                  <X size={14} /> Cancel
                </button>
                <button onClick={handleSave} disabled={saveAction.loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 border border-green-500 rounded-lg text-xs text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
                  <Save size={14} /> {saveAction.loading ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-700 transition-colors">
                <Edit3 size={14} /> Edit
              </button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search memory files..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-colors" />
        </div>
        <button type="submit" disabled={!query.trim() || searchLoading}
          className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {searchLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {view === 'files' && (
        <div className="space-y-6">
          {filesLoading && fileList.length === 0 ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1"><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-20" /></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {coreFiles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FolderOpen size={14} className="text-purple-400" />
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Core Files</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {coreFiles.map(file => (
                      <button key={file.path} onClick={() => openFile(file.path)}
                        className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-3 hover:border-gray-700 hover:bg-gray-800/30 transition-colors text-left">
                        <FileIcon name={file.name} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
                          <p className="text-[10px] text-gray-500">{formatBytes(file.size)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {dailyFiles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={14} className="text-blue-400" />
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Logs</h3>
                  </div>
                  <div className="space-y-1">
                    {dailyFiles.map(file => (
                      <button key={file.path} onClick={() => openFile(file.path)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-4 hover:border-gray-700 hover:bg-gray-800/30 transition-colors text-left">
                        <FileIcon name={file.name} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-200">{file.name}</p>
                          <p className="text-[10px] text-gray-500">{formatDistanceToNow(new Date(file.modified), { addSuffix: true })}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-500 font-mono">{formatBytes(file.size)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {fileList.length === 0 && (
                <div className="text-center py-20">
                  <HardDrive className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">No memory files found</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === 'viewer' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-cyan-400" />
              <span className="text-sm font-mono text-gray-300">{selectedFile}</span>
            </div>
            {fileContent && (
              <span className="text-[10px] text-gray-500">Modified {formatDistanceToNow(new Date(fileContent.modified), { addSuffix: true })}</span>
            )}
          </div>
          <div className="p-5 max-h-[70vh] overflow-y-auto">
            {contentLoading ? (
              <div className="space-y-2">
                {[...Array(15)].map((_, i) => (
                  <Skeleton key={i} className={`h-4 ${i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-4/5' : 'w-3/5'}`} />
                ))}
              </div>
            ) : editing ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full h-[60vh] bg-gray-950 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-gray-600 resize-none"
              />
            ) : fileContent ? (
              <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">{fileContent.content}</pre>
            ) : (
              <p className="text-gray-500 text-sm">Failed to load file</p>
            )}
          </div>
        </div>
      )}

      {view === 'search' && (
        <div className="space-y-3">
          {searchLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                  <Skeleton className="h-4 w-48 mb-3" /><Skeleton className="h-4 w-full mb-1" /><Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : resultList.length > 0 ? (
            resultList.map((result, i) => (
              <button key={i} onClick={() => openFile(result.file || result.path || '')}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors text-left">
                <div className="flex items-start gap-3 mb-3">
                  <FileText className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-gray-200 truncate">{result.file || result.path || 'Unknown'}</span>
                      {(result.line || result.lineStart) && <span className="text-xs text-gray-500 font-mono">L{result.line || result.lineStart}</span>}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-md p-3 ml-7">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {result.content || result.snippet || result.match || '(no preview)'}
                  </pre>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-20">
              <Brain className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No results found for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
