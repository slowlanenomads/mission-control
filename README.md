# 🦞 Mission Control

A real-time ops dashboard for [Clawdbot](https://github.com/clawdbot/clawdbot) — monitor sessions, cron jobs, memory, tasks, and costs from a single dark-themed interface.

![Version](https://img.shields.io/badge/version-0.2.0-blue)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Vite%20%2B%20Tailwind%20%2B%20Express-blueviolet)

## Features

- **📊 Dashboard** — Live status, active sessions, message counts, token usage, cost breakdown
- **💬 Sessions** — Browse and inspect session history with expandable message views
- **⏰ Cron Jobs** — View scheduled jobs, run history, and status
- **📋 Tasks** — Built-in TODO tracker with priorities, categories, and due dates
- **🧠 Memory** — Search agent memory and workspace files
- **⚙️ Settings** — Live gateway config, connectivity status, system info
- **🔐 Auth** — Session-based login with rate limiting, scrypt password hashing, JWT tokens
- **💀 Loading Skeletons** — Smooth loading states across all pages

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, Lucide Icons, Recharts, date-fns |
| Backend | Express 4, TypeScript (TSX) |
| Auth | Custom JWT (HMAC-SHA256), scrypt password hashing, HttpOnly cookies |
| Data | JSON file storage (`data/`) |

## Setup

### Prerequisites

- Node.js 18+
- A running [Clawdbot](https://github.com/clawdbot/clawdbot) gateway instance

### Install & Run

```bash
git clone https://github.com/slowlanenomads/mission-control.git
cd mission-control
npm install
```

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
NODE_ENV=production npm start
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3333` | Server port |
| `GATEWAY_URL` | `http://127.0.0.1:18789` | Clawdbot gateway URL |
| `GATEWAY_TOKEN` | — | Gateway auth token |
| `JWT_SECRET` | Auto-generated | Secret for signing session tokens |

### First Run

On first visit, you'll see a setup screen to create your admin account. After that, all access requires login.

## Deployment

### systemd Service

```ini
[Unit]
Description=Mission Control
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/mission-control
Environment=NODE_ENV=production
Environment=GATEWAY_URL=http://127.0.0.1:18789
Environment=GATEWAY_TOKEN=your-token-here
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Reverse Proxy (Caddy)

```
yourdomain.com {
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Strict-Transport-Security "max-age=31536000"
    }
    reverse_proxy localhost:3333
}
```

## Security

- **App-level auth** — No basic auth dependency; the app manages its own sessions
- **Rate limiting** — 5 failed login attempts → 15 minute lockout per IP
- **Secure cookies** — HttpOnly, SameSite=Strict, Secure flag
- **Password hashing** — scrypt with random salt (64-byte derived key)
- **Auto-generated JWT secret** — Persisted to `data/jwt-secret.key` (600 permissions)
- **Security headers** — HSTS, X-Frame-Options, X-Content-Type-Options via reverse proxy

## Architecture

```
Browser → Caddy (HTTPS) → Express (:3333) → Clawdbot Gateway (:18789)
                              ↓
                         React SPA (dist/)
                              ↓
                         data/ (todos, users, jwt-secret)
```

The Express backend proxies all API calls to the Clawdbot gateway via its `/tools/invoke` HTTP endpoint, adding the gateway auth token server-side so it never reaches the browser.

## License

MIT

---

Built by [OpenClaw](https://github.com/slowlanenomads) 🦞
