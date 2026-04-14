# Mission Control — Codebase Map

> Ops dashboard for OpenClaw (AI agent platform). Updated 2026-02-12.

## Stack
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + Recharts + lucide-react + date-fns
- **Backend:** Express (TypeScript, run via `tsx`)
- **Auth:** Custom HMAC-SHA256 tokens (not JWT library — hand-rolled), scrypt password hashing
- **Data Source:** OpenClaw Gateway API (proxied via `/tools/invoke`)
- **Local Storage:** JSON files in `data/`
- **Deploy:** systemd + nginx + Let's Encrypt on Ubuntu VPS

## Architecture Overview

```
Browser → nginx (443/SSL) → Express (port 3333) → OpenClaw Gateway (port 18789)
                                ↓
                          Serves static dist/ in production
                          + API routes (/api/*)
```

- Express serves both the built Vite SPA (`dist/`) and API endpoints
- All `/api/*` routes (except `/api/auth/*`) require authentication via HttpOnly cookie `mc_token`
- Gateway interaction uses a single pattern: `POST /tools/invoke` with tool name + args
- Frontend uses polling (15-60s intervals) for live data — no WebSockets

## Directory Layout
```
/root/mission-control/
├── server/
│   ├── index.ts              # Express server — all routes, gateway proxy, todo CRUD (~350 lines)
│   └── auth.ts               # Auth: tokens, password hashing, rate limiting, user CRUD (~150 lines)
├── src/
│   ├── main.tsx              # React entry point (BrowserRouter + StrictMode)
│   ├── App.tsx               # App shell: auth gate, sidebar layout, routes (~90 lines)
│   ├── index.css             # Tailwind imports + custom scrollbar + pulse animation
│   ├── contexts/
│   │   └── AuthContext.tsx    # Auth state: login, setup, logout, session check
│   ├── hooks/
│   │   └── useApi.ts         # Generic fetch hook with polling, auto-refresh, 401 handling
│   ├── pages/
│   │   ├── Dashboard.tsx     # Main dashboard: stat cards, activity feed, usage/cost panel
│   │   ├── Sessions.tsx      # Session list with expandable message history
│   │   ├── CronJobs.tsx      # Cron job list with expandable run history
│   │   ├── Todos.tsx         # Task manager: CRUD, priorities, categories, filters
│   │   ├── Memory.tsx        # Workspace file browser + search (reads from /root/clawd/)
│   │   ├── SettingsPage.tsx  # Gateway config display, connection status
│   │   └── Login.tsx         # Login + first-time admin setup
│   └── components/
│       ├── Sidebar.tsx       # Navigation sidebar (responsive, mobile hamburger)
│       ├── StatCard.tsx      # Metric card (icon, value, subtitle)
│       ├── StatusBadge.tsx   # Colored pill badge (green/blue/red/etc + optional dot)
│       ├── Skeleton.tsx      # Loading skeleton variants for each page type
│       └── ErrorState.tsx    # Error display with retry button
├── data/
│   ├── jwt-secret.key        # Auto-generated HMAC secret (persists across restarts)
│   ├── users.json            # User accounts (scrypt hashed passwords)
│   └── todos.json            # Todo items (created when first todo added)
├── package.json              # v0.2.0, name: clawdbot-mission-control
├── vite.config.ts            # Dev proxy /api → localhost:3333, alias @ → src/
├── tailwind.config.js        # Dark mode, custom "claw" red palette
├── index.html                # SPA shell with lobster emoji favicon
└── dist/                     # Built frontend (served in production)
```

## Backend — `server/index.ts`

### Gateway Proxy
Single function `invokeGateway(tool, args)` calls `POST ${GATEWAY_URL}/tools/invoke` with Bearer token auth. Unwraps the gateway envelope (`{ok, result: {content, details}}`), preferring `details` over parsing `content[0].text`.

### Auth Routes (Public)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/status` | GET | Returns `{hasUsers}` — determines login vs setup screen |
| `/api/auth/setup` | POST | Create first admin (blocked if users exist) |
| `/api/auth/login` | POST | Authenticate, set `mc_token` HttpOnly cookie (7-day expiry) |
| `/api/auth/me` | GET | Verify current session, return user |
| `/api/auth/logout` | POST | Clear cookie |

### Protected API Routes
All routes below require valid `mc_token` cookie.

