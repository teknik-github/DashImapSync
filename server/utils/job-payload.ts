import { createError } from 'h3'
import { securityModes, type JobDraftPayload, type SecurityMode } from '../../shared/imapsync'

interface JobPayloadOptions {
  requireSourcePassword: boolean
  requireDestinationPassword: boolean
}

function assertObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Request body must be an object.',
    })
  }

  return value as Record<string, unknown>
}

function requireTrimmedString(value: unknown, label: string, maxLength = 255) {
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: `${label} is required.` })
  }

  const normalized = value.trim()

  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: `${label} is required.` })
  }

  if (normalized.length > maxLength) {
    throw createError({ statusCode: 400, statusMessage: `${label} is too long.` })
  }

  return normalized
}

function optionalSecret(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Password must be a string.' })
  }

  return value
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value === 'true' || value === '1'
  }

  if (typeof value === 'number') {
    return value === 1
  }

  return false
}

function normalizeSecurity(value: unknown, label: string): SecurityMode {
  if (typeof value !== 'string') {
    return 'ssl'
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return 'ssl'
  }

  const normalized = trimmedValue.toLowerCase() as SecurityMode

  if (!securityModes.includes(normalized)) {
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  }

  return normalized
}

function defaultPortForSecurity(security: SecurityMode) {
  return security === 'ssl' ? 993 : 143
}

function normalizePort(value: unknown, label: string, fallback: number) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const normalized = Number(value)

  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 65535) {
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  }

  return normalized
}

function normalizeFolderFilter(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n')
}

export function parseJobPayload(input: unknown, options: JobPayloadOptions): JobDraftPayload {
  const payload = assertObject(input)
  const sourceSecurity = normalizeSecurity(payload.sourceSecurity, 'Source security')
  const destinationSecurity = normalizeSecurity(payload.destinationSecurity, 'Destination security')
  const sourcePassword = optionalSecret(payload.sourcePassword)
  const destinationPassword = optionalSecret(payload.destinationPassword)

  if (options.requireSourcePassword && !sourcePassword) {
    throw createError({ statusCode: 400, statusMessage: 'Source password is required.' })
  }

  if (options.requireDestinationPassword && !destinationPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Destination password is required.' })
  }

  return {
    name: requireTrimmedString(payload.name, 'Migration name'),
    sourceHost: requireTrimmedString(payload.sourceHost, 'Source host'),
    sourcePort: normalizePort(payload.sourcePort, 'Source port', defaultPortForSecurity(sourceSecurity)),
    sourceSecurity,
    sourceUsername: requireTrimmedString(payload.sourceUsername, 'Source username'),
    sourcePassword,
    destinationHost: requireTrimmedString(payload.destinationHost, 'Destination host'),
    destinationPort: normalizePort(payload.destinationPort, 'Destination port', defaultPortForSecurity(destinationSecurity)),
    destinationSecurity,
    destinationUsername: requireTrimmedString(payload.destinationUsername, 'Destination username'),
    destinationPassword,
    dryRun: normalizeBoolean(payload.dryRun),
    deleteOnDestination: normalizeBoolean(payload.deleteOnDestination),
    continueOnError: normalizeBoolean(payload.continueOnError),
    folderFilter: normalizeFolderFilter(payload.folderFilter),
  }
}
