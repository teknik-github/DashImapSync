import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { createJob } from '../../services/jobs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const job = await createJob(body)

  setResponseStatus(event, 201)

  return { job }
})
