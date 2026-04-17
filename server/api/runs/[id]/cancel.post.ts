import { createError, defineEventHandler, getRouterParam } from 'h3'
import { cancelRun } from '../../../services/runs'

export default defineEventHandler(async (event) => {
  const runId = getRouterParam(event, 'id')

  if (!runId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing run id.' })
  }

  const run = await cancelRun(runId)

  return { run }
})
