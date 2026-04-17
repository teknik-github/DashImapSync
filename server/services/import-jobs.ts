import { createError } from 'h3'
import type { CsvImportResult } from '../../shared/imapsync'
import { withTransaction } from '../utils/db'
import { parseCsv } from '../utils/csv'
import { insertJobItems, insertJobRecord, resolveJobDraftPayload, type ResolvedJobDraftPayload } from './jobs'

interface CsvImportOverrides {
  sourceHost?: string
  destinationHost?: string
  fileName?: string
  continueOnError?: boolean
}

function normalizeHeader(header: string) {
  return header.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function readCsvField(row: Record<string, string>, expectedKey: string) {
  const normalizedExpectedKey = normalizeHeader(expectedKey)

  for (const [key, value] of Object.entries(row)) {
    if (normalizeHeader(key) === normalizedExpectedKey) {
      return value
    }
  }

  return ''
}

function buildBatchJobName(fileName: string | undefined) {
  const normalizedFileName = (fileName || '').trim().replace(/\.[^.]+$/u, '')
  return normalizedFileName || 'Imported job'
}

function mapCsvRowToJobInput(
  row: Record<string, string>,
  overrides: CsvImportOverrides,
  batchName: string,
) {
  const name = readCsvField(row, 'name').trim() || batchName

  return {
    name,
    sourceHost: readCsvField(row, 'sourceHost') || overrides.sourceHost || '',
    sourcePort: readCsvField(row, 'sourcePort'),
    sourceSecurity: readCsvField(row, 'sourceSecurity'),
    sourceUsername: readCsvField(row, 'sourceUsername'),
    sourcePassword: readCsvField(row, 'sourcePassword'),
    destinationHost: readCsvField(row, 'destinationHost') || overrides.destinationHost || '',
    destinationPort: readCsvField(row, 'destinationPort'),
    destinationSecurity: readCsvField(row, 'destinationSecurity'),
    destinationUsername: readCsvField(row, 'destinationUsername'),
    destinationPassword: readCsvField(row, 'destinationPassword'),
    dryRun: readCsvField(row, 'dryRun'),
    deleteOnDestination: readCsvField(row, 'deleteOnDestination'),
    folderFilter: readCsvField(row, 'folderFilter').replaceAll('|', '\n'),
  }
}

export async function importJobsFromCsv(content: string, overrides: CsvImportOverrides = {}): Promise<CsvImportResult> {
  if (typeof content !== 'string' || !content.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'CSV content is required.' })
  }

  const { rows } = parseCsv(content)

  if (!rows.length) {
    throw createError({ statusCode: 400, statusMessage: 'CSV does not contain any data rows.' })
  }

  const payloads: ResolvedJobDraftPayload[] = []
  const batchName = buildBatchJobName(overrides.fileName)

  for (const [index, row] of rows.entries()) {
    try {
      const payload = await resolveJobDraftPayload(mapCsvRowToJobInput(row, overrides, batchName))
      payloads.push(payload)
    }
    catch (error) {
      const statusMessage = typeof error === 'object' && error && 'statusMessage' in error
        ? String((error as { statusMessage?: string }).statusMessage || 'Invalid CSV row.')
        : error instanceof Error
          ? error.message
          : 'Invalid CSV row.'

      throw createError({
        statusCode: 400,
        statusMessage: `CSV row ${index + 2} is invalid. ${statusMessage}`,
      })
    }
  }

  return withTransaction(async (connection) => {
    const primaryPayload = payloads[0]

    if (!primaryPayload) {
      throw createError({ statusCode: 400, statusMessage: 'Import file does not contain any valid rows.' })
    }

    const parentPayload: ResolvedJobDraftPayload = {
      ...primaryPayload,
      name: batchName,
      continueOnError: Boolean(overrides.continueOnError),
    }

    const jobId = await insertJobRecord(parentPayload, connection)
    await insertJobItems(jobId, payloads, connection)

    return {
      importedCount: payloads.length,
      jobCount: 1,
      jobIds: [jobId],
      jobNames: [batchName],
    }
  })
}
