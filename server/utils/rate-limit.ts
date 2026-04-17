import { createError, getRequestIP, type H3Event } from 'h3'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

interface AttemptEntry {
  count: number
  resetAt: number
}

declare global {
  var __dashImapsyncLoginAttempts: Map<string, AttemptEntry> | undefined
}

function getAttemptStore() {
  if (!globalThis.__dashImapsyncLoginAttempts) {
    globalThis.__dashImapsyncLoginAttempts = new Map()
  }

  return globalThis.__dashImapsyncLoginAttempts
}

export function checkLoginRateLimit(event: H3Event) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const store = getAttemptStore()
  const now = Date.now()
  const entry = store.get(ip)

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000)
      throw createError({
        statusCode: 429,
        statusMessage: `Too many login attempts. Try again in ${retryAfterSecs} seconds.`,
      })
    }

    entry.count++
  }
  else {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  }
}

export function resetLoginRateLimit(event: H3Event) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  getAttemptStore().delete(ip)
}
