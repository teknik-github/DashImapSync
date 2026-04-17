import { randomUUID } from 'node:crypto'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { createError } from 'h3'
import {
  type DashboardSummary,
  type JobDraftPayload,
  type MigrationJobDetail,
  type MigrationJobItem,
  type MigrationJobSummary,
  type MigrationRunSummary,
  type MigrationRunStatus,
  type RunTriggerType,
  type SecurityMode,
} from '../../shared/imapsync'
import { decryptSecret, encryptSecret } from '../utils/crypto'
import { execute, queryRows, toIsoString } from '../utils/db'
import { parseJobPayload } from '../utils/job-payload'

interface JobRow extends RowDataPacket {
  id: string
  name: string
  source_host: string
  source_port: number
  source_security: SecurityMode
  source_username: string
  source_password_enc: string
  destination_host: string
  destination_port: number
  destination_security: SecurityMode
  destination_username: string
  destination_password_enc: string
  dry_run: number
  delete_on_destination: number
  continue_on_error: number
  folder_filter: string | null
  created_at: Date | string
  updated_at: Date | string
}

interface RunSummaryRow extends RowDataPacket {
  id: string
  job_id: string
  status: MigrationRunStatus
  trigger_type: RunTriggerType
  started_at: Date | string | null
  finished_at: Date | string | null
  exit_code: number | null
  command_preview: string | null
  error_message: string | null
  created_at: Date | string
  updated_at: Date | string
  last_log_line: string | null
  batch_completed_items: number
  batch_failed_items: number
  batch_total_items: number
}

interface JobWithLatestRunRow extends JobRow {
  item_count: number | null
  latest_run_id: string | null
  latest_run_status: MigrationRunStatus | null
  latest_run_trigger_type: RunTriggerType | null
  latest_run_started_at: Date | string | null
  latest_run_finished_at: Date | string | null
  latest_run_exit_code: number | null
  latest_run_command_preview: string | null
  latest_run_error_message: string | null
  latest_run_created_at: Date | string | null
  latest_run_updated_at: Date | string | null
  latest_run_last_log_line: string | null
  latest_run_batch_completed_items: number | null
  latest_run_batch_failed_items: number | null
  latest_run_batch_total_items: number | null
}

interface JobItemRow extends RowDataPacket {
  id: string
  job_id: string
  sort_order: number
  source_host: string
  source_port: number
  source_security: SecurityMode
  source_username: string
  source_password_enc: string
  destination_host: string
  destination_port: number
  destination_security: SecurityMode
  destination_username: string
  destination_password_enc: string
}

export interface JobExecutionItemRecord {
  id: string
  sortOrder: number
  sourceHost: string
  sourcePort: number
  sourceSecurity: SecurityMode
  sourceUsername: string
  sourcePasswordEnc: string
  destinationHost: string
  destinationPort: number
  destinationSecurity: SecurityMode
  destinationUsername: string
  destinationPasswordEnc: string
}

export interface JobExecutionRecord {
  id: string
  name: string
  dryRun: boolean
  deleteOnDestination: boolean
  continueOnError: boolean
  folderFilter: string
  items: JobExecutionItemRecord[]
}

export interface ResolvedJobDraftPayload extends Omit<JobDraftPayload, 'sourcePassword' | 'destinationPassword'> {
  sourcePassword: string
  destinationPassword: string
}

