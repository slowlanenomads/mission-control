import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import { formatDistanceToNow } from 'date-fns'

// Color constants
const COLORS = {
  green: '#00ff41',
  greenDark: '#0a3d0a',
  greenMid: '#00aa2a',
  cyan: '#00d4ff',
  amber: '#ffb000',
  red: '#ff3333',
  bg: '#0a0a0a',
  grid: '#0d1f0d',
}

// Interfaces
interface AgentNode {
  id: string
  label: string
  kind: 'main' | 'subagent' | 'cron'
  x: number
  y: number
  targetX: number
  targetY: number
  radius: number
  alpha: number
  pulsePhase: number
  messageCount: number
  lastActivity: number
  status?: string  // For sub-agents: 'running', 'done', 'error', 'idle'
  model?: string   // For sub-agents: model name
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
}

interface DataPacket {
  fromNode: string
  toNode: string
  progress: number // 0-1
  speed: number
  color: string
  type: 'spawn' | 'response' | 'error' // packet type
}

interface CircuitTrace {
  points: { x: number; y: number }[]
  progress: number
  maxProgress: number
}

interface PulseRing {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
}

interface Session {
  sessionKey: string
  kind: string
  status: string
  lastActivity: string
  messageCount: number
  model?: string
  thinkingLevel?: string
  fastMode?: boolean | null
  dreamingEnabled?: boolean | null
  recentMessages?: Array<{ role: string; content: string; timestamp: string }>
}

interface LiveStatus {
  model?: string
  tokens?: { input?: number; output?: number; total?: number }
  cost?: { session?: number }
  runtime?: { thinking?: string }
  fastMode?: boolean | null
  dreamingEnabled?: boolean | null
}

interface SystemHealth {
  cpu?: {
    cores: number
    loadAvg: {
      '1m': number
      '5m': number
      '15m': number
    }
  }
  memory?: {
    total: number
    used: number
    percent: number
  }
  disk?: {
    total: number
    used: number
    percent: number
  }
  uptime?: number
}

interface CronJob {
  name: string
  schedule: string
  nextRun: string
  enabled: boolean
}

interface SubagentRun {
  id: string
  sessionKey: string
  label?: string
  status: string
  spawned: string
  model: string
}

