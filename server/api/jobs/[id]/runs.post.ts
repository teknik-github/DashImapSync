import { createError, defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { queueRunForJob } from '../../../services/runs'

export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'id')

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing job id.' })
  }

  const run = await queueRunForJob(jobId)

  setResponseStatus(event, 201)

  return { run }
})
