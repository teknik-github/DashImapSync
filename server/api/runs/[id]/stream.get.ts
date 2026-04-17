import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getRunDetail, subscribeToRunEvents } from '../../../services/runs'

export default defineEventHandler(async (event) => {
  const runId = getRouterParam(event, 'id')

  if (!runId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing run id.' })
  }

  const snapshot = await getRunDetail(runId)
  const response = event.node.res

  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.setHeader('X-Accel-Buffering', 'no')
  response.flushHeaders?.()

  const writeEvent = (type: string, payload: unknown) => {
    response.write(`event: ${type}\n`)
    response.write(`data: ${JSON.stringify(payload)}\n\n`)
  }

  writeEvent('snapshot', { run: snapshot })

  const unsubscribe = subscribeToRunEvents(runId, {
    onLog(log) {
      writeEvent('log', log)
    },
    onStatus(summary) {
      writeEvent('status', summary)
    },
  })

  const heartbeat = setInterval(() => {
    response.write(': keepalive\n\n')
  }, 15_000)

  heartbeat.unref?.()

  return await new Promise<void>((resolve) => {
    const cleanup = () => {
      clearInterval(heartbeat)
      unsubscribe()
      response.end()
      resolve()
    }

    event.node.req.on('close', cleanup)
  })
})
