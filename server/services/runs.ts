import { spawn, type ChildProcessByStdio } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import type { RowDataPacket } from 'mysql2/promise'
import { createError } from 'h3'
import {
  type MigrationRunDetail,
  type MigrationRunLog,
  type MigrationRunStatus,
  type MigrationRunSummary,
  type RunTriggerType,
} from '../../shared/imapsync'
import { decryptSecret } from '../utils/crypto'
import { execute, queryRows, toIsoString } from '../utils/db'
import { getJobForExecution, type JobExecutionItemRecord, type JobExecutionRecord } from './jobs'

interface RunRow extends RowDataPacket {
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

interface RunLogRow extends RowDataPacket {
  id: number
  run_id: string
  stream: 'stdout' | 'stderr' | 'system'
  message: string
  created_at: Date | string
}

interface ActiveRun {
  child: ChildProcessByStdio<null, Readable, Readable> | null
  cancelRequested: boolean
  tempDir: string
  stdoutBuffer: string
  stderrBuffer: string
  redactions: string[]
}

interface RuntimeState {
  emitter: EventEmitter
  activeRuns: Map<string, ActiveRun>
  queueLoopRunning: boolean
  schedulerStarted: boolean
  schedulerTimer: NodeJS.Timeout | null
}

declare global {
  var __dashImapsyncRunState: RuntimeState | undefined
}

function getRuntimeState() {
  if (!globalThis.__dashImapsyncRunState) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(0)

    globalThis.__dashImapsyncRunState = {
      emitter,
      activeRuns: new Map(),
      queueLoopRunning: false,
      schedulerStarted: false,
      schedulerTimer: null,
    }
  }

  return globalThis.__dashImapsyncRunState
}

function getImapsyncBinary() {
  const config = useRuntimeConfig()

  return config.imapsyncBinary || process.env.NUXT_IMAPSYNC_BINARY || process.env.IMAPSYNC_BINARY || 'imapsync'
}

function getMaxConcurrentRuns() {
  const config = useRuntimeConfig()
  const configuredValue = Number(
    config.imapsyncConcurrency
    || process.env.NUXT_IMAPSYNC_CONCURRENCY
    || process.env.IMAPSYNC_CONCURRENCY
    || 1,
  )

  if (!Number.isInteger(configuredValue) || configuredValue < 1) {
    return 1
  }

  return configuredValue
}

function getQueuePollMs() {
  const config = useRuntimeConfig()
  const configuredValue = Number(
    config.imapsyncQueuePollMs
    || process.env.NUXT_IMAPSYNC_QUEUE_POLL_MS
    || process.env.IMAPSYNC_QUEUE_POLL_MS
    || 5000,
  )

  if (!Number.isInteger(configuredValue) || configuredValue < 1000) {
    return 5000
  }

  return configuredValue
}

function mapRunSummary(row: RunRow): MigrationRunSummary {
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
    batchCompletedItems: Number((row as any).batch_completed_items ?? 0),
    batchFailedItems: Number((row as any).batch_failed_items ?? 0),
    batchTotalItems: Number((row as any).batch_total_items ?? 0),
  }
}

function mapRunLog(row: RunLogRow): MigrationRunLog {
  return {
    id: row.id,
    runId: row.run_id,
    stream: row.stream,
    message: row.message,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  }
}

