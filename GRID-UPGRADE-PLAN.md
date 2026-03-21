# TheGrid Visualization Upgrade Plan

## Current State
- Main agent node in center
- Sub-agent nodes orbit around it
- White particles blast outward from center constantly
- No directional communication flow
- No status indication on sub-agent nodes
- No model name shown
- Particles look like constant activity regardless of actual state

## Goal
Make the visualization accurately reflect what's happening:
- Who spawned what
- Which direction communication is flowing
- Who's working vs waiting vs done
- What model each sub-agent is running

## Changes

### 1. Show Model Name on Sub-Agent Nodes
- Display the model name (shortened) below the sub-agent label
- Format: "GPT-5.4", "Sonnet", "Gemini 2.5" (not full model paths)
- Use the `model` field from `SubagentRun`
- Model name shortener:
  - `openrouter/openai/gpt-5.4` → "GPT-5.4"
  - `anthropic/claude-sonnet-4-20250514` → "Sonnet 4.6"
  - `openrouter/google/gemini-2.5-pro` → "Gemini 2.5"
  - fallback: last segment of model path

### 2. State-Based Node Colors
Replace the static cyan color for sub-agents with status-driven colors:
- **Running/thinking:** Amber/yellow pulsing ring (#ffb000)
- **Completed successfully:** Green ring (#00ff41) — fades to dim after 30s
- **Failed/timed out:** Red ring (#ff3333)
- **Idle/old:** Dim grey (#333333)

Use `SubagentRun.status` to determine:
- `running` → amber pulse
- `done` → green
- `error`/`timeout` → red

### 3. Directional Data Packets (replace constant particles)
Current: particles blast outward constantly from center
New: directional packets that show actual communication flow

#### Spawn Phase (outbound)
When a sub-agent first appears (status changes to running):
- Animated packet (dot/line) travels FROM main agent TO sub-agent
- Color: blue (#00d4ff)
- Speed: fast (reaches sub-agent in ~0.5s)
- Represents: "I just sent you a task"

#### Working Phase (sub-agent thinking)
While sub-agent status is `running`:
- Sub-agent node pulses amber
- Subtle particle trail around the sub-agent node itself (circular, not radial)
- NO packets traveling on the connection line
- Represents: "I'm working, not communicating"

#### Response Phase (inbound)
When sub-agent status changes from `running` to `done`:
- Animated packet travels FROM sub-agent BACK TO main agent
- Color: green (#00ff41)
- Speed: fast
- Brief burst/flash at main agent node on receipt
- Represents: "Here's my result"

#### Error Phase
If sub-agent status is error/timeout:
- Red packet travels back, or red flash on the sub-agent node
- Connection line turns red briefly

### 4. Connection Lines
- Thin line from main agent to each active sub-agent
- Line opacity reflects state:
  - Active/running: 0.4 opacity, slight pulse
  - Completed: fades from 0.4 to 0.1 over 10s
  - Error: red, 0.6 opacity, fades
- Line style: dashed while waiting, solid when data is flowing

### 5. Keep Ambient Particles (but reduce)
- Reduce the constant particle blast to ~20% of current intensity
- These represent background activity (heartbeats, API calls, etc.)
- They should NOT dominate the visualization

## Implementation Notes

### Data Available
```typescript
interface SubagentRun {
  id: string
  sessionKey: string
  label?: string      // "triple-review-gpt", "intake-builder", etc.
  status: string      // "running", "done", "error"
  spawned: string     // ISO timestamp
  model: string       // "openrouter/openai/gpt-5.4", etc.
}
```

API: `GET /api/subagent-runs?limit=20` (polls every 10s)

### Model Name Shortener
```typescript
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
```

### State Transition Detection
Track previous sub-agent states to detect transitions:
```typescript
const prevStatesRef = useRef<Record<string, string>>({})

// On each poll:
subagentRuns.forEach(run => {
  const prevStatus = prevStatesRef.current[run.id]
  if (!prevStatus && run.status === 'running') {
    // NEW: spawn packet (outbound)
    addDataPacket(mainNode, subNode, 'spawn')
  }
  if (prevStatus === 'running' && run.status === 'done') {
    // COMPLETED: response packet (inbound)
    addDataPacket(subNode, mainNode, 'response')
  }
  if (prevStatus === 'running' && run.status === 'error') {
    // ERROR: error packet (inbound)
    addDataPacket(subNode, mainNode, 'error')
  }
  prevStatesRef.current[run.id] = run.status
})
```

### Packet Animation
Each DataPacket already has:
- `fromNode`, `toNode`, `progress` (0-1), `speed`, `color`

Upgrade the rendering:
- Draw a glowing dot that travels along the connection line
- Trail behind the dot (3-4 fading copies at previous positions)
- At 100% progress, brief flash/burst at destination node

## File to Modify
`/root/mission-control/src/pages/TheGrid.tsx` (877 lines)

## Rules
- Keep the existing canvas rendering approach
- Don't break the node layout/positioning logic
- Keep cron job visualization as-is
- Dark theme consistent (black bg, green/cyan/amber accents)
- Smooth animations (60fps canvas)
- Performance: don't add per-frame allocations