| Route | Method | Gateway Tool | Purpose |
|-------|--------|-------------|---------|
| `/api/sessions` | GET | `sessions_list` | List sessions (last 24h, 3 recent messages each) |
| `/api/sessions/:key/history` | GET | `sessions_history` | Get session message history (50 messages) |
| `/api/session-status` | GET | `sessions_list` | Aggregate token usage across sessions |
| `/api/live-activity` | GET | `sessions_list` | Infer a small honest Grid activity state from observable session signals |
| `/api/cron` | GET | `cron` (list) | List all cron jobs with state |
| `/api/cron/:id/runs` | GET | `cron` (runs) | Get run history for a cron job |
| `/api/processes` | GET | `process` (list) | List running processes |
| `/api/agents` | GET | `agents_list` | List agents |
| `/api/memory/search` | GET | `memory_search` | Search memory with query |
| `/api/memory/files` | GET | _(filesystem)_ | List workspace memory files |
| `/api/memory/file` | GET | _(filesystem)_ | Read a specific file (path-traversal protected) |
| `/api/gateway/config` | GET | `gateway` (config.get) | Get gateway configuration |
| `/api/gateway/status` | GET | _(direct fetch)_ | Health check gateway (5s timeout) |
| `/api/todos` | GET | _(local JSON)_ | List todos |
| `/api/todos` | POST | _(local JSON)_ | Create todo |
| `/api/todos/:id` | PATCH | _(local JSON)_ | Update todo |
| `/api/todos/:id` | DELETE | _(local JSON)_ | Delete todo |

### Data Normalization
- `normalizeSession()` — maps raw gateway session data to frontend-friendly format, infers kind (main/subagent/cron) from session key
- `aggregateUsage()` — sums input/output tokens and cost across sessions
- `buildLiveActivity()` — derives Grid activity from `sessions_list` visibility only, currently reliable for recent assistant replies and active sub-agent work

### Live Activity Notes
- `GET /api/live-activity` is intentionally conservative.
- It exposes a phase label, detail, observed vs inferred confidence, basis text, and recent structured events for The Grid HUD.
- Current signal limits matter: on this box, `sessions_list` reliably exposes recent reply history and sub-agent activity, but not a trustworthy full stream of user/tool/reasoning phases.
- Because of that, the live Grid should treat `done`, `idle`, and `waiting_subagent` as the most trustworthy current states unless richer runtime signals are added later.

## Backend — `server/auth.ts`

- **Password hashing:** `crypto.scryptSync` with random 16-byte salt
- **Token format:** `base64url(JSON payload).HMAC-SHA256(payload)` — hand-rolled, not a real JWT
- **Token expiry:** 7 days
- **Rate limiting:** In-memory, 5 attempts per 15-min window, 15-min lockout
- **User storage:** `data/users.json` (file permissions 0600)
- **Secret storage:** `data/jwt-secret.key` (auto-generated, 48 random bytes, persists)

## Frontend

### Auth Flow
1. On load, `AuthContext` calls `GET /api/auth/me` to check session
2. If 401, calls `GET /api/auth/status` to check if setup is needed
3. Shows Login page (or Setup form if no users exist)
4. On success, sets HttpOnly cookie via server response — no client-side token storage
5. `useApi` hook auto-reloads page on 401 (session expired)

### Pages

**Dashboard** — Main overview page
- 4 stat cards: Active Sessions, Messages Today, Cron Jobs, Sub-agents
- Status bar: online indicator, model name, session count
- Activity feed: recent messages across all sessions (color-coded by kind)
- Usage & Cost panel: token counts with progress bars, cost breakdown

**Sessions** — Session explorer
- Lists all sessions with key, kind badge, status badge, message count, model, last activity
- Expandable: shows message history (role-colored, truncated to 500 chars)
- Auto-refreshes every 30s

**Cron Jobs** — Cron job viewer
- Lists jobs with name, schedule (cron expr), enabled status, last/next run times
- Expandable: shows prompt text and recent runs with status badges
- Auto-refreshes every 30s

**Tasks (Todos)** — Task manager
- Full CRUD: add with priority (low/medium/high), category tag, due date
- Toggle completion, delete
- Filter tabs: All / Active / Completed
- Data stored locally in `data/todos.json`

**Memory** — Workspace file browser
- Lists core files (MEMORY.md, SOUL.md, etc.) and daily logs (`memory/*.md`)
- Click to view file contents (rendered as monospace pre)
- Search via gateway `memory_search` tool
- Reads from `WORKSPACE` env var (default `/root/clawd`)
- Security: path traversal prevention, allowlisted extensions (.md, .txt, .json)

**Settings** — Config viewer
- Displays gateway config (version, model, channels, capabilities)
- Gateway connection status indicator (green/red)
- Static info sections: Security, Dashboard, Environment

### Components
- **Sidebar** — Fixed left nav (56px = w-56), responsive (slides in on mobile with overlay)
- **StatCard** — Icon + label + big number + subtitle
- **StatusBadge** — Colored pill with optional dot indicator (7 colors)
- **Skeleton** — Loading placeholders for each page type (stat cards, session rows, etc.)
- **ErrorState** — Error display with retry button

### Hooks
- **useApi<T>(url, {interval?})** — Generic fetch hook. Returns `{data, loading, error, refetch}`. Supports polling interval. Auto-redirects on 401.

