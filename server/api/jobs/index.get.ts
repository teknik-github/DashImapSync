import { defineEventHandler } from 'h3'
import { listJobs } from '../../services/jobs'

export default defineEventHandler(async () => {
  return listJobs()
})