function quoteArg(arg: string) {
  return /[\s"']/u.test(arg) ? JSON.stringify(arg) : arg
}

function buildImapsyncArgs(job: JobExecutionRecord, item: JobExecutionItemRecord, passfile1: string, passfile2: string) {
  const args = [
    '--host1', item.sourceHost,
    '--port1', String(item.sourcePort),
    '--user1', item.sourceUsername,
    '--passfile1', passfile1,
    '--host2', item.destinationHost,
    '--port2', String(item.destinationPort),
    '--user2', item.destinationUsername,
    '--passfile2', passfile2,
  ]

  if (item.sourceSecurity === 'ssl') {
    args.push('--ssl1')
  }
  else if (item.sourceSecurity === 'tls') {
    args.push('--tls1')
  }

  if (item.destinationSecurity === 'ssl') {
    args.push('--ssl2')
  }
  else if (item.destinationSecurity === 'tls') {
    args.push('--tls2')
  }

  if (job.dryRun) {
    args.push('--dry')
  }

  if (job.deleteOnDestination) {
    args.push('--delete2')
  }

  for (const folder of job.folderFilter.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
    args.push('--folder', folder)
  }

  return args
}

function buildCommandPreview(job: JobExecutionRecord, item: JobExecutionItemRecord) {
  const previewArgs = [
    '--host1', item.sourceHost,
    '--port1', String(item.sourcePort),
    '--user1', item.sourceUsername,
    '--passfile1', '<secure-file>',
    '--host2', item.destinationHost,
    '--port2', String(item.destinationPort),
    '--user2', item.destinationUsername,
    '--passfile2', '<secure-file>',
  ]

  if (item.sourceSecurity === 'ssl') {
    previewArgs.push('--ssl1')
  }
  else if (item.sourceSecurity === 'tls') {
    previewArgs.push('--tls1')
  }

  if (item.destinationSecurity === 'ssl') {
    previewArgs.push('--ssl2')
  }
  else if (item.destinationSecurity === 'tls') {
    previewArgs.push('--tls2')
  }

  if (job.dryRun) {
    previewArgs.push('--dry')
  }

  if (job.deleteOnDestination) {
    previewArgs.push('--delete2')
  }

  for (const folder of job.folderFilter.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
    previewArgs.push('--folder', folder)
  }

  return ['imapsync', ...previewArgs.map(quoteArg)].join(' ')
}

function sanitizeLogMessage(message: string, redactions: string[]) {
  let sanitized = message.replaceAll('\u0000', '').replace(/\r/g, '')

  for (const value of redactions) {
    if (!value) {
      continue
    }

    sanitized = sanitized.split(value).join('[redacted]')
  }

  return sanitized.trimEnd()
}

async function getRunRowOrThrow(runId: string) {
  const rows = await queryRows<RunRow[]>(`
    SELECT
      r.*,
      (
        SELECT l.message
        FROM migration_run_logs l
        WHERE l.run_id = r.id
        ORDER BY l.id DESC
        LIMIT 1
      ) AS last_log_line
    FROM migration_runs r
    WHERE r.id = ?
    LIMIT 1
  `, [runId])

  const runRow = rows[0]

  if (!runRow) {
    throw createError({ statusCode: 404, statusMessage: 'Migration run not found.' })
  }

  return runRow
}

async function emitRunStatus(runId: string) {
  const state = getRuntimeState()
  const runRow = await getRunRowOrThrow(runId)

  state.emitter.emit(`run:${runId}:status`, mapRunSummary(runRow))
}

async function insertLog(runId: string, stream: MigrationRunLog['stream'], message: string) {
  const createdAt = new Date()
  const result = await execute(
    'INSERT INTO migration_run_logs (run_id, stream, message, created_at) VALUES (?, ?, ?, ?)',
    [runId, stream, message, createdAt],
  )

  const log: MigrationRunLog = {
    id: result.insertId,
    runId,
    stream,
    message,
    createdAt: createdAt.toISOString(),
  }

  getRuntimeState().emitter.emit(`run:${runId}:log`, log)

  return log
}

async function updateRunProgress(runId: string, completedItems: number, failedItems: number, totalItems: number) {
  await execute(
    `
      UPDATE migration_runs
      SET batch_completed_items = ?, batch_failed_items = ?, batch_total_items = ?, updated_at = ?
      WHERE id = ?
    `,
    [completedItems, failedItems, totalItems, new Date(), runId],
  )

  await emitRunStatus(runId)
}

async function appendRunLog(runId: string, message: string, stream: MigrationRunLog['stream'], redactions: string[] = []) {
  const sanitized = sanitizeLogMessage(message, redactions)
  const lines = sanitized.split('\n').map((line) => line.trimEnd()).filter(Boolean)

  if (!lines.length) {
    return
  }

  for (const line of lines) {
    await insertLog(runId, stream, line)
  }
}

async function flushProcessBuffer(runId: string, stream: 'stdout' | 'stderr', meta: ActiveRun) {
  const pendingMessage = stream === 'stdout' ? meta.stdoutBuffer : meta.stderrBuffer

  if (!pendingMessage.trim()) {
    if (stream === 'stdout') {
      meta.stdoutBuffer = ''
    }
    else {
      meta.stderrBuffer = ''
    }

    return
  }

  await appendRunLog(runId, pendingMessage, stream, meta.redactions)

  if (stream === 'stdout') {
    meta.stdoutBuffer = ''
  }
  else {
    meta.stderrBuffer = ''
  }
}

function handleProcessChunk(runId: string, stream: 'stdout' | 'stderr', chunk: Buffer, meta: ActiveRun) {
  const previousBuffer = stream === 'stdout' ? meta.stdoutBuffer : meta.stderrBuffer
  const merged = `${previousBuffer}${chunk.toString('utf8')}`
  const lines = merged.split(/\n/)
  const nextBuffer = lines.pop() ?? ''

  if (stream === 'stdout') {
    meta.stdoutBuffer = nextBuffer
  }
  else {
    meta.stderrBuffer = nextBuffer
  }

  for (const line of lines) {
    void appendRunLog(runId, line, stream, meta.redactions)
  }
}

async function cleanupTempDir(tempDir: string) {
  if (!tempDir) {
    return
  }

  await rm(tempDir, { recursive: true, force: true })
}

function humanizeExecutionError(error: unknown) {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    return `Could not start imapsync. Binary "${getImapsyncBinary()}" was not found on the server.`
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown imapsync execution error.'
}

async function finalizeRun(runId: string, status: MigrationRunStatus, exitCode: number | null, errorMessage: string | null, meta: ActiveRun | null) {
  if (meta) {
    await flushProcessBuffer(runId, 'stdout', meta)
    await flushProcessBuffer(runId, 'stderr', meta)
    getRuntimeState().activeRuns.delete(runId)
  }

  if (status === 'succeeded') {
    await appendRunLog(runId, 'Run completed successfully.', 'system')
  }
  else if (status === 'canceled') {
    await appendRunLog(runId, 'Run canceled by user.', 'system')
  }
  else if (errorMessage) {
    await appendRunLog(runId, errorMessage, 'system')
  }

  await execute(
    `
      UPDATE migration_runs
      SET status = ?, exit_code = ?, error_message = ?, finished_at = ?, updated_at = ?
      WHERE id = ?
    `,
    [status, exitCode, errorMessage, new Date(), new Date(), runId],
  )

  await emitRunStatus(runId)
  void processQueuedRuns()
}

function buildBatchCommandPreview(job: JobExecutionRecord, item: JobExecutionItemRecord) {
  const firstItemPreview = buildCommandPreview(job, item)

  if (job.items.length === 1) {
    return firstItemPreview
  }

  return `Batch of ${job.items.length} mailbox pairs\nFirst item: ${firstItemPreview}`
}

function describeItem(item: JobExecutionItemRecord) {
  return `${item.sourceUsername} -> ${item.destinationUsername}`
}

async function executeRunItem(
  runId: string,
  job: JobExecutionRecord,
  item: JobExecutionItemRecord,
  index: number,
  meta: ActiveRun,
) {
  const totalItems = job.items.length
  const sourcePassword = decryptSecret(item.sourcePasswordEnc)
  const destinationPassword = decryptSecret(item.destinationPasswordEnc)
  const redactions = [sourcePassword, destinationPassword]
  const tempDir = await mkdtemp(join(tmpdir(), 'dash-imapsync-'))
  const sourcePassfile = join(tempDir, 'source.pass')
  const destinationPassfile = join(tempDir, 'destination.pass')
  const args = buildImapsyncArgs(job, item, sourcePassfile, destinationPassfile)
  const commandPreview = buildCommandPreview(job, item)

  meta.tempDir = tempDir
  meta.redactions = redactions
  meta.stdoutBuffer = ''
  meta.stderrBuffer = ''

  await writeFile(sourcePassfile, `${sourcePassword}\n`, { mode: 0o600 })
  await writeFile(destinationPassfile, `${destinationPassword}\n`, { mode: 0o600 })

  await appendRunLog(runId, `Starting mailbox ${index + 1}/${totalItems}: ${describeItem(item)}`, 'system')
  await appendRunLog(runId, commandPreview, 'system')

  return await new Promise<{
    status: MigrationRunStatus
    exitCode: number | null
    errorMessage: string | null
  }>((resolve) => {
    let settled = false
    const child = spawn(getImapsyncBinary(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    meta.child = child

    const finalizeChild = async (result: { status: MigrationRunStatus, exitCode: number | null, errorMessage: string | null }) => {
      if (settled) {
        return
      }

      settled = true
      meta.child = null

      await flushProcessBuffer(runId, 'stdout', meta)
      await flushProcessBuffer(runId, 'stderr', meta)
      await cleanupTempDir(tempDir)

      resolve(result)
    }

    child.stdout.on('data', (chunk) => {
      handleProcessChunk(runId, 'stdout', chunk, meta)
    })

    child.stderr.on('data', (chunk) => {
      handleProcessChunk(runId, 'stderr', chunk, meta)
    })

    child.on('error', (error) => {
      void finalizeChild({
        status: meta.cancelRequested ? 'canceled' : 'failed',
        exitCode: null,
        errorMessage: humanizeExecutionError(error),
      })
    })

    child.on('close', (code, signal) => {
      if (meta.cancelRequested) {
        void finalizeChild({
          status: 'canceled',
          exitCode: code ?? null,
          errorMessage: 'Run canceled by user.',
        })
        return
      }

      if (code === 0) {
        void finalizeChild({
          status: 'succeeded',
          exitCode: 0,
          errorMessage: null,
        })
        return
      }

      const errorMessage = signal
        ? `imapsync exited because of signal ${signal}.`
        : `imapsync exited with code ${code ?? 'unknown'}.`

      void finalizeChild({
        status: 'failed',
        exitCode: code ?? null,
        errorMessage,
      })
    })
  })
}

async function startRunProcess(runId: string, job: JobExecutionRecord) {
  const meta: ActiveRun = {
    child: null,
    cancelRequested: false,
    tempDir: '',
    stdoutBuffer: '',
    stderrBuffer: '',
    redactions: [],
  }
  let finalized = false

  const finalizeOnce = async (
    status: MigrationRunStatus,
    exitCode: number | null,
    errorMessage: string | null,
  ) => {
    if (finalized) {
      return
    }

    finalized = true

    try {
      await finalizeRun(runId, status, exitCode, errorMessage, meta)
    }
    finally {
      await cleanupTempDir(meta.tempDir)
    }
  }

  getRuntimeState().activeRuns.set(runId, meta)

  try {
    const firstItem = job.items[0]

    if (!firstItem) {
      await finalizeOnce('failed', null, 'Batch job does not contain any mailbox pair.')
      return
    }

    await execute(
      'UPDATE migration_runs SET command_preview = ?, updated_at = ? WHERE id = ?',
      [buildBatchCommandPreview(job, firstItem), new Date(), runId],
    )

    await appendRunLog(runId, `Starting migration job "${job.name}" with ${job.items.length} mailbox pair(s).`, 'system')
    await updateRunProgress(runId, 0, 0, job.items.length)

    let completedItems = 0
    let failedItems = 0

    for (const [index, item] of job.items.entries()) {
      if (meta.cancelRequested) {
        await finalizeOnce('canceled', null, 'Run canceled by user.')
        return
      }

      const result = await executeRunItem(runId, job, item, index, meta)

      if (result.status === 'canceled') {
        await finalizeOnce('canceled', result.exitCode, result.errorMessage)
        return
      }

      if (result.status === 'failed') {
        failedItems += 1
        await updateRunProgress(runId, completedItems, failedItems, job.items.length)
        await appendRunLog(runId, `Progress: ${completedItems}/${job.items.length} completed, ${failedItems} failed.`, 'system')

        if (!job.continueOnError) {
          const prefix = job.items.length > 1 ? `Mailbox ${index + 1}/${job.items.length} failed. ` : ''
          await finalizeOnce('failed', result.exitCode, `${prefix}${result.errorMessage ?? 'Unknown execution error.'}`)
          return
        }

        await appendRunLog(runId, `Continuing after failure on mailbox ${index + 1}/${job.items.length}.`, 'system')
        continue
      }

      completedItems += 1
      await updateRunProgress(runId, completedItems, failedItems, job.items.length)
      await appendRunLog(runId, `Progress: ${completedItems}/${job.items.length} completed${failedItems ? `, ${failedItems} failed` : ''}.`, 'system')
    }

    if (failedItems > 0) {
      await finalizeOnce('failed', failedItems, `${failedItems}/${job.items.length} mailbox pair(s) failed.`)
      return
    }

    await finalizeOnce('succeeded', 0, null)
  }
  catch (error) {
    await finalizeOnce('failed', null, humanizeExecutionError(error))
  }
}

async function claimNextQueuedRun() {
  const queuedRows = await queryRows<RowDataPacket[]>(`
    SELECT id, job_id
    FROM migration_runs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  `)

  const queuedRun = queuedRows[0]

  if (!queuedRun) {
    return null
  }

  const startedAt = new Date()
  const result = await execute(
    `
      UPDATE migration_runs
      SET status = 'running', started_at = ?, finished_at = NULL, exit_code = NULL, error_message = NULL, updated_at = ?
      WHERE id = ? AND status = 'queued'
    `,
    [startedAt, startedAt, queuedRun.id],
  )

  if (result.affectedRows === 0) {
    return null
  }

  return {
    runId: String(queuedRun.id),
    jobId: String(queuedRun.job_id),
  }
}

async function processQueuedRuns() {
  const state = getRuntimeState()

  if (state.queueLoopRunning) {
    return
  }

  state.queueLoopRunning = true

  try {
    while (state.activeRuns.size < getMaxConcurrentRuns()) {
      const claimedRun = await claimNextQueuedRun()

      if (!claimedRun) {
        break
      }

      await emitRunStatus(claimedRun.runId)

      try {
        const job = await getJobForExecution(claimedRun.jobId)
        await startRunProcess(claimedRun.runId, job)
      }
      catch (error) {
        await finalizeRun(claimedRun.runId, 'failed', null, humanizeExecutionError(error), null)
      }
    }
  }
  finally {
    state.queueLoopRunning = false
  }
}

export async function markInterruptedRunsAsFailed() {
  await execute(
    `
      UPDATE migration_runs
      SET status = 'failed', error_message = ?, finished_at = ?, updated_at = ?
      WHERE status = 'running'
    `,
    [
      'The server restarted while this run was in progress.',
      new Date(),
      new Date(),
    ],
  )
}

export async function initializeRunScheduler() {
  const state = getRuntimeState()

  if (state.schedulerStarted) {
    return
  }

  state.schedulerStarted = true

  await markInterruptedRunsAsFailed()
  await processQueuedRuns()

  state.schedulerTimer = setInterval(() => {
    void processQueuedRuns()
  }, getQueuePollMs())

  state.schedulerTimer.unref?.()
}

export async function getRunDetail(runId: string) {
  const runRow = await getRunRowOrThrow(runId)
  const logRows = await queryRows<RunLogRow[]>(`
    SELECT id, run_id, stream, message, created_at
    FROM migration_run_logs
    WHERE run_id = ?
    ORDER BY id DESC
    LIMIT 500
  `, [runId])

  const logs = [...logRows].reverse().map(mapRunLog)

  const detail: MigrationRunDetail = {
    ...mapRunSummary(runRow),
    logs,
  }

  return detail
}

export async function queueRunForJob(jobId: string, triggerType: RunTriggerType = 'manual') {
  const job = await getJobForExecution(jobId)

  const runId = randomUUID()

  await execute(
    'INSERT INTO migration_runs (id, job_id, status, trigger_type, batch_completed_items, batch_failed_items, batch_total_items) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [runId, jobId, 'queued', triggerType, 0, 0, job.items.length],
  )

  await appendRunLog(runId, triggerType === 'retry' ? 'Retry queued from dashboard.' : 'Run queued from dashboard.', 'system')
  await emitRunStatus(runId)
  void processQueuedRuns()

  const runRow = await getRunRowOrThrow(runId)
  return mapRunSummary(runRow)
}

export async function retryRun(runId: string) {
  const runRow = await getRunRowOrThrow(runId)
  return queueRunForJob(runRow.job_id, 'retry')
}

export async function cancelRun(runId: string) {
  const runRow = await getRunRowOrThrow(runId)

  if (runRow.status === 'canceled' || runRow.status === 'failed' || runRow.status === 'succeeded') {
    return mapRunSummary(runRow)
  }

  if (runRow.status === 'queued') {
    await appendRunLog(runId, 'Queued run canceled before execution.', 'system')
    await execute(
      `
        UPDATE migration_runs
        SET status = 'canceled', error_message = ?, finished_at = ?, updated_at = ?
        WHERE id = ? AND status = 'queued'
      `,
      ['Run canceled by user.', new Date(), new Date(), runId],
    )
    await emitRunStatus(runId)

    const canceledRun = await getRunRowOrThrow(runId)
    return mapRunSummary(canceledRun)
  }

  const activeRun = getRuntimeState().activeRuns.get(runId)

  if (!activeRun) {
    await execute(
      `
        UPDATE migration_runs
        SET status = 'canceled', error_message = ?, finished_at = ?, updated_at = ?
        WHERE id = ?
      `,
      ['Run canceled by user.', new Date(), new Date(), runId],
    )
    await emitRunStatus(runId)

    const canceledRun = await getRunRowOrThrow(runId)
    return mapRunSummary(canceledRun)
  }

  activeRun.cancelRequested = true
  await appendRunLog(runId, 'Cancellation requested. Waiting for imapsync to stop.', 'system')

  activeRun.child?.kill('SIGTERM')

  setTimeout(() => {
    const currentRun = getRuntimeState().activeRuns.get(runId)

    if (currentRun?.cancelRequested) {
      currentRun.child?.kill('SIGKILL')
    }
  }, 10_000).unref?.()

  const refreshingRun = await getRunRowOrThrow(runId)
  return mapRunSummary(refreshingRun)
}

export function subscribeToRunEvents(
  runId: string,
  handlers: {
    onLog: (log: MigrationRunLog) => void
    onStatus: (summary: MigrationRunSummary) => void
  },
) {
  const state = getRuntimeState()
  const logEvent = `run:${runId}:log`
  const statusEvent = `run:${runId}:status`

  state.emitter.on(logEvent, handlers.onLog)
  state.emitter.on(statusEvent, handlers.onStatus)

  return () => {
    state.emitter.off(logEvent, handlers.onLog)
    state.emitter.off(statusEvent, handlers.onStatus)
  }
}
