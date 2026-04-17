import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createError } from 'h3'
import type { ConnectionTestResult, SecurityMode } from '../../shared/imapsync'
import { resolveJobDraftPayload } from './jobs'

const connectionTestTimeoutMs = 30_000

function getImapsyncBinary() {
  const config = useRuntimeConfig()

  return config.imapsyncBinary || process.env.NUXT_IMAPSYNC_BINARY || process.env.IMAPSYNC_BINARY || 'imapsync'
}

function quoteArg(arg: string) {
  return /[\s"']/u.test(arg) ? JSON.stringify(arg) : arg
}

function appendSecurityArgs(args: string[], side: '1' | '2', security: SecurityMode) {
  if (security === 'ssl') {
    args.push(`--ssl${side}`)
  }
  else if (security === 'tls') {
    args.push(`--tls${side}`)
  }
}

function sanitizeOutputLine(line: string, redactions: string[]) {
  let sanitized = line.replaceAll('\u0000', '').replace(/\r/g, '')

  for (const secret of redactions) {
    if (!secret) {
      continue
    }

    sanitized = sanitized.split(secret).join('[redacted]')
  }

  return sanitized.trim()
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

function buildJustConnectArgs(payload: Awaited<ReturnType<typeof resolveJobDraftPayload>>, passfile1: string, passfile2: string) {
  const args = [
    '--host1', payload.sourceHost,
    '--port1', String(payload.sourcePort),
    '--user1', payload.sourceUsername,
    '--passfile1', passfile1,
    '--host2', payload.destinationHost,
    '--port2', String(payload.destinationPort),
    '--user2', payload.destinationUsername,
    '--passfile2', passfile2,
    '--justconnect',
  ]

  appendSecurityArgs(args, '1', payload.sourceSecurity)
  appendSecurityArgs(args, '2', payload.destinationSecurity)

  return args
}

function buildJustConnectPreview(payload: Awaited<ReturnType<typeof resolveJobDraftPayload>>) {
  const previewArgs = [
    '--host1', payload.sourceHost,
    '--port1', String(payload.sourcePort),
    '--user1', payload.sourceUsername,
    '--passfile1', '<secure-file>',
    '--host2', payload.destinationHost,
    '--port2', String(payload.destinationPort),
    '--user2', payload.destinationUsername,
    '--passfile2', '<secure-file>',
    '--justconnect',
  ]

  appendSecurityArgs(previewArgs, '1', payload.sourceSecurity)
  appendSecurityArgs(previewArgs, '2', payload.destinationSecurity)

  return ['imapsync', ...previewArgs.map(quoteArg)].join(' ')
}

function buildConnectionTestMessage(ok: boolean, logs: string[], exitDetail?: string) {
  if (ok) {
    return 'Source and destination IMAP connections succeeded.'
  }

  const mostRelevantLog = logs.find((line) => line.length > 0)

  return mostRelevantLog || exitDetail || 'IMAP connection test failed.'
}

export async function testJobConnection(input: unknown, jobId?: string): Promise<ConnectionTestResult> {
  const payload = await resolveJobDraftPayload(input, jobId)
  const commandPreview = buildJustConnectPreview(payload)
  const redactions = [payload.sourcePassword, payload.destinationPassword]
  const collectedLogs: string[] = []
  let tempDir = ''

  const pushOutput = (chunk: string) => {
    const sanitizedLines = chunk
      .split('\n')
      .map((line) => sanitizeOutputLine(line, redactions))
      .filter(Boolean)

    for (const line of sanitizedLines) {
      collectedLogs.push(line)
    }

    if (collectedLogs.length > 200) {
      collectedLogs.splice(0, collectedLogs.length - 200)
    }
  }

  try {
    tempDir = await mkdtemp(join(tmpdir(), 'dash-imapsync-test-'))

    const sourcePassfile = join(tempDir, 'source.pass')
    const destinationPassfile = join(tempDir, 'destination.pass')

    await writeFile(sourcePassfile, `${payload.sourcePassword}\n`, { mode: 0o600 })
    await writeFile(destinationPassfile, `${payload.destinationPassword}\n`, { mode: 0o600 })

    const args = buildJustConnectArgs(payload, sourcePassfile, destinationPassfile)
    const result = await new Promise<{ ok: boolean, exitDetail?: string }>((resolve) => {
      const child = spawn(getImapsyncBinary(), args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        resolve({ ok: false, exitDetail: 'Connection test timed out after 30 seconds.' })
      }, connectionTestTimeoutMs)

      timer.unref?.()

      child.stdout.on('data', (chunk) => {
        pushOutput(chunk.toString('utf8'))
      })

      child.stderr.on('data', (chunk) => {
        pushOutput(chunk.toString('utf8'))
      })

      child.on('error', (error) => {
        clearTimeout(timer)
        resolve({ ok: false, exitDetail: humanizeExecutionError(error) })
      })

      child.on('close', (code, signal) => {
        clearTimeout(timer)

        if (code === 0) {
          resolve({ ok: true })
          return
        }

        const exitDetail = signal
          ? `imapsync exited because of signal ${signal}.`
          : `imapsync exited with code ${code ?? 'unknown'}.`

        resolve({ ok: false, exitDetail })
      })
    })

    return {
      ok: result.ok,
      checkedAt: new Date().toISOString(),
      message: buildConnectionTestMessage(result.ok, collectedLogs, result.exitDetail),
      commandPreview,
      logs: collectedLogs,
    }
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: humanizeExecutionError(error),
    })
  }
  finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}