// Helper functions
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${mins}m`
}

function shortenModel(model: string): string {
  if (model.includes('gpt-5.4')) return 'GPT-5.4'
  if (model.includes('gpt-5.3')) return 'GPT-5.3'
  if (model.includes('claude-opus')) return 'Opus'
  if (model.includes('claude-sonnet-4')) return 'Sonnet 4.6'
  if (model.includes('gemini-2.5-pro')) return 'Gemini 2.5'
  if (model.includes('gemini-2.5-flash')) return 'Flash 2.5'
  // Fallback: extract last meaningful segment
  const parts = model.split('/')
  return parts[parts.length - 1].split('-').slice(0, 2).join(' ')
}

function formatCountdown(nextRun: string): string {
  try {
    const diff = new Date(nextRun).getTime() - Date.now()
    if (diff <= 0) return 'now'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  } catch {
    return 'unknown'
  }
}

function getNodeColor(kind: string, status?: string): string {
  if (kind === 'main') return COLORS.green
  if (kind === 'cron') return COLORS.amber
  
  // Sub-agent status-based colors
  if (kind === 'subagent') {
    switch (status) {
      case 'running': return COLORS.amber
      case 'done': return COLORS.green
      case 'error': 
      case 'timeout': return COLORS.red
      default: return '#333333' // dim grey for idle/old
    }
  }
  
  return COLORS.green
}

function createParticles(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    alpha: (0.3 + Math.random() * 0.4) * 0.2, // Reduced to 20%
    size: 1 + Math.random() * 2,
  }))
}

function createCircuitTraces(count: number, width: number, height: number): CircuitTrace[] {
  return Array.from({ length: count }, () => {
    const startX = Math.random() * width
    const startY = Math.random() * height
    const points = [{ x: startX, y: startY }]
    
    let currentX = startX
    let currentY = startY
    
    // Create L-shaped paths
    for (let i = 0; i < 3 + Math.random() * 4; i++) {
      const horizontal = Math.random() > 0.5
      if (horizontal) {
        currentX += (Math.random() - 0.5) * 200
        points.push({ x: currentX, y: currentY })
      } else {
        currentY += (Math.random() - 0.5) * 200
        points.push({ x: currentX, y: currentY })
      }
    }
    
    return {
      points,
      progress: 0,
      maxProgress: points.length * 20,
    }
  })
}

// Drawing functions
function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 0.5
  ctx.globalAlpha = 0.3 + Math.sin(time * 0.5) * 0.1 // breathing effect
  
  // Vertical lines
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  
  // Horizontal lines
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  
  ctx.globalAlpha = 1
}

function drawTrace(ctx: CanvasRenderingContext2D, trace: CircuitTrace) {
  if (trace.points.length < 2) return
  
  ctx.strokeStyle = COLORS.greenMid
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.6
  
  const segmentsToShow = Math.floor(trace.progress / 20)
  
  ctx.beginPath()
  ctx.moveTo(trace.points[0].x, trace.points[0].y)
  
  for (let i = 1; i <= Math.min(segmentsToShow, trace.points.length - 1); i++) {
    ctx.lineTo(trace.points[i].x, trace.points[i].y)
  }
  
  ctx.stroke()
  ctx.globalAlpha = 1
  
  // Advance progress
  trace.progress += 0.5
  if (trace.progress > trace.maxProgress) {
    trace.progress = 0
  }
}

function drawNode(ctx: CanvasRenderingContext2D, node: AgentNode, time: number) {
  const color = getNodeColor(node.kind, node.status)
  
  // Main node background
  ctx.fillStyle = color
  ctx.globalAlpha = node.alpha * 0.3
  ctx.beginPath()
  ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
  ctx.fill()
  
  // Pulsing ring for main node or running sub-agents
  if (node.kind === 'main' || (node.kind === 'subagent' && node.status === 'running')) {
    const pulseRadius = node.radius + Math.sin(node.pulsePhase) * (node.kind === 'main' ? 10 : 5)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.globalAlpha = node.alpha * (0.5 + Math.sin(node.pulsePhase) * 0.3)
    ctx.beginPath()
    ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2)
    ctx.stroke()
    
    // Outer concentric rings for main node
    if (node.kind === 'main') {
      for (let i = 1; i <= 2; i++) {
        ctx.globalAlpha = node.alpha * (0.3 - i * 0.1) * (0.5 + Math.sin(node.pulsePhase + i) * 0.3)
        ctx.beginPath()
        ctx.arc(node.x, node.y, pulseRadius + i * 15, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }
  
  // Node border
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.globalAlpha = node.alpha
  ctx.beginPath()
  ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
  ctx.stroke()
  
  // Node label
  ctx.fillStyle = color
  ctx.font = '12px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  if (node.kind === 'main') {
    ctx.fillText(node.label, node.x, node.y - 5)
    ctx.font = '10px monospace'
    ctx.fillText(node.model || 'MAIN SESSION', node.x, node.y + 8)
  } else {
    // Sub-agent label
    ctx.fillText(node.label, node.x, node.y + node.radius + 15)
    
    // Sub-agent model name
    if (node.model) {
      ctx.font = '9px monospace'
      ctx.fillText(shortenModel(node.model), node.x, node.y + node.radius + 28)
    }
  }
  
  ctx.globalAlpha = 1
}

function drawConnectionLine(ctx: CanvasRenderingContext2D, fromNode: AgentNode, toNode: AgentNode) {
  const opacity = toNode.status === 'running' ? 0.4 : 
                 toNode.status === 'done' ? Math.max(0.1, 0.4 - (Date.now() - toNode.lastActivity) / 10000) : 
                 toNode.status === 'error' ? 0.6 : 0.1
  
  const color = toNode.status === 'error' ? COLORS.red : COLORS.cyan
  const isDashed = toNode.status !== 'running'
  
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.globalAlpha = opacity
  
  if (isDashed) {
    ctx.setLineDash([5, 5])
  } else {
    ctx.setLineDash([])
  }
  
  ctx.beginPath()
  ctx.moveTo(fromNode.x, fromNode.y)
  ctx.lineTo(toNode.x, toNode.y)
  ctx.stroke()
  
  ctx.setLineDash([]) // Reset dash pattern
  ctx.globalAlpha = 1
}

function drawPacket(ctx: CanvasRenderingContext2D, packet: DataPacket, nodes: AgentNode[]) {
  const fromNode = nodes.find(n => n.id === packet.fromNode)
  const toNode = nodes.find(n => n.id === packet.toNode)
  
  if (!fromNode || !toNode) return
  
  const x = fromNode.x + (toNode.x - fromNode.x) * packet.progress
  const y = fromNode.y + (toNode.y - fromNode.y) * packet.progress
  
  // Draw glowing dot
  ctx.fillStyle = packet.color
  ctx.shadowColor = packet.color
  ctx.shadowBlur = 8
  ctx.globalAlpha = 0.9
  
  ctx.beginPath()
  ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.fill()
  
  // Draw trail
  const trailLength = 3
  for (let i = 1; i <= trailLength; i++) {
    const trailProgress = Math.max(0, packet.progress - i * 0.05)
    const trailX = fromNode.x + (toNode.x - fromNode.x) * trailProgress
    const trailY = fromNode.y + (toNode.y - fromNode.y) * trailProgress
    
    ctx.globalAlpha = 0.9 * (1 - i / trailLength) * 0.5
    ctx.beginPath()
    ctx.arc(trailX, trailY, 3 * (1 - i / trailLength), 0, Math.PI * 2)
    ctx.fill()
  }
  
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  
  packet.progress += packet.speed
}

function drawPulseRing(ctx: CanvasRenderingContext2D, pulse: PulseRing) {
  ctx.strokeStyle = COLORS.cyan
  ctx.lineWidth = 2
  ctx.globalAlpha = pulse.alpha
  
  ctx.beginPath()
  ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2)
  ctx.stroke()
  
  ctx.globalAlpha = 1
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  ctx.fillStyle = COLORS.green
  ctx.globalAlpha = particle.alpha
  ctx.shadowColor = COLORS.green
  ctx.shadowBlur = 4
  
  ctx.beginPath()
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}

function drawScanline(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const scanY = (time * 100) % (height + 100) - 50
  if (scanY < -50 || scanY > height + 50) return
  
  const gradient = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2)
  gradient.addColorStop(0, 'transparent')
  gradient.addColorStop(0.5, COLORS.cyan)
  gradient.addColorStop(1, 'transparent')
  
  ctx.fillStyle = gradient
  ctx.globalAlpha = 0.6
  ctx.fillRect(0, scanY - 2, width, 4)
  ctx.globalAlpha = 1
}

interface HistoryMessage {
  role: string
  content: string
  timestamp?: string
}

export default function TheGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [totalTokens, setTotalTokens] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null)
  const [nodeHistory, setNodeHistory] = useState<HistoryMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  
  // API data
  const { data: sessions } = useApi<Session[]>('/api/sessions?activeMinutes=60&messageLimit=3', { interval: 5000 })
  const { data: subagentRuns } = useApi<SubagentRun[]>('/api/subagent-runs?limit=20', { interval: 10000 })
  const { data: systemHealth } = useApi<SystemHealth>('/api/system/health', { interval: 10000 })
  const { data: cronJobs } = useApi<CronJob[]>('/api/cron', { interval: 30000 })
  const { data: sessionStatus } = useApi<LiveStatus>('/api/session-status-live', { interval: 10000 })
  
  const stateRef = useRef({
    nodes: [] as AgentNode[],
    particles: [] as Particle[],
    packets: [] as DataPacket[],
    traces: [] as CircuitTrace[],
    pulses: [] as PulseRing[],
    time: 0,
    lastMessageCounts: new Map<string, number>(),
    prevSubagentStates: new Map<string, string>(),
  })
  
  // Initialize canvas and particles
  useEffect(() => {
    const updateDimensions = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      
      const rect = canvas.getBoundingClientRect()
      const width = window.innerWidth
      const height = window.innerHeight
      
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }
      
      setDimensions({ width, height })
      
      // Initialize particles and traces
      const state = stateRef.current
      state.particles = createParticles(16, width, height) // Reduced from 80 to 16 (20%)
      state.traces = createCircuitTraces(12, width, height)
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    
    return () => {
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])
  
  // Handle canvas clicks — find nearest node
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const state = stateRef.current
    let closest: AgentNode | null = null
    let closestDist = Infinity
    
    for (const node of state.nodes) {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
      if (dist < node.radius + 15 && dist < closestDist) {
        closest = node
        closestDist = dist
      }
    }
    
    if (closest) {
      setSelectedNode(closest)
      // Fetch history for this node's session
      const sessionKey = closest.id === 'main' 
        ? sessions && (Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []).find((s: Session) => s.kind === 'main')?.sessionKey
        : (Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []).find((s: Session) => s.sessionKey.includes(closest!.id))?.sessionKey || closest.id
      
      if (sessionKey) {
        setLoadingHistory(true)
        setNodeHistory([])
        fetch(`/api/sessions/${encodeURIComponent(sessionKey)}/history?limit=30`, { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.messages) {
              setNodeHistory(data.messages.filter((m: any) => m.role !== 'system').slice(-30))
            }
          })
          .catch(() => {})
          .finally(() => setLoadingHistory(false))
      }
    } else {
      setSelectedNode(null)
      setNodeHistory([])
    }
  }, [sessions])
  
  // Update nodes based on session data
  useEffect(() => {
    if (!sessions || dimensions.width === 0) return
    
    const state = stateRef.current
    const sessionList: Session[] = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []
    const subagentList: SubagentRun[] = Array.isArray(subagentRuns) ? subagentRuns : []
    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2
    
    // Create main node
    const mainNode: AgentNode = {
      id: 'main',
      label: 'SYKE_AGENT_1',
      kind: 'main',
      model: sessionStatus?.model ? shortenModel(sessionStatus.model) : 'MAIN SESSION',
      x: centerX,
      y: centerY,
      targetX: centerX,
      targetY: centerY,
      radius: 40,
      alpha: 1,
      pulsePhase: 0,
      messageCount: sessionList.reduce((sum, s) => sum + (s.messageCount || 0), 0),
      lastActivity: Date.now(),
    }
    
    // Create sub-agent nodes from subagentRuns data
    const subagentNodes: AgentNode[] = []
    subagentList.forEach((run, index) => {
      const angle = (index / Math.max(subagentList.length, 1)) * Math.PI * 2
      const distance = 150
      const targetX = centerX + Math.cos(angle) * distance
      const targetY = centerY + Math.sin(angle) * distance
      
      // Find existing node to preserve position
      const existingNode = state.nodes.find(n => n.id === run.id)
      
      subagentNodes.push({
        id: run.id,
        label: run.label || run.id.slice(-8),
        kind: 'subagent',
        x: existingNode ? existingNode.x : targetX,
        y: existingNode ? existingNode.y : targetY,
        targetX: targetX,
        targetY: targetY,
        radius: 20,
        alpha: 1,
        pulsePhase: existingNode ? existingNode.pulsePhase : 0,
        messageCount: 0,
        lastActivity: new Date(run.spawned).getTime(),
        status: run.status,
        model: run.model,
      })
    })
    
    // Create cron nodes
    const cronNodes: AgentNode[] = []
    const cronList = Array.isArray(cronJobs) ? cronJobs : (cronJobs as any)?.jobs ?? []
    if (cronList.length > 0) {
      const activeCron = cronList.filter((job: CronJob) => job.enabled)
      activeCron.slice(0, 6).forEach((job: CronJob, index: number) => {
        const angle = (index / Math.max(activeCron.length, 6)) * Math.PI * 2
        const distance = 250
        const targetX = centerX + Math.cos(angle) * distance
        const targetY = centerY + Math.sin(angle) * distance
        
        cronNodes.push({
          id: `cron-${job.name}`,
          label: job.name.slice(0, 8),
          kind: 'cron',
          x: targetX,
          y: targetY,
          targetX: targetX,
          targetY: targetY,
          radius: 15,
          alpha: 0.8,
          pulsePhase: 0,
          messageCount: 0,
          lastActivity: Date.now(),
        })
      })
    }
    
    // Handle state transitions and create appropriate data packets
    const newPackets: DataPacket[] = []
    subagentList.forEach(run => {
      const prevStatus = state.prevSubagentStates.get(run.id)
      
      if (!prevStatus && run.status === 'running') {
        // NEW: spawn packet (outbound)
        newPackets.push({
          fromNode: 'main',
          toNode: run.id,
          progress: 0,
          speed: 0.025,
          color: '#00d4ff', // blue
          type: 'spawn',
        })
      }
      
      if (prevStatus === 'running' && run.status === 'done') {
        // COMPLETED: response packet (inbound)
        newPackets.push({
          fromNode: run.id,
          toNode: 'main',
          progress: 0,
          speed: 0.025,
          color: COLORS.green,
          type: 'response',
        })
      }
      
      if (prevStatus === 'running' && (run.status === 'error' || run.status === 'timeout')) {
        // ERROR: error packet (inbound)
        newPackets.push({
          fromNode: run.id,
          toNode: 'main',
          progress: 0,
          speed: 0.025,
          color: COLORS.red,
          type: 'error',
        })
      }
      
      state.prevSubagentStates.set(run.id, run.status)
    })
    
    const newNodes = [mainNode, ...subagentNodes, ...cronNodes]
    
    // Check for new messages and create pulses
    newNodes.forEach(node => {
      const lastCount = state.lastMessageCounts.get(node.id) || 0
      if (node.messageCount > lastCount) {
        // New message detected - create pulse
        state.pulses.push({
          x: node.x,
          y: node.y,
          radius: 5,
          maxRadius: 80,
          alpha: 1,
        })
        state.lastMessageCounts.set(node.id, node.messageCount)
      }
    })
    
    state.nodes = newNodes
    state.packets = [...state.packets.filter(p => p.progress < 1), ...newPackets]
    
  }, [sessions, subagentRuns, cronJobs, dimensions])

  // Update real token and cost data
  useEffect(() => {
    if (sessionStatus) {
      const totalInput = sessionStatus.tokens?.input || 0
      const totalOutput = sessionStatus.tokens?.output || 0
      const total = sessionStatus.tokens?.total || (totalInput + totalOutput)
      setTotalTokens(total)
      setTotalCost(sessionStatus.cost?.session || 0)
    }
  }, [sessionStatus])
  
  // Animation loop
  useEffect(() => {
    const animate = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const { width, height } = dimensions
      if (width === 0 || height === 0) return
      
      const state = stateRef.current
      state.time += 0.016
      
      // Clear
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, width, height)
      
      // 1. Grid
      drawGrid(ctx, width, height, state.time)
      
      // 2. Circuit traces
      state.traces.forEach(trace => drawTrace(ctx, trace))
      
      // 3. Connection lines
      const mainNode = state.nodes.find(n => n.kind === 'main')
      if (mainNode) {
        state.nodes.filter(n => n.kind === 'subagent').forEach(subNode => {
          drawConnectionLine(ctx, mainNode, subNode)
        })
      }
      
      // 4. Data packets
      state.packets = state.packets.filter(packet => {
        drawPacket(ctx, packet, state.nodes)
        return packet.progress < 1
      })
      
      // 5. Pulse rings
      state.pulses = state.pulses.filter(pulse => {
        pulse.radius += 2
        pulse.alpha *= 0.97
        if (pulse.alpha > 0.01) {
          drawPulseRing(ctx, pulse)
          return true
        }
        return false
      })
      
      // 6. Particles (reduced intensity)
      state.particles.forEach(particle => {
        particle.x += particle.vx
        particle.y += particle.vy
        
        // Wrap around
        if (particle.x < 0) particle.x = width
        if (particle.x > width) particle.x = 0
        if (particle.y < 0) particle.y = height
        if (particle.y > height) particle.y = 0
        
        drawParticle(ctx, particle)
      })
      
      // 7. Agent nodes
      state.nodes.forEach(node => {
        // Ease toward target position
        node.x += (node.targetX - node.x) * 0.05
        node.y += (node.targetY - node.y) * 0.05
        node.pulsePhase += 0.03
        
        drawNode(ctx, node, state.time)
      })
      
      // 8. Occasional scan line
      if (Math.random() < 0.002) { // 0.2% chance per frame
        drawScanline(ctx, width, height, state.time)
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    if (dimensions.width > 0) {
      animate()
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions])
  
  // Prepare activity feed
  const activityFeed = React.useMemo(() => {
    if (!sessions) return []
    
    const sessionList: Session[] = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []
    
    return sessionList
      .filter(s => s.recentMessages && s.recentMessages.length > 0)
      .flatMap(s => 
        (s.recentMessages || []).map(msg => ({
          sessionKey: s.sessionKey,
          kind: s.kind,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map((item, index) => (
        <div key={index} className="text-green-400 font-mono text-xs mb-1 animate-pulse">
          &gt; [{new Date(item.timestamp).toLocaleTimeString()}] {item.kind.toUpperCase()}{' '}
          {item.role === 'tool' ? `tool:${item.content.split(' ')[0]}` : 'msg received from Ryan'}
        </div>
      ))
  }, [sessions])
  
  return (
    <div className="fixed inset-0 lg:left-56 lg:top-[65px] bg-black overflow-hidden crt-container">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
        onClick={handleCanvasClick}
      />
      
      {/* HUD Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Top-Left: System Vitals */}
        <div className="absolute top-4 left-4 font-mono text-green-400 text-sm">
          <div className="border border-green-800 bg-black/50 p-3 backdrop-blur">
            <div className="text-green-400 mb-2">┌─ SYSTEM ──────────────┐</div>
            <div>│ CPU  {'█'.repeat(Math.floor(Number(systemHealth?.cpu?.loadAvg?.['1m'] ?? 0) / 0.2))}{'░'.repeat(Math.max(0, 10 - Math.floor(Number(systemHealth?.cpu?.loadAvg?.['1m'] ?? 0) / 0.2)))} {(Number(systemHealth?.cpu?.loadAvg?.['1m'] ?? 0) * 50).toFixed(0)}%</div>
            <div>│ RAM  {'█'.repeat(Math.floor(Number(systemHealth?.memory?.percent ?? 0) / 10))}{'░'.repeat(Math.max(0, 10 - Math.floor(Number(systemHealth?.memory?.percent ?? 0) / 10)))} {Number(systemHealth?.memory?.percent ?? 0).toFixed(0)}%</div>
            <div>│ DISK {'█'.repeat(Math.floor(Number(systemHealth?.disk?.percent ?? 0) / 10))}{'░'.repeat(Math.max(0, 10 - Math.floor(Number(systemHealth?.disk?.percent ?? 0) / 10)))} {Number(systemHealth?.disk?.percent ?? 0).toFixed(0)}%</div>
            <div>│ UPTIME {systemHealth?.uptime ? formatUptime(systemHealth.uptime) : '0d 0h 0m'}</div>
            <div className="text-green-400">└────────────────────────┘</div>
          </div>
        </div>
        
        {/* Top-Right: Activity Feed */}
        <div className="absolute top-4 right-4 w-96 font-mono text-green-400 text-xs">
          <div className="border border-green-800 bg-black/50 p-3 backdrop-blur h-48 overflow-y-auto">
            {activityFeed}
          </div>
        </div>
        
        {/* Bottom-Left: Cron Timeline */}
        <div className="absolute bottom-4 left-4 font-mono text-green-400 text-sm">
          <div className="border border-green-800 bg-black/50 p-3 backdrop-blur">
            {(() => {
              const cronList = Array.isArray(cronJobs) ? cronJobs : (cronJobs as any)?.jobs ?? []
              const enabledJobs = cronList.filter((job: CronJob) => job.enabled)
              return enabledJobs.length > 0 ? (
                enabledJobs.slice(0, 3).map((job: CronJob, index: number) => (
                  <div key={index}>⏱ {job.name} in {formatCountdown(job.nextRun)}</div>
                ))
              ) : (
                <div>⏱ No cron jobs</div>
              )
            })()}
          </div>
        </div>
        
        {/* Bottom-Center: Token Counter */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 font-mono text-green-400 text-xl">
          <div className="border border-green-800 bg-black/50 p-3 backdrop-blur text-center">
            <div className="text-green-400 glow">TOKENS ▸ {totalTokens.toLocaleString()}</div>
            <div className="text-amber-400 glow text-lg">COST ▸ ${Number(totalCost || 0).toFixed(4)}</div>
          </div>
        </div>
        
        {/* Bottom-Right: Agent Status */}
        <div className="absolute bottom-4 right-4 font-mono text-green-400 text-sm">
          <div className="border border-green-800 bg-black/50 p-3 backdrop-blur min-w-[290px]">
            <div>MAIN MODEL: {sessionStatus?.model ? shortenModel(sessionStatus.model) : 'unknown'}</div>
            <div>THINK: {sessionStatus?.runtime?.thinking || 'unknown'} {sessionStatus?.fastMode === true ? '· FAST ON' : sessionStatus?.fastMode === false ? '· FAST OFF' : '· FAST ?'}</div>
            <div>DREAMING: {sessionStatus?.dreamingEnabled === true ? 'ON' : sessionStatus?.dreamingEnabled === false ? 'OFF' : 'UNKNOWN'}</div>
            <div>SUB-AGENTS ACTIVE: {(() => {
              const runs = Array.isArray(subagentRuns) ? subagentRuns : []
              return runs.filter((r: SubagentRun) => r.status === 'running').length
            })()}</div>
            <div>CRON ACTIVE: {(() => {
              const cronList = Array.isArray(cronJobs) ? cronJobs : (cronJobs as any)?.jobs ?? []
              return cronList.filter((job: CronJob) => job.enabled).length
            })()}</div>
            <div>LAST ACTIVITY: {(() => {
              const sessionsArray = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions || []
              if (sessionsArray.length === 0) return 'unknown'
              const latestActivity = Math.max(...sessionsArray.map((s: Session) => new Date(s.lastActivity).getTime()))
              return formatDistanceToNow(latestActivity) + ' ago'
            })()}</div>
          </div>
        </div>
      </div>
      
      {/* Conversation Panel */}
      {selectedNode && (
        <div 
          ref={panelRef}
          className="absolute top-4 right-4 w-[420px] max-h-[70vh] bg-black/90 border border-green-800 rounded-lg backdrop-blur-md z-30 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-green-800/50">
            <div className="font-mono text-green-400 text-sm flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${selectedNode.kind === 'main' ? 'bg-green-400' : 'bg-cyan-400'}`} />
              {selectedNode.label}
            </div>
            <button 
              onClick={() => { setSelectedNode(null); setNodeHistory([]) }}
              className="text-green-600 hover:text-green-400 font-mono text-lg leading-none"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[100px] max-h-[60vh] scrollbar-thin">
            {loadingHistory ? (
              <div className="text-green-600 font-mono text-xs animate-pulse text-center py-8">
                LOADING TRANSMISSION LOG...
              </div>
            ) : nodeHistory.length === 0 ? (
              <div className="text-green-800 font-mono text-xs text-center py-8">
                NO TRANSMISSIONS FOUND
              </div>
            ) : (
              nodeHistory.map((msg, i) => (
                <div key={i} className={`font-mono text-xs ${msg.role === 'user' ? 'text-amber-400' : 'text-green-400'}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] uppercase font-bold ${msg.role === 'user' ? 'text-amber-600' : 'text-green-700'}`}>
                      {msg.role === 'user' ? '▶ INBOUND' : '◀ OUTBOUND'}
                    </span>
                    {msg.timestamp && (
                      <span className="text-green-800 text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className={`pl-2 border-l-2 ${msg.role === 'user' ? 'border-amber-800' : 'border-green-800'} whitespace-pre-wrap break-words leading-relaxed`}>
                    {typeof msg.content === 'string' 
                      ? msg.content.slice(0, 500) + (msg.content.length > 500 ? '...' : '')
                      : JSON.stringify(msg.content).slice(0, 500)}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-2 border-t border-green-800/50 font-mono text-[10px] text-green-700">
            {nodeHistory.length} messages • Click elsewhere to close
          </div>
        </div>
      )}

      {/* CRT Scanlines CSS */}
      <style>{`
        .crt-container::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15) 0px,
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          );
          z-index: 20;
        }
        
        .glow {
          text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
        }
        
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .pulse-dot {
          animation: pulse-dot 2s infinite;
        }
      `}</style>
    </div>
  )
}