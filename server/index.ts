import express from 'express'
import cors from 'cors'
import path from 'path'

const app = express()
const PORT = process.env.PORT || 3333

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18789'
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '4e5fe116c0397c5bce9654143fcd6dfcf58d70204ee5c698'

app.use(cors())
app.use(express.json())

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
  return res.json()
}

// API Routes
app.get('/api/sessions', async (_req, res) => {
  try {
    const result = await invokeGateway('sessions_list', { 
      activeMinutes: 1440, // last 24h
      messageLimit: 3 
    })
    res.json(result)
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
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/session-status', async (req, res) => {
  try {
    const sessionKey = req.query.sessionKey as string | undefined
    const result = await invokeGateway('session_status', sessionKey ? { sessionKey } : {})
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/cron', async (_req, res) => {
  try {
    const result = await invokeGateway('cron', { action: 'list', includeDisabled: true })
    res.json(result)
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`🦞 Mission Control running on http://localhost:${PORT}`)
})
