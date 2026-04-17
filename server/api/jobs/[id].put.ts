import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateJob } from '../../services/jobs'

export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'id')

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing job id.' })
  }

  const body = await readBody(event)
  const job = await updateJob(jobId, body)

  return { job }
})
