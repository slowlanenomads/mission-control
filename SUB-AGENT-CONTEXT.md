# Mission Control — Sub-Agent Context

## What This Is
**Mission Control (MC)** is the admin/monitoring UI for OpenClaw — an AI agent gateway. It's a web dashboard that shows real-time agent activity, session management, system health, and sub-agent orchestration.

- **URL:** http://76.13.107.133:3333/
- **Service:** `mission-control.service` (systemd, port 3333)
- **Repo:** `/root/mission-control` (branch `master`, remote `github.com:slowlanenomads/mission-control.git`)
- **Version:** 0.2.0

## Stack
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + Lucide icons
- **Backend:** Express.js (TypeScript) + proxy to OpenClaw Gateway
- **Auth:** Token-based (proxied through OpenClaw gateway)
- **Canvas:** TheGrid visualization uses raw HTML5 Canvas (not a charting library)
- **No UI library** — custom components, no shadcn/ui (unlike Empire Dashboard)

## Architecture
```
Browser → MC Frontend (port 3333, served by Express)
       → MC Backend API (Express, same port)
       → OpenClaw Gateway API (localhost:18789, proxied)
```

MC doesn't have its own database. All data comes from the OpenClaw Gateway API.

## Key Files

### Backend (`/root/mission-control/server/`)
| File | Lines | What |
|------|-------|------|
| `index.ts` | 1,291 | Express server, all API routes, gateway proxy logic |
| `auth.ts` | 191 | Authentication middleware |

### Frontend Pages (`/root/mission-control/src/pages/`)
| Page | Lines | What |
|------|-------|------|
| `TheGrid.tsx` | 991 | **The main visualization** — canvas-based agent/sub-agent network graph |
| `SessionDetail.tsx` | 436 | Individual session view with messages |
| `SystemHealth.tsx` | 357 | CPU, memory, disk, service status |
| `SettingsPage.tsx` | 289 | Configuration management |
| `Dashboard.tsx` | 287 | Overview with key metrics |
| `EmpireStatus.tsx` | 280 | Empire Dashboard status/health |
| `CronJobs.tsx` | 279 | Cron job management |
| `Todos.tsx` | 265 | Task management |
| `Memory.tsx` | 253 | Agent memory browser |
| `CostTracker.tsx` | 233 | Token/cost tracking |
| `SubAgents.tsx` | 214 | Sub-agent list view |
| `Sessions.tsx` | 181 | Active session list |
| `Login.tsx` | 170 | Login page |

### Hooks (`/root/mission-control/src/hooks/`)
| Hook | What |
|------|------|
| `useApi.ts` | Polling data fetcher with interval support |
| `useAction.ts` | POST/mutation helper |

### API Endpoints (proxied from gateway)
MC proxies most requests to the OpenClaw Gateway at `localhost:18789`. Key endpoints:
- `GET /api/sessions` — active sessions
- `GET /api/subagent-runs?limit=N` — sub-agent run history
- `GET /api/session-status` — current session model/tokens
- `GET /api/cron` — cron jobs
- `GET /api/system/health` — system metrics
- `POST /api/sessions/:key/send` — send message to session

## Design Language
- **Dark cyberpunk aesthetic** — black background (#0a0a0a), green/cyan/amber accents
- **Canvas-based visualization** for TheGrid (not DOM/CSS)
- **Matrix-inspired** — circuit traces, grid lines, glowing nodes
- **Color palette:**
  - Green: `#00ff41` (primary, success)
  - Cyan: `#00d4ff` (info, sub-agents)
  - Amber: `#ffb000` (warning, activity)
  - Red: `#ff3333` (error)
  - Dark green grid: `#0d1f0d`

## Current Known Issue
- TheGrid currently shows sub-agent nodes, status colors, and model names, but the **live conversation flow is not visually accurate**.
- Problem: when the main agent is waiting on sub-agent responses, the visualization does not clearly show inbound communication back to the main agent.
- Current symptom: particles / stars radiate outward, but the **return path** (sub-agent → main agent) is not clearly visible during real work.
- Goal: make the communication direction and waiting state obvious at a glance.

## TheGrid (Main Visualization)
The centerpiece of MC. Canvas-rendered network graph showing:
- **Main agent node** in center (largest, green)
- **Sub-agent nodes** orbiting (cyan/amber/green based on status)
- **Cron job nodes** positioned around edges
- **Data packets** animated between nodes showing communication direction
- **Connection lines** between main and sub-agents with state-based styling
- **Model names** shown on sub-agent nodes
- **Ambient particles** for background activity

### Node Types
- `main` — the primary agent (Opus)
- `subagent` — spawned worker agents (Sonnet, GPT, Gemini)
- `cron` — scheduled jobs

### Data Packet Types
- `spawn` — blue, outbound from main → sub-agent
- `response` — green, inbound from sub-agent → main
- `error` — red, inbound from sub-agent → main
- `cron` — amber, from cron nodes

## What Ryan/MM Cares About
- **Visual representation** of the AI agent system — who's working, what's happening
- **Real-time feedback** — see sub-agents spawn, work, complete
- **Professional look** — this is a showcase, not just a dev tool
- **Accurate representation** — don't show activity that isn't happening

## Conventions
- React functional components with hooks
- TypeScript throughout
- TailwindCSS for page layouts, raw Canvas API for TheGrid
- `useApi` hook for polling data with configurable interval
- `useAction` hook for mutations
- No external charting library — TheGrid is hand-rolled canvas
- `date-fns` for date formatting
- `lucide-react` for icons

## Build & Deploy
```bash
cd /root/mission-control
npm run build          # Builds frontend (Vite) + compiles server (tsc)
sudo systemctl restart mission-control
```

## Login
- User: `admin`
- Password: stored in pass, also hardcoded in MC config
