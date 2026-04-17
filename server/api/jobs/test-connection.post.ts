import { defineEventHandler, readBody } from 'h3'
import { testJobConnection } from '../../services/test-connection'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const jobId = typeof body?.jobId === 'string' && body.jobId ? body.jobId : undefined
  const result = await testJobConnection(body, jobId)

  return { result }
})
