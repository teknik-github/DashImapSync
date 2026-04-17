import { createError, defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { retryRun } from '../../../services/runs'

export default defineEventHandler(async (event) => {
  const runId = getRouterParam(event, 'id')

  if (!runId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing run id.' })
  }

  const run = await retryRun(runId)

  setResponseStatus(event, 201)

  return { run }
})
