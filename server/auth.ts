import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '../data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

// Generate a persistent secret — stored in data/ so it survives restarts
const SECRET_FILE = path.join(DATA_DIR, 'jwt-secret.key')
function getJwtSecret(): string {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8').trim()
  const secret = crypto.randomBytes(48).toString('base64url')
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 })
  return secret
}
const JWT_SECRET = process.env.JWT_SECRET || getJwtSecret()

const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days

// ---------- Rate Limiting ----------

interface RateLimitRecord {
  count: number
  lastAttempt: number
  lockedUntil?: number
}

const loginAttempts = new Map<string, RateLimitRecord>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000      // 15 min lockout
const WINDOW_MS = 15 * 60 * 1000       // 15 min window

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const rec = loginAttempts.get(ip)
  if (!rec) return { allowed: true }
  if (rec.lockedUntil && rec.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((rec.lockedUntil - now) / 1000) }
  }
  if (now - rec.lastAttempt > WINDOW_MS) {
    loginAttempts.delete(ip)
    return { allowed: true }
  }
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_MS
    return { allowed: false, retryAfter: Math.ceil(LOCKOUT_MS / 1000) }
  }
  return { allowed: true }
}

export function recordFailedAttempt(ip: string) {
  const rec = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 }
  rec.count++
  rec.lastAttempt = Date.now()
  loginAttempts.set(ip, rec)
}

export function clearAttempts(ip: string) {
  loginAttempts.delete(ip)
}

// ---------- Password Hashing ----------

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, s, 64).toString('hex')
  return { hash, salt: s }
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt)
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'))
  } catch {
    return false
  }
}

// ---------- Token Management ----------

export function createToken(userId: string, username: string): string {
  const payload = JSON.stringify({
    sub: userId,
    usr: username,
    exp: Date.now() + TOKEN_EXPIRY,
    iat: Date.now(),
  })
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

export function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    const dot = token.indexOf('.')
    if (dot === -1) return null
    const encoded = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(encoded).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return { userId: payload.sub, username: payload.usr }
  } catch {
    return null
  }
}

// ---------- User Management ----------

interface StoredUser {
  id: string
  username: string
  passwordHash: string
  salt: string
  createdAt: string
}

function readUsers(): StoredUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
  } catch {}
  return []
}

function writeUsers(users: StoredUser[]) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 })
}

export function hasUsers(): boolean {
  return readUsers().length > 0
}

export function createUser(username: string, password: string): { id: string; username: string } {
  const users = readUsers()
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username already exists')
  }
  if (password.length < 8) throw new Error('Password must be at least 8 characters')
  const { hash, salt } = hashPassword(password)
  const user: StoredUser = {
    id: crypto.randomUUID(),
    username,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  writeUsers(users)
  return { id: user.id, username: user.username }
}

export function authenticate(username: string, password: string): { id: string; username: string } | null {
  const users = readUsers()
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase())
  if (!user) return null
  if (!verifyPassword(password, user.passwordHash, user.salt)) return null
  return { id: user.id, username: user.username }
}