## Deployment

### systemd (`mission-control.service`)
```ini
WorkingDirectory=/root/mission-control
Environment=NODE_ENV=production
Environment=PORT=3333
Environment=GATEWAY_URL=http://127.0.0.1:18789
Environment=GATEWAY_TOKEN=fcb7fe789bf6270e33094f788853ebd76d23eaaf31408977
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=on-failure
```

### nginx
- Domain: `crabwalk.slowlanenomads.cloud`
- SSL via Let's Encrypt (certbot)
- Proxies all traffic to `localhost:3333`
- WebSocket upgrade headers configured (for future use)
- HTTP → HTTPS redirect

### Build & Run
- **Dev:** `npm run dev` (concurrently runs Vite on 5173 + Express on 3333, Vite proxies `/api`)
- **Prod:** `npm run build` then `npm start` (Express serves `dist/` + API)

## Current State Assessment

### ✅ Fully Working
- Auth flow (login, setup, logout, session persistence, rate limiting)
- Dashboard with live session/cron/usage data
- Session list + expandable message history
- Cron job list + run history
- Todo CRUD with priorities, categories, due dates
- Memory file browser (core files + daily logs)
- Memory search via gateway
- Settings/config viewer
- Gateway health check
- Responsive mobile layout
- Loading skeletons for all page types

### ⚠️ Partially Working / Limitations
- **Usage/Cost data** — Aggregated from session messages which may not have usage data; rough estimates
- **Message count** — Estimated from `totalTokens / 500`, not actual count
- **"Live" indicator** — Always shows green (hardcoded), doesn't reflect actual gateway status
- **Processes page** — Route exists in server but no frontend page for it
- **Agents page** — Route exists in server but no frontend page for it
- **Memory search** — Depends on gateway's `memory_search` tool; results format varies

### 🔴 Missing / Placeholder
- No WebSocket/SSE for real-time updates (polling only)
- No ability to manage cron jobs (create/edit/delete/toggle) — read-only
- No ability to manage sessions (kill, send message) — read-only
- No log viewer / process output viewer
- No dark/light theme toggle (dark only)
- Settings page is read-only — can't change gateway config
- No user management (can't add/remove users, change passwords)
- `recharts` is in dependencies but unused (no charts/graphs)
- `WORKSPACE` env var defaults to `/root/clawd` but not set in systemd (uses default)

## Data Storage

| File | Purpose | Format |
|------|---------|--------|
| `data/users.json` | User accounts | JSON array of `{id, username, passwordHash, salt, createdAt}` |
| `data/jwt-secret.key` | HMAC signing secret | Plain text (base64url, 48 bytes) |
| `data/todos.json` | Todo items | JSON array of `{id, text, completed, priority, category, dueDate, createdAt, completedAt}` |

All data is local JSON files — no database.

## Known Issues / TODOs

1. **Gateway token in systemd file** — Sensitive token visible in service file; should use environment file with restricted permissions
2. **"Trust proxy" says Caddy but uses nginx** — Comment says "Trust proxy for correct IP behind Caddy" but actual reverse proxy is nginx
3. **Rate limiting is in-memory** — Resets on server restart; could be abused with restart timing
4. **No CSRF protection** — SameSite=Strict cookie helps, but no CSRF tokens
5. **Token is not real JWT** — Hand-rolled HMAC token works but isn't standards-compliant
6. **No pagination** — Sessions, todos, memory files all load everything at once
7. **Hardcoded model name fallback** — Dashboard shows "claude-opus-4-5" as fallback, will be wrong if model changes
8. **No error boundaries** — React errors could crash entire app
9. **`recharts` dependency unused** — ~200KB of dead weight in the bundle
10. **No build caching** — `npx tsx` in production means TypeScript compilation on every start

## Improvement Ideas

1. **Add charts** — Use the already-installed recharts for token usage over time, cost trends, session activity graphs
2. **Cron job management** — Add create/edit/delete/toggle for cron jobs (gateway supports it)
3. **Real-time updates** — SSE or WebSocket connection for live session activity instead of polling
4. **Process viewer** — Show running exec sessions with output (backend route exists)
5. **Agent management** — Show/manage agents (backend route exists)
6. **Log viewer** — Tail gateway logs, show recent errors
7. **Action buttons** — Kill sessions, trigger cron runs, send messages to agent
8. **User management** — Change password, add users
9. **Mobile PWA** — Add manifest.json + service worker for installable app
10. **Persistent rate limiting** — Store attempts in data/ file
11. **Search in sessions** — Full-text search across session messages
12. **Memory file editing** — Allow editing workspace files from the UI
13. **Notifications** — Browser notifications for important events
14. **API key management** — View/rotate gateway tokens from UI
15. **Node status** — Show paired nodes and their status (cameras, screens, etc.)
