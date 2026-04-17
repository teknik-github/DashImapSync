import { getStats } from '../../services/stats'

export default defineEventHandler(async () => {
  return getStats()
})