const insertJobSql = `
  INSERT INTO migration_jobs (
    id,
    name,
    source_host,
    source_port,
    source_security,
    source_username,
    source_password_enc,
    destination_host,
    destination_port,
    destination_security,
    destination_username,
    destination_password_enc,
    dry_run,
    delete_on_destination,
    continue_on_error,
    folder_filter
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

function toBooleanFlag(value: number) {
  return value === 1
}

function mapRunSummary(row: RunSummaryRow): MigrationRunSummary {
  return {
    id: row.id,
    jobId: row.job_id,
    status: row.status,
    triggerType: row.trigger_type,
    startedAt: toIsoString(row.started_at),
    finishedAt: toIsoString(row.finished_at),
    exitCode: row.exit_code,
    commandPreview: row.command_preview,
    errorMessage: row.error_message,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    lastLogLine: row.last_log_line,
    batchCompletedItems: Number(row.batch_completed_items ?? 0),
    batchFailedItems: Number(row.batch_failed_items ?? 0),
    batchTotalItems: Number(row.batch_total_items ?? 0),
  }
}

function mapLatestRun(row: JobWithLatestRunRow) {
  if (!row.latest_run_id || !row.latest_run_status || !row.latest_run_trigger_type) {
    return null
  }

  return mapRunSummary({
    id: row.latest_run_id,
    job_id: row.id,
    status: row.latest_run_status,
    trigger_type: row.latest_run_trigger_type,
    started_at: row.latest_run_started_at,
    finished_at: row.latest_run_finished_at,
    exit_code: row.latest_run_exit_code,
    command_preview: row.latest_run_command_preview,
    error_message: row.latest_run_error_message,
    created_at: row.latest_run_created_at,
    updated_at: row.latest_run_updated_at,
    last_log_line: row.latest_run_last_log_line,
    batch_completed_items: row.latest_run_batch_completed_items ?? 0,
    batch_failed_items: row.latest_run_batch_failed_items ?? 0,
    batch_total_items: row.latest_run_batch_total_items ?? 0,
  } as RunSummaryRow)
}

function mapJobSummary(row: JobWithLatestRunRow): MigrationJobSummary {
  const itemCount = Number(row.item_count ?? 0) || 1

  return {
    id: row.id,
    name: row.name,
    sourceHost: row.source_host,
    sourcePort: row.source_port,
    sourceSecurity: row.source_security,
    sourceUsername: row.source_username,
    destinationHost: row.destination_host,
    destinationPort: row.destination_port,
    destinationSecurity: row.destination_security,
    destinationUsername: row.destination_username,
    dryRun: toBooleanFlag(row.dry_run),
    deleteOnDestination: toBooleanFlag(row.delete_on_destination),
    continueOnError: toBooleanFlag(row.continue_on_error),
    folderFilter: row.folder_filter ?? '',
    itemCount,
    isBatch: Number(row.item_count ?? 0) > 0,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    latestRun: mapLatestRun(row),
  }
}

function mapExecutionItemFromJobRow(row: JobRow): JobExecutionItemRecord {
  return {
    id: row.id,
    sortOrder: 1,
    sourceHost: row.source_host,
    sourcePort: row.source_port,
    sourceSecurity: row.source_security,
    sourceUsername: row.source_username,
    sourcePasswordEnc: row.source_password_enc,
    destinationHost: row.destination_host,
    destinationPort: row.destination_port,
    destinationSecurity: row.destination_security,
    destinationUsername: row.destination_username,
    destinationPasswordEnc: row.destination_password_enc,
  }
}

function mapExecutionItemFromJobItemRow(row: JobItemRow): JobExecutionItemRecord {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    sourceHost: row.source_host,
    sourcePort: row.source_port,
    sourceSecurity: row.source_security,
    sourceUsername: row.source_username,
    sourcePasswordEnc: row.source_password_enc,
    destinationHost: row.destination_host,
    destinationPort: row.destination_port,
    destinationSecurity: row.destination_security,
    destinationUsername: row.destination_username,
    destinationPasswordEnc: row.destination_password_enc,
  }
}

function mapJobItem(row: JobItemRow): MigrationJobItem {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    sourceHost: row.source_host,
    sourcePort: row.source_port,
    sourceSecurity: row.source_security,
    sourceUsername: row.source_username,
    destinationHost: row.destination_host,
    destinationPort: row.destination_port,
    destinationSecurity: row.destination_security,
    destinationUsername: row.destination_username,
  }
}

async function getJobRowOrThrow(jobId: string) {
  const rows = await queryRows<JobRow[]>('SELECT * FROM migration_jobs WHERE id = ? LIMIT 1', [jobId])
  const jobRow = rows[0]

  if (!jobRow) {
    throw createError({ statusCode: 404, statusMessage: 'Migration job not found.' })
  }

  return jobRow
}

export async function resolveJobDraftPayload(input: unknown, existingJobId?: string): Promise<ResolvedJobDraftPayload> {
  const existingJob = existingJobId ? await getJobRowOrThrow(existingJobId) : null
  const payload = parseJobPayload(input, {
    requireSourcePassword: !existingJob?.source_password_enc,
    requireDestinationPassword: !existingJob?.destination_password_enc,
  })

  const sourcePassword = payload.sourcePassword ?? (existingJob ? decryptSecret(existingJob.source_password_enc) : '')
  const destinationPassword = payload.destinationPassword ?? (existingJob ? decryptSecret(existingJob.destination_password_enc) : '')

  if (!sourcePassword || !destinationPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Source and destination passwords are required.' })
  }

  return {
    ...payload,
    sourcePassword,
    destinationPassword,
  }
}

export async function insertJobRecord(payload: ResolvedJobDraftPayload, connection?: PoolConnection) {
  const jobId = randomUUID()
  const values = [
    jobId,
    payload.name,
    payload.sourceHost,
    payload.sourcePort,
    payload.sourceSecurity,
    payload.sourceUsername,
    encryptSecret(payload.sourcePassword),
    payload.destinationHost,
    payload.destinationPort,
    payload.destinationSecurity,
    payload.destinationUsername,
    encryptSecret(payload.destinationPassword),
    payload.dryRun ? 1 : 0,
    payload.deleteOnDestination ? 1 : 0,
    payload.continueOnError ? 1 : 0,
    payload.folderFilter || null,
  ]

  if (connection) {
    await connection.execute(insertJobSql, values)
  }
  else {
    await execute(insertJobSql, values)
  }

  return jobId
}

export async function insertJobItems(jobId: string, payloads: ResolvedJobDraftPayload[], connection: PoolConnection) {
  const insertSql = `
    INSERT INTO migration_job_items (
      id,
      job_id,
      sort_order,
      source_host,
      source_port,
      source_security,
      source_username,
      source_password_enc,
      destination_host,
      destination_port,
      destination_security,
      destination_username,
      destination_password_enc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  for (const [index, payload] of payloads.entries()) {
    await connection.execute(insertSql, [
      randomUUID(),
      jobId,
      index + 1,
      payload.sourceHost,
      payload.sourcePort,
      payload.sourceSecurity,
      payload.sourceUsername,
      encryptSecret(payload.sourcePassword),
      payload.destinationHost,
      payload.destinationPort,
      payload.destinationSecurity,
      payload.destinationUsername,
      encryptSecret(payload.destinationPassword),
    ])
  }
}

