import type { RowDataPacket } from 'mysql2/promise'
import type { DailyRunStat, StatsOverview, StatsResponse, TopJobStat } from '../../shared/imapsync'
import { queryRows } from '../utils/db'

interface OverviewRow extends RowDataPacket {
  total_jobs: number
  total_runs: number
  succeeded_runs: number
  failed_runs: number
  canceled_runs: number
  avg_duration_seconds: number | null
}

interface DailyRunRow extends RowDataPacket {
  date: string
  succeeded: number
  failed: number
  canceled: number
  total: number
}

interface TopJobRow extends RowDataPacket {
  job_id: string
  job_name: string
  total_runs: number
  succeeded_runs: number
}

export async function getStats(): Promise<StatsResponse> {
  const [overviewRows, dailyRows, topJobRows] = await Promise.all([
    queryRows<OverviewRow[]>(`
      SELECT
        (SELECT COUNT(*) FROM migration_jobs) AS total_jobs,
        COUNT(*) AS total_runs,
        SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded_runs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_runs,
        SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) AS canceled_runs,
        AVG(CASE WHEN finished_at IS NOT NULL AND started_at IS NOT NULL
          THEN TIMESTAMPDIFF(SECOND, started_at, finished_at)
          ELSE NULL END) AS avg_duration_seconds
      FROM migration_runs
    `),
    queryRows<DailyRunRow[]>(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
        SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) AS canceled,
        COUNT(*) AS total
      FROM migration_runs
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY date ASC
    `),
    queryRows<TopJobRow[]>(`
      SELECT
        r.job_id,
        j.name AS job_name,
        COUNT(*) AS total_runs,
        SUM(CASE WHEN r.status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded_runs
      FROM migration_runs r
      JOIN migration_jobs j ON j.id = r.job_id
      GROUP BY r.job_id, j.name
      ORDER BY total_runs DESC
      LIMIT 5
    `),
  ])

  const ov = overviewRows[0]
  const totalRuns = Number(ov?.total_runs ?? 0)
  const succeededRuns = Number(ov?.succeeded_runs ?? 0)

  const overview: StatsOverview = {
    totalJobs: Number(ov?.total_jobs ?? 0),
    totalRuns,
    succeededRuns,
    failedRuns: Number(ov?.failed_runs ?? 0),
    canceledRuns: Number(ov?.canceled_runs ?? 0),
    successRate: totalRuns > 0 ? Math.round((succeededRuns / totalRuns) * 100) : 0,
    avgDurationSeconds: ov?.avg_duration_seconds != null ? Math.round(Number(ov.avg_duration_seconds)) : null,
  }

  const dailyRuns: DailyRunStat[] = dailyRows.map(row => ({
    date: row.date,
    succeeded: Number(row.succeeded),
    failed: Number(row.failed),
    canceled: Number(row.canceled),
    total: Number(row.total),
  }))

  const topJobs: TopJobStat[] = topJobRows.map(row => ({
    jobId: row.job_id,
    jobName: row.job_name,
    totalRuns: Number(row.total_runs),
    succeededRuns: Number(row.succeeded_runs),
  }))

  return { overview, dailyRuns, topJobs }
}
