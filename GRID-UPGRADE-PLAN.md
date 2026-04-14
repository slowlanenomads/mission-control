# TheGrid Visualization Upgrade Plan

## Current State
- Main agent node in center
- Sub-agent nodes orbit around it
- Directional packets now show sub-agent spawn/completion/error flow
- Sub-agent nodes already color by status and show model names
- Main node now consumes `/api/live-activity` for a small honest HUD state
- Activity feed now uses structured live events instead of generic fake-looking chatter
- Grid explicitly marks live state as observed vs inferred and shows its basis
- Current backend signal source is still limited to observable `sessions_list` activity, so main-session phases are conservative

## V1 Live Activity Now Implemented
- Backend route: `/api/live-activity`
- Frontend consumer: `src/pages/TheGrid.tsx`
- Current trustworthy states:
  - `done` when the latest visible main-session event is an assistant reply
  - `waiting_subagent` when a sub-agent session has recent activity
  - `idle` when there is no stronger observable signal
- Important limitation:
  - on this box, `sessions_list` does not currently provide a trustworthy full user/tool/reasoning phase stream, so the Grid should not pretend it can see inner thinking or every tool invocation

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

## Next Honest Upgrades
1. Add a richer backend signal source if available, ideally a structured activity stream rather than message snapshots
2. If that does not exist yet, add an explicit fallback legend in the UI for what the Grid can and cannot currently observe
3. Consider SSE later for smoother updates, but only after the event model is trustworthy
4. Keep avoiding fake typing dots or theatrical ambient states that imply more certainty than the data supports

## File to Modify
`/root/mission-control/src/pages/TheGrid.tsx`

## Rules
- Keep the existing canvas rendering approach
- Don't break the node layout/positioning logic
- Keep cron job visualization as-is
- Dark theme consistent (black bg, green/cyan/amber accents)
- Smooth animations (60fps canvas)
- Performance: don't add per-frame allocations
