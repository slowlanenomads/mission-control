import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import {
  createToken, verifyToken, hasUsers, createUser, authenticate,
  checkRateLimit, recordFailedAttempt, clearAttempts,
} from './auth'

const app = express()
const PORT = process.env.PORT || 3333

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18789'
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '4e5fe116c0397c5bce9654143fcd6dfcf58d70204ee5c698'

const DATA_DIR = path.join(__dirname, '../data')
const TODOS_FILE = path.join(DATA_DIR, 'todos.json')

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// Trust proxy for correct IP behind Caddy
app.set('trust proxy', 1)

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// ---------- Cookie helpers ----------

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || ''
  const cookies: Record<string, string> = {}
  header.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=')
    if (key) cookies[key] = rest.join('=')
  })
  return cookies
}

function setTokenCookie(res: Response, token: string) {
  res.setHeader('Set-Cookie', `mc_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 86400}; Secure`)
}

function clearTokenCookie(res: Response) {
  res.setHeader('Set-Cookie', 'mc_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure')
}

// ---------- Auth middleware ----------

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req)
  const token = cookies.mc_token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  const user = verifyToken(token)
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' })
  ;(req as any).user = user
  next()
}

// ---------- Auth routes (public) ----------

app.get('/api/auth/status', (_req, res) => {
  res.json({ hasUsers: hasUsers() })
})