async function listJobItems(jobId: string) {
  const rows = await queryRows<JobItemRow[]>(`
    SELECT *
    FROM migration_job_items
    WHERE job_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `, [jobId])

  return rows
}

export async function getJobForExecution(jobId: string) {
  const row = await getJobRowOrThrow(jobId)
  const itemRows = await listJobItems(jobId)
  const items = itemRows.length
    ? itemRows.map(mapExecutionItemFromJobItemRow)
    : [mapExecutionItemFromJobRow(row)]

  return {
    id: row.id,
    name: row.name,
    dryRun: toBooleanFlag(row.dry_run),
    deleteOnDestination: toBooleanFlag(row.delete_on_destination),
    continueOnError: toBooleanFlag(row.continue_on_error),
    folderFilter: row.folder_filter ?? '',
    items,
  }
}

export async function listJobs() {
  const rows = await queryRows<JobWithLatestRunRow[]>(`
    SELECT
      j.*,
      (
        SELECT COUNT(*)
        FROM migration_job_items ji
        WHERE ji.job_id = j.id
      ) AS item_count,
      r.id AS latest_run_id,
      r.status AS latest_run_status,
      r.trigger_type AS latest_run_trigger_type,
      r.started_at AS latest_run_started_at,
      r.finished_at AS latest_run_finished_at,
      r.exit_code AS latest_run_exit_code,
      r.command_preview AS latest_run_command_preview,
      r.error_message AS latest_run_error_message,
      r.created_at AS latest_run_created_at,
      r.updated_at AS latest_run_updated_at,
      r.batch_completed_items AS latest_run_batch_completed_items,
      r.batch_failed_items AS latest_run_batch_failed_items,
      r.batch_total_items AS latest_run_batch_total_items,
      (
        SELECT l.message
        FROM migration_run_logs l
        WHERE l.run_id = r.id
        ORDER BY l.id DESC
        LIMIT 1
      ) AS latest_run_last_log_line
    FROM migration_jobs j
    LEFT JOIN migration_runs r ON r.id = (
      SELECT rr.id
      FROM migration_runs rr
      WHERE rr.job_id = j.id
      ORDER BY rr.created_at DESC
      LIMIT 1
    )
    ORDER BY j.updated_at DESC
  `)

  const jobs = rows.map(mapJobSummary)
  const summary: DashboardSummary = {
    totalJobs: jobs.length,
    queuedRuns: jobs.filter((job) => job.latestRun?.status === 'queued').length,
    runningRuns: jobs.filter((job) => job.latestRun?.status === 'running').length,
    succeededRuns: jobs.filter((job) => job.latestRun?.status === 'succeeded').length,
    failedRuns: jobs.filter((job) => job.latestRun?.status === 'failed').length,
  }

  return { jobs, summary }
}

