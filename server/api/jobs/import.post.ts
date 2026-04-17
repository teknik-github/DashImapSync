import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { importJobsFromCsv } from '../../services/import-jobs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const content = typeof body?.content === 'string' ? body.content : ''
  const result = await importJobsFromCsv(content, {
    sourceHost: typeof body?.sourceHost === 'string' ? body.sourceHost.trim() : '',
    destinationHost: typeof body?.destinationHost === 'string' ? body.destinationHost.trim() : '',
    fileName: typeof body?.fileName === 'string' ? body.fileName.trim() : '',
    continueOnError: body?.continueOnError === true || body?.continueOnError === 'true' || body?.continueOnError === 1,
  })

  setResponseStatus(event, 201)

  return { result }
})
