import { createError, defineEventHandler, getRequestIP, readBody } from 'h3'
import { buildAdminSessionResponse, setAdminSessionCookie, verifyAdminCredentials } from '../../utils/auth'
import { checkLoginRateLimit, resetLoginRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  checkLoginRateLimit(event)

  const body = await readBody(event)
  const username = typeof body?.username === 'string' ? body.username.trim().slice(0, 128) : ''
  const password = typeof body?.password === 'string' ? body.password.slice(0, 256) : ''

  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Username and password are required.' })
  }

  if (!verifyAdminCredentials(username, password)) {
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    console.warn(`[AUTH] Login failed for user "${username}" from ${ip} at ${new Date().toISOString()}`)
    throw createError({ statusCode: 401, statusMessage: 'Invalid admin credentials.' })
  }

  resetLoginRateLimit(event)

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  console.info(`[AUTH] Login succeeded for user "${username}" from ${ip}`)

  setAdminSessionCookie(event, username)

  return buildAdminSessionResponse(event)
})
