import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteJob } from '../../services/jobs'

export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'id')

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing job id.' })
  }

  await deleteJob(jobId)

  return { ok: true }
})
