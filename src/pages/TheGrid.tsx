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
  recentMessages?: Array<{ role: string; content: string; timestamp: string }>
}

interface SystemHealth {
  cpu?: number
  memory?: number
  disk?: number
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

function getNodeColor(kind: string): string {
  switch (kind) {
    case 'main': return COLORS.green
    case 'subagent': return COLORS.cyan
    case 'cron': return COLORS.amber
    default: return COLORS.green
  }
}

function createParticles(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    alpha: 0.3 + Math.random() * 0.4,
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
  const color = getNodeColor(node.kind)
  
  // Main node background
  ctx.fillStyle = color
  ctx.globalAlpha = node.alpha * 0.3
  ctx.beginPath()
  ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
  ctx.fill()
  
  // Pulsing ring for main node
  if (node.kind === 'main') {
    const pulseRadius = node.radius + Math.sin(node.pulsePhase) * 10
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.globalAlpha = node.alpha * (0.5 + Math.sin(node.pulsePhase) * 0.3)
    ctx.beginPath()
    ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2)
    ctx.stroke()
    
    // Outer concentric rings
    for (let i = 1; i <= 2; i++) {
      ctx.globalAlpha = node.alpha * (0.3 - i * 0.1) * (0.5 + Math.sin(node.pulsePhase + i) * 0.3)
      ctx.beginPath()
      ctx.arc(node.x, node.y, pulseRadius + i * 15, 0, Math.PI * 2)
      ctx.stroke()
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
    ctx.fillText('OPUS 4.6', node.x, node.y + 8)
  } else {
    ctx.fillText(node.label, node.x, node.y + node.radius + 15)
  }
  
  ctx.globalAlpha = 1
}

function drawPacket(ctx: CanvasRenderingContext2D, packet: DataPacket, nodes: AgentNode[]) {
  const fromNode = nodes.find(n => n.id === packet.fromNode)
  const toNode = nodes.find(n => n.id === packet.toNode)
  
  if (!fromNode || !toNode) return
  
  const x = fromNode.x + (toNode.x - fromNode.x) * packet.progress
  const y = fromNode.y + (toNode.y - fromNode.y) * packet.progress
  
  ctx.fillStyle = packet.color
  ctx.shadowColor = packet.color
  ctx.shadowBlur = 8
  ctx.globalAlpha = 0.8
  
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  
  packet.progress += packet.speed
  if (packet.progress >= 1) {
    packet.progress = 0
  }
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

export default function TheGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [totalTokens, setTotalTokens] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  
  // API data
  const { data: sessions } = useApi<Session[]>('/api/sessions?activeMinutes=60&messageLimit=3', { interval: 5000 })
  const { data: subagentRuns } = useApi<SubagentRun[]>('/api/subagent-runs?limit=20', { interval: 10000 })
  const { data: systemHealth } = useApi<SystemHealth>('/api/system/health', { interval: 10000 })
  const { data: cronJobs } = useApi<CronJob[]>('/api/cron', { interval: 30000 })
  
  const stateRef = useRef({
    nodes: [] as AgentNode[],
    particles: [] as Particle[],
    packets: [] as DataPacket[],
    traces: [] as CircuitTrace[],
    pulses: [] as PulseRing[],
    time: 0,
    lastMessageCounts: new Map<string, number>(),
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
      state.particles = createParticles(80, width, height)
      state.traces = createCircuitTraces(12, width, height)
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    
    return () => {
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])
  
  // Update nodes based on session data
  useEffect(() => {
    if (!sessions || dimensions.width === 0) return
    
    const state = stateRef.current
    const sessionList: Session[] = Array.isArray(sessions) ? sessions : (sessions as any)?.sessions ?? []
    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2
    
    // Create main node
    const mainNode: AgentNode = {
      id: 'main',
      label: 'SYKE_AGENT_1',
      kind: 'main',
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
    
    // Create sub-agent nodes
    const subagentNodes: AgentNode[] = []
    const activeSubagents = sessionList.filter(s => s.kind === 'subagent' && s.status === 'active')
    
    activeSubagents.forEach((session, index) => {
      const angle = (index / activeSubagents.length) * Math.PI * 2
      const distance = 150
      const targetX = centerX + Math.cos(angle) * distance
      const targetY = centerY + Math.sin(angle) * distance
      
      subagentNodes.push({
        id: session.sessionKey,
        label: session.sessionKey.slice(-8),
        kind: 'subagent',
        x: targetX,
        y: targetY,
        targetX: targetX,
        targetY: targetY,
        radius: 20,
        alpha: 1,
        pulsePhase: 0,
        messageCount: session.messageCount || 0,
        lastActivity: new Date(session.lastActivity).getTime(),
      })
    })
    
    // Create cron nodes
    const cronNodes: AgentNode[] = []
    if (cronJobs && Array.isArray(cronJobs)) {
      const activeCron = cronJobs.filter(job => job.enabled)
      activeCron.slice(0, 6).forEach((job, index) => {
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
    
    // Create data packets between main and sub-agents
    const newPackets: DataPacket[] = []
    subagentNodes.forEach(subagent => {
      if (Math.random() < 0.1) { // 10% chance per frame
        newPackets.push({
          fromNode: 'main',
          toNode: subagent.id,
          progress: 0,
          speed: 0.02,
          color: COLORS.cyan,
        })
      }
    })
    
    state.nodes = newNodes
    state.packets = [...state.packets.filter(p => p.progress < 1), ...newPackets]
    
    // Update total tokens and cost (mock data for now)
    setTotalTokens(prev => prev + Math.floor(Math.random() * 100))
    setTotalCost(prev => prev + Math.random() * 0.01)
  }, [sessions, cronJobs, dimensions])
  
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
      
      // 3. Connection lines + data packets
      state.packets = state.packets.filter(packet => {
        drawPacket(ctx, packet, state.nodes)
        return packet.progress < 1
      })
      
      // 4. Pulse rings
      state.pulses = state.pulses.filter(pulse => {
        pulse.radius += 2
        pulse.alpha *= 0.97
        if (pulse.alpha > 0.01) {
          drawPulseRing(ctx, pulse)
          return true
        }
        return false
      })
      
      // 5. Particles
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
      
      // 6. Agent nodes
      state.nodes.forEach(node => {
        // Ease toward target position
        node.x += (node.targetX - node.x) * 0.05
        node.y += (node.targetY - node.y) * 0.05
        node.pulsePhase += 0.03
        
        drawNode(ctx, node, state.time)
      })
      
      // 7. Occasional scan line
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
    <div className="fixed inset-0 bg-black overflow-hidden crt-container">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* HUD Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Top-Left: System Vitals */}
        <div className="absolute top-4 left-4 font-mono text-green-400 text-sm">
          <div className="border border-green-800 bg-black/50 p-3 backdrop-blur">
            <div className="text-green-400 mb-2">┌─ SYSTEM ──────────────┐</div>
            <div>│ CPU  {'█'.repeat(Math.floor((systemHealth?.cpu || 0) / 10))}{'░'.repeat(10 - Math.floor((systemHealth?.cpu || 0) / 10))} {(systemHealth?.cpu || 0).toFixed(0)}%</div>
            <div>│ RAM  {'█'.repeat(Math.floor((systemHealth?.memory || 0) / 10))}{'░'.repeat(10 - Math.floor((systemHealth?.memory || 0) / 10))} {(systemHealth?.memory || 0).toFixed(0)}%</div>
            <div>│ DISK {'█'.repeat(Math.floor((systemHealth?.disk || 0) / 10))}{'░'.repeat(10 - Math.floor((systemHealth?.disk || 0) / 10))} {(systemHealth?.disk || 0).toFixed(0)}%</div>
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
            {cronJobs && Array.isArray(cronJobs) ? (
              cronJobs.filter(job => job.enabled).slice(0, 3).map((job, index) => (
                <div key={index}>⏱ {job.name} in {formatCountdown(job.nextRun)}</div>
              ))
            ) : (
              <div>⏱ No cron jobs</div>
            )}
          </div>
        </div>
        
        {/* Bottom-Center: Token Counter */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 font-mono text-green-400 text-xl">
          <div className="border border-green-800 bg-black/50 p-3 backdrop-blur text-center">
            <div className="text-green-400 glow">TOKENS ▸ {totalTokens.toLocaleString()}</div>
            <div className="text-amber-400 glow text-lg">COST ▸ ${totalCost.toFixed(4)}</div>
          </div>
        </div>
        
        {/* Bottom-Right: Agent Status */}
        <div className="absolute bottom-4 right-4 font-mono text-green-400 text-sm">
          <div className="border border-green-800 bg-black/50 p-3 backdrop-blur">
            <div>AGENTS ONLINE: {sessions ? (Array.isArray(sessions) ? sessions : (sessions as any)?.sessions || []).filter((s: any) => s.status === 'active').length : 0}</div>
            <div>CRON ACTIVE: {cronJobs && Array.isArray(cronJobs) ? cronJobs.filter(job => job.enabled).length : 0}</div>
            <div>LAST ACTIVITY: {sessions ? '2m ago' : 'unknown'}</div>
          </div>
        </div>
      </div>
      
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