app.post('/api/auth/setup', (req, res) => {
  if (hasUsers()) return res.status(403).json({ error: 'Admin already exists' })
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  try {
    const user = createUser(username, password)
    const token = createToken(user.id, user.username)
    setTokenCookie(res, token)
    console.log(`🔐 Admin account created: ${user.username}`)
    res.json({ user: { id: user.id, username: user.username } })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const limit = checkRateLimit(ip)
  if (!limit.allowed) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${limit.retryAfter}s` })
  }
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  const user = authenticate(username, password)
  if (!user) {
    recordFailedAttempt(ip)
    return res.status(401).json({ error: 'Invalid username or password' })
  }
  clearAttempts(ip)
  const token = createToken(user.id, user.username)
  setTokenCookie(res, token)
  res.json({ user: { id: user.id, username: user.username } })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: (req as any).user })
})

app.post('/api/auth/logout', (_req, res) => {
  clearTokenCookie(res)
  res.json({ ok: true })
})

// ---------- Protect all /api routes below ----------

app.use('/api', (req, res, next) => {
  // Auth routes are already handled above
  if (req.path.startsWith('/auth/')) return next()
  requireAuth(req, res, next)
})

// Proxy to gateway tools/invoke
async function invokeGateway(tool: string, args: Record<string, any> = {}) {
  const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tool, args }),
  })
  const raw = await res.json()

  // Unwrap gateway envelope: {ok, result: {content: [{text: "..."}], details: {...}}}
  if (raw?.ok && raw?.result) {
    // Prefer details (already parsed) over content text
    if (raw.result.details !== undefined) return raw.result.details
    // Fall back to parsing the text content
    const textContent = raw.result.content?.find((c: any) => c.type === 'text')
    if (textContent?.text) {
      try { return JSON.parse(textContent.text) } catch {}
    }
    return raw.result
  }
  return raw
}

// ========= TODO helpers =========

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

function readTodos(): Todo[] {
  try {
    if (fs.existsSync(TODOS_FILE)) {
      return JSON.parse(fs.readFileSync(TODOS_FILE, 'utf8'))
    }
  } catch {}
  return []
}

function writeTodos(todos: Todo[]) {
  fs.writeFileSync(TODOS_FILE, JSON.stringify(todos, null, 2))
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ========= Helpers: normalize gateway data for frontend =========

function inferSessionKind(session: any): string {
  const key = session.key || session.sessionKey || ''
  if (key.includes(':subagent:')) return 'subagent'
  if (key.includes(':cron:')) return 'cron'
  if (key.endsWith(':main')) return 'main'
  return session.kind === 'other' ? 'main' : (session.kind || 'other')
}

function normalizeSession(s: any): any {
  // Extract last message timestamps for activity
  const messages = (s.messages || []).map((m: any) => {
    const content = Array.isArray(m.content)
      ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ')
      : (typeof m.content === 'string' ? m.content : '')
    return {
      role: m.role,
      content: content.slice(0, 500),
      timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : undefined,
    }
  })

  return {
    sessionKey: s.key || s.sessionKey,
    kind: inferSessionKind(s),
    status: 'active',
    lastActivity: s.updatedAt ? new Date(s.updatedAt).toISOString() : undefined,
    messageCount: s.totalTokens ? Math.ceil(s.totalTokens / 500) : 0, // rough estimate
    model: s.model,
    label: s.label,
    totalTokens: s.totalTokens,
    contextTokens: s.contextTokens,
    recentMessages: messages,
  }
}

function aggregateUsage(sessions: any[]): any {
  let inputTokens = 0
  let outputTokens = 0
  let totalCost = 0
  let model = ''

  for (const s of sessions) {
    if (!model && s.model) model = s.model
    // Sum usage from recent messages
    for (const m of (s.messages || [])) {
      if (m.usage) {
        inputTokens += (m.usage.input || 0) + (m.usage.cacheRead || 0)
        outputTokens += m.usage.output || 0
        if (m.usage.cost?.total) totalCost += m.usage.cost.total
      }
    }
  }

  return { model, inputTokens, outputTokens, cost: totalCost > 0 ? totalCost : undefined }
}

// ========= API Routes =========

app.get('/api/sessions', async (_req, res) => {
  try {
    const result = await invokeGateway('sessions_list', { 
      activeMinutes: 1440, // last 24h
      messageLimit: 3 
    })
    // Normalize session data for frontend
    const raw = result?.sessions || (Array.isArray(result) ? result : [])
    const sessions = raw.map(normalizeSession)
    res.json({ count: sessions.length, sessions })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/sessions/:key/history', async (req, res) => {
  try {
    const result = await invokeGateway('sessions_history', { 
      sessionKey: req.params.key,
      limit: 50,
      includeTools: false
    })
    // Normalize messages
    const messages = (result?.messages || (Array.isArray(result) ? result : []))
      .map((m: any) => ({
        role: m.role,
        content: Array.isArray(m.content)
          ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
          : (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)),
        timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : undefined,
      }))
    res.json({ messages })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/session-status', async (_req, res) => {
  try {
    // Get usage data from sessions_list instead of session_status (which returns text)
    const result = await invokeGateway('sessions_list', { 
      activeMinutes: 1440, 
      messageLimit: 5 
    })
    const raw = result?.sessions || (Array.isArray(result) ? result : [])
    const usage = aggregateUsage(raw)
    res.json(usage)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/cron', async (_req, res) => {
  try {
    const result = await invokeGateway('cron', { action: 'list', includeDisabled: true })
    // Normalize cron job format for frontend
    const rawJobs = result?.jobs || (Array.isArray(result) ? result : [])
    const jobs = rawJobs.map((j: any) => ({
      id: j.id,
      name: j.name || j.id,
      text: j.payload?.text || j.text,
      schedule: j.schedule?.expr || j.schedule || '',
      enabled: j.enabled !== false,
      lastRun: j.state?.lastRunAtMs ? new Date(j.state.lastRunAtMs).toISOString() : undefined,
      nextRun: j.state?.nextRunAtMs ? new Date(j.state.nextRunAtMs).toISOString() : undefined,
      lastStatus: j.state?.lastStatus,
      model: j.model,
      channel: j.channel,
    }))
    res.json({ jobs })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/cron/:id/runs', async (req, res) => {
  try {
    const result = await invokeGateway('cron', { action: 'runs', jobId: req.params.id })
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/processes', async (_req, res) => {
  try {
    const result = await invokeGateway('process', { action: 'list' })
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/agents', async (_req, res) => {
  try {
    const result = await invokeGateway('agents_list', {})
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/memory/search', async (req, res) => {
  try {
    const query = req.query.q as string || ''
    const result = await invokeGateway('memory_search', { query, maxResults: 10 })
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ========= Memory File Browser =========

const WORKSPACE = process.env.WORKSPACE || '/root/clawd'
const ALLOWED_EXTENSIONS = ['.md', '.txt', '.json']

app.get('/api/memory/files', (_req, res) => {
  try {
    const memoryDir = path.join(WORKSPACE, 'memory')
    const files: Array<{ name: string; path: string; size: number; modified: string }> = []

    // Add top-level memory files
    for (const name of ['MEMORY.md', 'AGENTS.md', 'SOUL.md', 'USER.md', 'IDENTITY.md', 'TOOLS.md', 'HEARTBEAT.md']) {
      const fp = path.join(WORKSPACE, name)
      if (fs.existsSync(fp)) {
        const stat = fs.statSync(fp)
        files.push({ name, path: name, size: stat.size, modified: stat.mtime.toISOString() })
      }
    }

    // Add memory/ directory files
    if (fs.existsSync(memoryDir)) {
      const entries = fs.readdirSync(memoryDir).sort().reverse()
      for (const entry of entries) {
        const fp = path.join(memoryDir, entry)
        const stat = fs.statSync(fp)
        if (stat.isFile() && ALLOWED_EXTENSIONS.some(ext => entry.endsWith(ext))) {
          files.push({ name: entry, path: `memory/${entry}`, size: stat.size, modified: stat.mtime.toISOString() })
        }
      }
    }

    res.json(files)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/memory/file', (req, res) => {
  try {
    const filePath = req.query.path as string
    if (!filePath) return res.status(400).json({ error: 'path required' })

    // Security: prevent directory traversal
    const resolved = path.resolve(WORKSPACE, filePath)
    if (!resolved.startsWith(WORKSPACE)) {
      return res.status(403).json({ error: 'Access denied' })
    }
    if (!ALLOWED_EXTENSIONS.some(ext => resolved.endsWith(ext))) {
      return res.status(403).json({ error: 'File type not allowed' })
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const content = fs.readFileSync(resolved, 'utf8')
    const stat = fs.statSync(resolved)
    res.json({ path: filePath, content, size: stat.size, modified: stat.mtime.toISOString() })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ========= Gateway Config & Status =========

app.get('/api/gateway/config', async (_req, res) => {
  try {
    const result = await invokeGateway('gateway', { action: 'config.get' })
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/gateway/status', async (_req, res) => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const r = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tool: 'session_status', args: {} }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    // Any response from the gateway means it's reachable
    if (r.status < 500) {
      res.json({ ok: true, status: 'connected' })
    } else {
      res.json({ ok: false, status: 'error', error: `HTTP ${r.status}` })
    }
  } catch (e: any) {
    res.json({ ok: false, status: 'error', error: e.message })
  }
})

// ========= TODO Routes =========

app.get('/api/todos', (_req, res) => {
  try {
    const todos = readTodos()
    res.json(todos)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/todos', (req, res) => {
  try {
    const { text, priority, category, dueDate } = req.body
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' })
    }
    const todos = readTodos()
    const todo: Todo = {
      id: generateId(),
      text: text.trim(),
      completed: false,
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      category: category?.trim() || undefined,
      dueDate: dueDate || undefined,
      createdAt: new Date().toISOString(),
    }
    todos.unshift(todo)
    writeTodos(todos)
    res.status(201).json(todo)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/todos/:id', (req, res) => {
  try {
    const todos = readTodos()
    const idx = todos.findIndex(t => t.id === req.params.id)
    if (idx === -1) {
      return res.status(404).json({ error: 'Todo not found' })
    }
    const updates = req.body
    const todo = todos[idx]

    if (typeof updates.text === 'string') todo.text = updates.text.trim()
    if (typeof updates.completed === 'boolean') {
      todo.completed = updates.completed
      todo.completedAt = updates.completed ? new Date().toISOString() : undefined
    }
    if (updates.priority && ['low', 'medium', 'high'].includes(updates.priority)) {
      todo.priority = updates.priority
    }
    if (updates.category !== undefined) todo.category = updates.category?.trim() || undefined
    if (updates.dueDate !== undefined) todo.dueDate = updates.dueDate || undefined

    todos[idx] = todo
    writeTodos(todos)
    res.json(todo)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/todos/:id', (req, res) => {
  try {
    let todos = readTodos()
    const idx = todos.findIndex(t => t.id === req.params.id)
    if (idx === -1) {
      return res.status(404).json({ error: 'Todo not found' })
    }
    todos.splice(idx, 1)
    writeTodos(todos)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ========= Serve static files in production =========

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`🦞 Mission Control v0.2.0 running on http://localhost:${PORT}`)
})
