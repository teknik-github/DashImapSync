import { defineEventHandler } from 'h3'
import { buildAdminSessionResponse, clearAdminSessionCookie } from '../../utils/auth'

export default defineEventHandler((event) => {
  clearAdminSessionCookie(event)

  return buildAdminSessionResponse(event)
})
