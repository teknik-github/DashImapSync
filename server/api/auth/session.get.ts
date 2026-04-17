import { defineEventHandler } from 'h3'
import { buildAdminSessionResponse } from '../../utils/auth'

export default defineEventHandler((event) => {
  return buildAdminSessionResponse(event)
})