export async function getJobDetail(jobId: string) {
  const jobRow = await getJobRowOrThrow(jobId)
  const itemRows = await listJobItems(jobId)
  const runRows = await queryRows<RunSummaryRow[]>(`
    SELECT
      r.*,
      r.batch_completed_items,
      r.batch_failed_items,
      r.batch_total_items,
      (
        SELECT l.message
        FROM migration_run_logs l
        WHERE l.run_id = r.id
        ORDER BY l.id DESC
        LIMIT 1
      ) AS last_log_line
    FROM migration_runs r
    WHERE r.job_id = ?
    ORDER BY r.created_at DESC
    LIMIT 30
  `, [jobId])
  const latestRun = runRows[0] ?? null

  const detail: MigrationJobDetail = {
    ...mapJobSummary({
      ...jobRow,
      item_count: itemRows.length,
      latest_run_id: latestRun?.id ?? null,
      latest_run_status: latestRun?.status ?? null,
      latest_run_trigger_type: latestRun?.trigger_type ?? null,
      latest_run_started_at: latestRun?.started_at ?? null,
      latest_run_finished_at: latestRun?.finished_at ?? null,
      latest_run_exit_code: latestRun?.exit_code ?? null,
      latest_run_command_preview: latestRun?.command_preview ?? null,
      latest_run_error_message: latestRun?.error_message ?? null,
      latest_run_created_at: latestRun?.created_at ?? null,
      latest_run_updated_at: latestRun?.updated_at ?? null,
      latest_run_last_log_line: latestRun?.last_log_line ?? null,
      latest_run_batch_completed_items: latestRun?.batch_completed_items ?? 0,
      latest_run_batch_failed_items: latestRun?.batch_failed_items ?? 0,
      latest_run_batch_total_items: latestRun?.batch_total_items ?? 0,
    }),
    password1Saved: Boolean(jobRow.source_password_enc),
    password2Saved: Boolean(jobRow.destination_password_enc),
    items: itemRows.map(mapJobItem),
    runs: runRows.map(mapRunSummary),
  }

  return detail
}

export async function createJob(input: unknown) {
  const payload = await resolveJobDraftPayload(input)
  const jobId = await insertJobRecord(payload)

  return getJobDetail(jobId)
}

export async function updateJob(jobId: string, input: unknown) {
  const payload = await resolveJobDraftPayload(input, jobId)

  await execute(
    `
      UPDATE migration_jobs
      SET
        name = ?,
        source_host = ?,
        source_port = ?,
        source_security = ?,
        source_username = ?,
        source_password_enc = ?,
        destination_host = ?,
        destination_port = ?,
        destination_security = ?,
        destination_username = ?,
        destination_password_enc = ?,
        dry_run = ?,
        delete_on_destination = ?,
        continue_on_error = ?,
        folder_filter = ?
      WHERE id = ?
    `,
    [
      payload.name,
      payload.sourceHost,
      payload.sourcePort,
      payload.sourceSecurity,
      payload.sourceUsername,
      encryptSecret(payload.sourcePassword),
      payload.destinationHost,
      payload.destinationPort,
      payload.destinationSecurity,
      payload.destinationUsername,
      encryptSecret(payload.destinationPassword),
      payload.dryRun ? 1 : 0,
      payload.deleteOnDestination ? 1 : 0,
      payload.continueOnError ? 1 : 0,
      payload.folderFilter || null,
      jobId,
    ],
  )

  return getJobDetail(jobId)
}

export async function deleteJob(jobId: string) {
  const activeRunRows = await queryRows<RowDataPacket[]>('SELECT COUNT(*) AS count FROM migration_runs WHERE job_id = ? AND status IN (?, ?)', [jobId, 'queued', 'running'])
  const activeRunCount = Number(activeRunRows[0]?.count ?? 0)

  if (activeRunCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Stop or cancel queued/running runs before deleting this job.',
    })
  }

  const result = await execute('DELETE FROM migration_jobs WHERE id = ?', [jobId])

  if (result.affectedRows === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Migration job not found.' })
  }
}
