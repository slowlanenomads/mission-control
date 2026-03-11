import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import {
  createToken, verifyToken, hasUsers, createUser, authenticate,
  checkRateLimit, recordFailedAttempt, clearAttempts,
} from './auth'

const app = express()
const PORT = process.env.PORT || 3333

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18789'
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN
if (!GATEWAY_TOKEN) {
  console.error('FATAL: GATEWAY_TOKEN environment variable is required')
  process.exit(1)
}

const DATA_DIR = path.join(__dirname, '../data')
const TODOS_FILE = path.join(DATA_DIR, 'todos.json')
const PROTECTED_FILES = ['AGENTS.md', 'SOUL.md']

app.use(cors({ origin: ['http://76.13.107.133:3333', 'http://localhost:3333'], credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

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

const isProduction = process.env.NODE_ENV === 'production'
const secureSuffix = isProduction ? '; Secure' : ''

function setTokenCookie(res: Response, token: string) {
  res.setHeader('Set-Cookie', `mc_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 86400}${secureSuffix}`)
}

function clearTokenCookie(res: Response) {
  res.setHeader('Set-Cookie', `mc_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureSuffix}`)
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

// ---------- CSRF protection for mutations ----------

function csrfCheck(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  // Skip auth endpoints (login/setup/logout)
  if (req.path.startsWith('/api/auth/')) return next()
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Missing X-Requested-With header' })
  }
  next()
}

app.use('/api', csrfCheck)

// ---------- Protect all /api routes below ----------

app.use('/api', (req, res, next) => {
  // Auth routes are already handled above
  if (req.path.startsWith('/auth/')) return next()
  requireAuth(req, res, next)
})

// Proxy to gateway tools/invoke
async function invokeGateway(tool: string, args: Record<string, any> = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  let res: globalThis.Response
  try {
    res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tool, args }),
      signal: controller.signal,
    })
  } catch (e: any) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') throw new Error('Gateway request timed out (30s)')
    throw e
  }
  clearTimeout(timeout)
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
    messageCount: s.messageCount ?? (s.messages?.length || 0),
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

