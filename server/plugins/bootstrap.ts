import { defineNitroPlugin } from 'nitropack/runtime'
import { ensureSchemaReady } from '../services/migrations'
import { initializeRunScheduler } from '../services/runs'

export default defineNitroPlugin(async () => {
  await ensureSchemaReady()
  await initializeRunScheduler()
})
