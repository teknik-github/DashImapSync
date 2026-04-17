import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getJobDetail } from '../../services/jobs'

export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'id')

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing job id.' })
  }

  const job = await getJobDetail(jobId)

  return { job }
})