app.get('/api/sessions', async (req, res) => {
  try {
    const args: Record<string, any> = { 
      activeMinutes: parseInt(req.query.activeMinutes as string) || 1440,
      messageLimit: parseInt(req.query.messageLimit as string) || 3,
    }
    if (req.query.kinds) args.kinds = req.query.kinds
    const result = await invokeGateway('sessions_list', args)
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
      limit: parseInt(req.query.limit as string) || 50,
      includeTools: req.query.includeTools === 'true',
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

// Cron job actions
app.post('/api/cron/:id/run', async (req, res) => {
  try {
    const result = await invokeGateway('cron', { action: 'run', jobId: req.params.id })
    res.json({ ok: true, result })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/cron/:id', async (req, res) => {
  try {
    const result = await invokeGateway('cron', { action: 'update', jobId: req.params.id, ...req.body })
    res.json({ ok: true, result })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/cron/:id', async (req, res) => {
  try {
    const result = await invokeGateway('cron', { action: 'delete', jobId: req.params.id })
    res.json({ ok: true, result })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/cron', async (req, res) => {
  try {
    const result = await invokeGateway('cron', { action: 'create', ...req.body })
    res.json({ ok: true, result })
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

// Session: send message
app.post('/api/sessions/:key/send', async (req, res) => {
  try {
    const { message } = req.body
    if (!message) return res.status(400).json({ error: 'message required' })
    const result = await invokeGateway('sessions_send', { sessionKey: req.params.key, message })
    res.json({ ok: true, result })
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

// Memory file save
app.put('/api/memory/file', (req, res) => {
  try {
    const { path: filePath, content } = req.body
    if (!filePath || typeof content !== 'string') return res.status(400).json({ error: 'path and content required' })

    // Max content length check (100KB)
    if (content.length > 102400) {
      return res.status(413).json({ error: 'Content too large (max 100KB)' })
    }

    // Protected files check
    if (PROTECTED_FILES.includes(filePath)) {
      return res.status(403).json({ error: 'Cannot modify protected file' })
    }

    const resolved = path.resolve(WORKSPACE, filePath)
    if (!resolved.startsWith(WORKSPACE)) {
      return res.status(403).json({ error: 'Access denied' })
    }
    if (!ALLOWED_EXTENSIONS.some(ext => resolved.endsWith(ext))) {
      return res.status(403).json({ error: 'File type not allowed' })
    }

    // Ensure directory exists
    const dir = path.dirname(resolved)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    fs.writeFileSync(resolved, content, 'utf8')
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// Dashboard actions
app.post('/api/actions/sync', async (_req, res) => {
  try {
    const result = await invokeGateway('empire_sync', {})
    res.json({ ok: true, result })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/actions/restart-gateway', async (_req, res) => {
  try {
    const result = await invokeGateway('gateway', { action: 'restart' })
    res.json({ ok: true, result })
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

// ========= Sub-agent Run History (scans transcript files) =========

const SESSIONS_DIR = '/root/.openclaw/agents/main/sessions/'

function parseTranscriptRun(filePath: string): any | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
    if (!lines.length) return null

    const session = lines[0]
    if (session?.type !== 'session') return null

    const sid = session.id || ''
    const startedAt = session.timestamp || ''
    let model = ''
    let task = ''
    let findings = ''
    let completedAt = ''
    let totalIn = 0
    let totalOut = 0
    let totalCost = 0

    for (const l of lines) {
      if (l.type === 'model_change' && l.modelId) model = l.modelId
      if (l.type === 'message') {
        const msg = l.message || {}
        const usage = l.usage || msg.usage || {}
        // First user message = task
        if (msg.role === 'user' && !task) {
          const c = msg.content
          if (Array.isArray(c)) {
            const txt = c.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
            task = txt
          } else if (typeof c === 'string') {
            task = c
          }
        }
        // Last assistant text = findings
        if (msg.role === 'assistant') {
          const c = msg.content
          if (Array.isArray(c)) {
            const txt = c.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
            if (txt) findings = txt
          } else if (typeof c === 'string' && c) {
            findings = c
          }
          if (l.timestamp) completedAt = l.timestamp
          if (usage.input) totalIn += (usage.input || 0) + (usage.cacheRead || 0)
          if (usage.output) totalOut += usage.output || 0
          if (usage.cost?.total) totalCost += usage.cost.total
        }
      }
    }

    if (!task) return null

    // Strip timestamp prefix from task (e.g. "[Fri 2026-02-20 04:31 UTC] ")
    task = task.replace(/^\[.*?\]\s*/, '')

    let durationMs = 0
    if (startedAt && completedAt) {
      try {
        durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()
      } catch {}
    }

    return {
      id: sid,
      task: task.slice(0, 300),
      status: 'completed',
      model: model || 'unknown',
      startedAt,
      completedAt: completedAt || startedAt,
      durationMs: Math.max(durationMs, 0),
      findings: findings.slice(0, 1000),
      tokensIn: totalIn,
      tokensOut: totalOut,
      cost: Math.round(totalCost * 10000) / 10000,
      sessionId: sid,
    }
  } catch {
    return null
  }
}

// Keep POST for manual logging (backwards compat)
const SUBAGENT_HISTORY_FILE = '/root/.openclaw/subagent-history.jsonl'
app.post('/api/subagent-runs', (req, res) => {
  const run = req.body
  run.id = run.id || crypto.randomUUID()
  run.loggedAt = new Date().toISOString()
  fs.appendFileSync(SUBAGENT_HISTORY_FILE, JSON.stringify(run) + '\n')
  res.json({ ok: true, id: run.id })
})

app.get('/api/subagent-runs', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100
  const status = req.query.status as string

  try {
    if (!fs.existsSync(SESSIONS_DIR)) return res.json({ runs: [] })

    // Get main session ID to exclude it
    const mainSessionFile = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.jsonl') && !f.includes('.deleted') && !f.includes('.lock'))
      .sort((a, b) => {
        const sa = fs.statSync(path.join(SESSIONS_DIR, a)).size
        const sb = fs.statSync(path.join(SESSIONS_DIR, b)).size
        return sb - sa // Largest file = main session
      })[0]
    const mainSessionId = mainSessionFile?.replace('.jsonl', '') || ''

    // Scan all transcript files (including deleted = historical)
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => (f.endsWith('.jsonl') || f.includes('.jsonl.deleted')) && !f.includes('.lock'))

    let runs: any[] = []
    for (const file of files) {
      const sid = file.split('.')[0]
      // Skip main session (it's huge and not a sub-agent)
      if (sid === mainSessionId) continue
      // Skip very small files (likely empty or just session headers)
      const filePath = path.join(SESSIONS_DIR, file)
      const stat = fs.statSync(filePath)
      if (stat.size < 500) continue

      const run = parseTranscriptRun(filePath)
      if (run) {
        // Detect if it's a cron job
        const isCron = /^\[cron:|^Read HEARTBEAT|^checkpoint|^Mid-?day|^Mid$/i.test(run.task.trim())
        run.type = isCron ? 'cron' : 'subagent'
        // Clean up cron task labels
        if (isCron) {
          const cronMatch = run.task.match(/^\[cron:\S+\s+([^\]]+)\]/)
          if (cronMatch) run.task = cronMatch[1]
        }
        runs.push(run)
      }
    }

    // Sort by completedAt descending
    runs.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

    // Filter
    if (status && status !== 'all') runs = runs.filter(r => r.status === status)

    // Type filter from query
    const typeFilter = req.query.type as string
    if (typeFilter && typeFilter !== 'all') runs = runs.filter(r => r.type === typeFilter)

    runs = runs.slice(0, limit)
    res.json({ runs })
  } catch (e: any) {
    res.status(500).json({ error: e.message, runs: [] })
  }
})

// ========= Transcript Deep Dive =========

app.get('/api/transcript/:sessionId', (req, res) => {
  const sid = req.params.sessionId
  // Sanitize session ID to prevent path traversal
  if (!/^[a-f0-9-]+$/i.test(sid)) return res.status(400).json({ error: 'Invalid session ID' })

  try {
    // Find the transcript file (active or deleted)
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.startsWith(sid) && !f.includes('.lock'))
    if (!files.length) return res.status(404).json({ error: 'Transcript not found' })

    const filePath = path.join(SESSIONS_DIR, files[0])
    const content = fs.readFileSync(filePath, 'utf-8')
    const rawLines = content.trim().split('\n').filter(Boolean)

    let sessionMeta: any = {}
    let model = ''
    let thinkingLevel = ''
    const messages: any[] = []
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheRead = 0
    let totalCacheWrite = 0
    let totalCost = 0
    let toolCallCount = 0
    const toolBreakdown: Record<string, { count: number; totalTokensOut: number }> = {}

    for (const line of rawLines) {
      let parsed: any
      try { parsed = JSON.parse(line) } catch { continue }

      if (parsed.type === 'session') {
        sessionMeta = {
          id: parsed.id,
          startedAt: parsed.timestamp,
          cwd: parsed.cwd,
          version: parsed.version,
        }
        continue
      }

      if (parsed.type === 'model_change') {
        model = parsed.modelId || model
        continue
      }

      if (parsed.type === 'thinking_level_change') {
        thinkingLevel = parsed.thinkingLevel || thinkingLevel
        continue
      }

      if (parsed.type === 'message') {
        const msg = parsed.message || {}
        const usage = parsed.usage || msg.usage || {}
        const role = msg.role || 'unknown'

        const entry: any = {
          role,
          timestamp: parsed.timestamp || '',
          id: parsed.id || '',
        }

        // Extract content
        if (Array.isArray(msg.content)) {
          entry.content = []
          for (const part of msg.content) {
            if (part.type === 'text') {
              entry.content.push({ type: 'text', text: part.text || '' })
            } else if (part.type === 'toolCall') {
              toolCallCount++
              const toolName = part.name || 'unknown'
              if (!toolBreakdown[toolName]) toolBreakdown[toolName] = { count: 0, totalTokensOut: 0 }
              toolBreakdown[toolName].count++
              entry.content.push({
                type: 'toolCall',
                id: part.id || '',
                name: toolName,
                arguments: typeof part.arguments === 'string' 
                  ? part.arguments.slice(0, 2000) 
                  : JSON.stringify(part.arguments || {}).slice(0, 2000),
              })
            } else if (part.type === 'toolResult') {
              entry.content.push({
                type: 'toolResult',
                toolCallId: part.toolCallId || '',
                text: (typeof part.content === 'string' ? part.content : JSON.stringify(part.content || '')).slice(0, 3000),
              })
            } else if (part.type === 'thinking') {
              entry.content.push({ type: 'thinking', text: (part.text || '').slice(0, 2000) })
            }
          }
        } else if (typeof msg.content === 'string') {
          entry.content = [{ type: 'text', text: msg.content }]
        }

        // Extract usage
        if (usage && (usage.input || usage.output)) {
          const input = usage.input || 0
          const output = usage.output || 0
          const cacheRead = usage.cacheRead || 0
          const cacheWrite = usage.cacheWrite || 0
          const cost = usage.cost?.total || 0

          entry.usage = {
            input,
            output,
            cacheRead,
            cacheWrite,
            totalTokens: usage.totalTokens || (input + output + cacheRead + cacheWrite),
            cost: Math.round(cost * 10000) / 10000,
            cacheHitRate: (input + cacheRead) > 0 
              ? Math.round((cacheRead / (input + cacheRead)) * 100) 
              : 0,
          }

          totalInputTokens += input
          totalOutputTokens += output
          totalCacheRead += cacheRead
          totalCacheWrite += cacheWrite
          totalCost += cost

          // Track tokens per tool
          if (role === 'assistant' && entry.content) {
            for (const part of entry.content) {
              if (part.type === 'toolCall' && toolBreakdown[part.name]) {
                toolBreakdown[part.name].totalTokensOut += output
              }
            }
          }
        }

        // Add running totals
        entry.cumulative = {
          tokens: totalInputTokens + totalOutputTokens + totalCacheRead + totalCacheWrite,
          cost: Math.round(totalCost * 10000) / 10000,
        }

        messages.push(entry)
        continue
      }
    }

    // Calculate session duration
    const firstTs = sessionMeta.startedAt
    const lastTs = messages.length ? messages[messages.length - 1].timestamp : firstTs
    let durationMs = 0
    if (firstTs && lastTs) {
      try { durationMs = new Date(lastTs).getTime() - new Date(firstTs).getTime() } catch {}
    }

    // Overall cache hit rate
    const totalInput = totalInputTokens + totalCacheRead
    const overallCacheHitRate = totalInput > 0 ? Math.round((totalCacheRead / totalInput) * 100) : 0

    res.json({
      session: {
        ...sessionMeta,
        model,
        thinkingLevel,
        completedAt: lastTs,
        durationMs,
        deleted: files[0].includes('.deleted'),
      },
      stats: {
        messageCount: messages.length,
        userMessages: messages.filter(m => m.role === 'user').length,
        assistantMessages: messages.filter(m => m.role === 'assistant').length,
        toolResultMessages: messages.filter(m => m.role === 'toolResult').length,
        toolCallCount,
        totalInputTokens,
        totalOutputTokens,
        totalCacheRead,
        totalCacheWrite,
        totalTokens: totalInputTokens + totalOutputTokens + totalCacheRead + totalCacheWrite,
        totalCost: Math.round(totalCost * 10000) / 10000,
        overallCacheHitRate,
        toolBreakdown: Object.entries(toolBreakdown)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.count - a.count),
      },
      messages,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ========= New System & Cost API Endpoints =========

app.get('/api/system/health', async (_req, res) => {
  try {
    const os = await import('os')
    const { execSync } = await import('child_process')
    
    // CPU info
    const cpus = os.cpus()
    const loadAvg = os.loadavg()
    
    // Memory
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    
    // Disk (parse df output)
    let disk = { total: 0, used: 0, available: 0, percent: 0 }
    try {
      const df = execSync('df -B1 / | tail -1').toString().trim().split(/\s+/)
      disk = { total: parseInt(df[1]), used: parseInt(df[2]), available: parseInt(df[3]), percent: parseInt(df[4]) }
    } catch {}
    
    // Uptime
    const uptimeSeconds = os.uptime()
    
    // Services status
    const services = ['empire-backend', 'empire-backend-dev', 'mission-control', 'nginx'].map(name => {
      try {
        const status = execSync(`systemctl is-active ${name} 2>/dev/null`).toString().trim()
        return { name, status }
      } catch {
        return { name, status: 'inactive' }
      }
    })

    // OpenClaw gateway
    try {
      const r = await fetch(`${GATEWAY_URL}/tools/invoke`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GATEWAY_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'session_status', args: {} }),
        signal: AbortSignal.timeout(5000),
      })
      services.push({ name: 'openclaw-gateway', status: r.status < 500 ? 'active' : 'error' })
    } catch {
      services.push({ name: 'openclaw-gateway', status: 'error' })
    }
    
    res.json({
      cpu: { cores: cpus.length, model: cpus[0]?.model, loadAvg: { '1m': loadAvg[0], '5m': loadAvg[1], '15m': loadAvg[2] } },
      memory: { total: totalMem, used: usedMem, free: freeMem, percent: Math.round((usedMem / totalMem) * 100) },
      disk,
      uptime: uptimeSeconds,
      services,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/system/logs/:service', (req, res) => {
  try {
    const { execSync } = require('child_process')
    const service = req.params.service
    // Whitelist services
    const allowed = ['empire-backend', 'empire-backend-dev', 'mission-control', 'nginx', 'openclaw-gateway']
    if (!allowed.includes(service)) return res.status(400).json({ error: 'Unknown service' })
    
    const lines = Math.min(parseInt(req.query.lines as string) || 100, 500)
    const since = req.query.since as string
    
    let cmd = `journalctl -u ${service} --no-pager -n ${lines} --output short-iso`
    if (since) cmd += ` --since "${since.replace(/[^a-z0-9 :-]/gi, '')}"`
    
    const output = execSync(cmd, { timeout: 10000 }).toString()
    const logLines = output.trim().split('\n').map((line: string) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\[?\d*\]?:\s*(.*)/)
      return match ? { timestamp: match[1], host: match[2], unit: match[3], message: match[4] } : { message: line }
    })
    
    res.json({ service, lines: logLines, count: logLines.length })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/system/restart/:service', (req, res) => {
  try {
    const { execSync } = require('child_process')
    const service = req.params.service
    const allowed = ['empire-backend', 'empire-backend-dev', 'mission-control', 'nginx']
    if (!allowed.includes(service)) return res.status(400).json({ error: 'Cannot restart this service' })
    
    execSync(`systemctl restart ${service}`, { timeout: 30000 })
    res.json({ ok: true, service, message: `${service} restarted` })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/cost/summary', (req, res) => {
  try {
    const sessionsDir = '/root/.openclaw/agents/main/sessions/'
    if (!fs.existsSync(sessionsDir)) return res.json({ daily: [], total: 0 })
    
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl') && !f.includes('.lock'))
    
    // Aggregate by date and model
    const dailyCosts: Record<string, { date: string, cost: number, inputTokens: number, outputTokens: number, cacheRead: number, byModel: Record<string, { cost: number, input: number, output: number }> }> = {}
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(sessionsDir, file), 'utf-8')
        const lines = content.trim().split('\n')
        let currentModel = ''
        
        for (const line of lines) {
          let parsed: any
          try { parsed = JSON.parse(line) } catch { continue }
          
          if (parsed.type === 'model_change') currentModel = parsed.modelId || currentModel
          
          if (parsed.type === 'message') {
            const usage = parsed.usage || parsed.message?.usage || {}
            if (!usage.cost?.total) continue
            
            const ts = parsed.timestamp || ''
            const date = ts.slice(0, 10) // YYYY-MM-DD
            if (!date) continue
            
            if (!dailyCosts[date]) {
              dailyCosts[date] = { date, cost: 0, inputTokens: 0, outputTokens: 0, cacheRead: 0, byModel: {} }
            }
            
            dailyCosts[date].cost += usage.cost.total
            dailyCosts[date].inputTokens += usage.input || 0
            dailyCosts[date].outputTokens += usage.output || 0
            dailyCosts[date].cacheRead += usage.cacheRead || 0
            
            const model = currentModel || 'unknown'
            if (!dailyCosts[date].byModel[model]) {
              dailyCosts[date].byModel[model] = { cost: 0, input: 0, output: 0 }
            }
            dailyCosts[date].byModel[model].cost += usage.cost.total
            dailyCosts[date].byModel[model].input += usage.input || 0
            dailyCosts[date].byModel[model].output += usage.output || 0
          }
        }
      } catch { continue }
    }
    
    const daily = Object.values(dailyCosts)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30) // Last 30 days
      .map(d => ({ ...d, cost: Math.round(d.cost * 10000) / 10000 }))
    
    const totalCost = daily.reduce((sum, d) => sum + d.cost, 0)
    const totalInput = daily.reduce((sum, d) => sum + d.inputTokens, 0)
    const totalOutput = daily.reduce((sum, d) => sum + d.outputTokens, 0)
    
    res.json({ daily, totalCost: Math.round(totalCost * 100) / 100, totalInput, totalOutput })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/empire/status', async (_req, res) => {
  try {
    // Hit dev and prod Empire APIs
    const results: any = {}
    
    for (const [env, port] of [['dev', 8001], ['prod', 8000]]) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const r = await fetch(`http://localhost:${port}/api/sync/status`, { signal: controller.signal })
        clearTimeout(timeout)
        if (r.ok) {
          results[env] = { status: 'online', sync: await r.json() }
        } else {
          results[env] = { status: 'online', error: `HTTP ${r.status}` }
        }
      } catch {
        results[env] = { status: 'offline' }
      }
    }
    
    res.json(results)
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
