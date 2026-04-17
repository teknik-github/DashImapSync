export const securityModes = ['none', 'ssl', 'tls'] as const

export type SecurityMode = (typeof securityModes)[number]

export const runStatuses = ['queued', 'running', 'succeeded', 'failed', 'canceled'] as const

export type MigrationRunStatus = (typeof runStatuses)[number]

export const runTriggerTypes = ['manual', 'retry'] as const

export type RunTriggerType = (typeof runTriggerTypes)[number]

export interface JobDraftPayload {
  name: string
  sourceHost: string
  sourcePort: number
  sourceSecurity: SecurityMode
  sourceUsername: string
  sourcePassword?: string
  destinationHost: string
  destinationPort: number
  destinationSecurity: SecurityMode
  destinationUsername: string
  destinationPassword?: string
  dryRun: boolean
  deleteOnDestination: boolean
  continueOnError: boolean
  folderFilter: string
}

export interface MigrationRunLog {
  id: number
  runId: string
  stream: 'stdout' | 'stderr' | 'system'
  message: string
  createdAt: string
}

export interface MigrationRunSummary {
  id: string
  jobId: string
  status: MigrationRunStatus
  triggerType: RunTriggerType
  startedAt: string | null
  finishedAt: string | null
  exitCode: number | null
  commandPreview: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  lastLogLine: string | null
  batchCompletedItems: number
  batchFailedItems: number
  batchTotalItems: number
}

export interface MigrationRunDetail extends MigrationRunSummary {
  logs: MigrationRunLog[]
}

export interface MigrationJobItem {
  id: string
  sortOrder: number
  sourceHost: string
  sourcePort: number
  sourceSecurity: SecurityMode
  sourceUsername: string
  destinationHost: string
  destinationPort: number
  destinationSecurity: SecurityMode
  destinationUsername: string
}

export interface MigrationJobSummary {
  id: string
  name: string
  sourceHost: string
  sourcePort: number
  sourceSecurity: SecurityMode
  sourceUsername: string
  destinationHost: string
  destinationPort: number
  destinationSecurity: SecurityMode
  destinationUsername: string
  dryRun: boolean
  deleteOnDestination: boolean
  continueOnError: boolean
  folderFilter: string
  itemCount: number
  isBatch: boolean
  createdAt: string
  updatedAt: string
  latestRun: MigrationRunSummary | null
}

export interface MigrationJobDetail extends MigrationJobSummary {
  password1Saved: boolean
  password2Saved: boolean
  items: MigrationJobItem[]
  runs: MigrationRunSummary[]
}

export interface DashboardSummary {
  totalJobs: number
  queuedRuns: number
  runningRuns: number
  succeededRuns: number
  failedRuns: number
}

export interface AdminSessionUser {
  username: string
}

export interface AdminSessionResponse {
  authenticated: boolean
  user: AdminSessionUser | null
}

export interface ConnectionTestResult {
  ok: boolean
  checkedAt: string
  message: string
  commandPreview: string
  logs: string[]
}

export interface CsvImportResult {
  importedCount: number
  jobCount: number
  jobIds: string[]
  jobNames: string[]
}

export interface RunLogEntry {
  id: string
  jobId: string
  jobName: string
  status: MigrationRunStatus
  triggerType: RunTriggerType
  startedAt: string | null
  finishedAt: string | null
  exitCode: number | null
  errorMessage: string | null
  lastLogLine: string | null
  createdAt: string
}

export interface AllRunsResponse {
  runs: RunLogEntry[]
  total: number
  page: number
  limit: number
}

export interface StatsOverview {
  totalJobs: number
  totalRuns: number
  succeededRuns: number
  failedRuns: number
  canceledRuns: number
  successRate: number
  avgDurationSeconds: number | null
}

export interface DailyRunStat {
  date: string
  succeeded: number
  failed: number
  canceled: number
  total: number
}

export interface TopJobStat {
  jobId: string
  jobName: string
  totalRuns: number
  succeededRuns: number
}

export interface StatsResponse {
  overview: StatsOverview
  dailyRuns: DailyRunStat[]
  topJobs: TopJobStat[]
}
