import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createError, deleteCookie, getCookie, setCookie, type H3Event } from 'h3'
import type { AdminSessionResponse } from '../../shared/imapsync'

const SESSION_COOKIE_NAME = 'dash_imapsync_session'

function getConfiguredAdminCredentials() {
  const runtimeConfig = useRuntimeConfig()
  const username = runtimeConfig.adminUsername || process.env.NUXT_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'admin'
  const password = runtimeConfig.adminPassword || process.env.NUXT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
  const authSecret = runtimeConfig.authSecret || process.env.NUXT_AUTH_SECRET || process.env.AUTH_SECRET || ''
  const sessionTtlHours = Number(
    runtimeConfig.authSessionTtlHours
    || process.env.NUXT_AUTH_SESSION_TTL_HOURS
    || process.env.AUTH_SESSION_TTL_HOURS
    || 24,
  )

  if (!password) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing NUXT_ADMIN_PASSWORD runtime config.',
    })
  }

  if (!authSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing NUXT_AUTH_SECRET runtime config.',
    })
  }

  return {
    username,
    password,
    authSecret,
    sessionTtlHours: Number.isFinite(sessionTtlHours) && sessionTtlHours > 0 ? sessionTtlHours : 24,
  }
}

// Matches a raw SHA-256 hex digest (64 lowercase hex chars).
const SHA256_HEX_RE = /^[0-9a-f]{64}$/

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function signSessionPayload(payload: string) {
  const { authSecret } = getConfiguredAdminCredentials()

  return createHmac('sha256', authSecret).update(payload).digest('base64url')
}

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function buildSessionCookieValue(username: string) {
  const { sessionTtlHours } = getConfiguredAdminCredentials()
  const expiresAt = Date.now() + sessionTtlHours * 60 * 60 * 1000
  const nonce = randomBytes(8).toString('hex')
  const payload = [username, String(expiresAt), nonce].join(':')
  const signature = signSessionPayload(payload)

  return {
    value: `${payload}:${signature}`,
    maxAge: sessionTtlHours * 60 * 60,
  }
}

function decodeSessionCookie(cookieValue: string) {
  const parts = cookieValue.split(':')

  if (parts.length !== 4) {
    return null
  }

  const username = parts[0] ?? ''
  const expiresAtRaw = parts[1] ?? ''
  const nonce = parts[2] ?? ''
  const signature = parts[3] ?? ''
  const payload = [username, expiresAtRaw, nonce].join(':')
  const expectedSignature = signSessionPayload(payload)
  const expiresAt = Number(expiresAtRaw)

  if (!constantTimeEquals(signature, expectedSignature)) {
    return null
  }

  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null
  }

  return { username, expiresAt }
}

export function getAdminSession(event: H3Event) {
  const cookieValue = getCookie(event, SESSION_COOKIE_NAME)

  if (!cookieValue) {
    return null
  }

  return decodeSessionCookie(cookieValue)
}

export function requireAdminSession(event: H3Event) {
  const session = getAdminSession(event)

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required.' })
  }

  return session
}

export function setAdminSessionCookie(event: H3Event, username: string) {
  const cookie = buildSessionCookieValue(username)

  setCookie(event, SESSION_COOKIE_NAME, cookie.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: cookie.maxAge,
  })
}

export function clearAdminSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: '/',
  })
}

export function verifyAdminCredentials(username: string, password: string) {
  const { username: configuredUsername, password: configuredPassword } = getConfiguredAdminCredentials()

  // Always compare hashes to avoid plaintext leakage in timing analysis.
  // If the stored value is already a SHA-256 hex digest, use it directly;
  // otherwise hash the plaintext on-the-fly (backward-compatible).
  const inputHash = sha256(password)
  const storedHash = SHA256_HEX_RE.test(configuredPassword)
    ? configuredPassword
    : sha256(configuredPassword)

  return constantTimeEquals(username, configuredUsername)
    && constantTimeEquals(inputHash, storedHash)
}

export function buildAdminSessionResponse(event: H3Event): AdminSessionResponse {
  const session = getAdminSession(event)

  if (!session) {
    return {
      authenticated: false,
      user: null,
    }
  }

  return {
    authenticated: true,
    user: {
      username: session.username,
    },
  }
}
