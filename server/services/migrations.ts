import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { getDb, queryRows } from '../utils/db'

interface MigrationDefinition {
  id: string
  statements: string[]
}

interface AppliedMigrationRow extends RowDataPacket {
  id: string
}

const migrations: MigrationDefinition[] = [
  {
    id: '001_initial_schema',
    statements: [
      `
        CREATE TABLE IF NOT EXISTS migration_jobs (
          id CHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          source_host VARCHAR(255) NOT NULL,
          source_port INT NOT NULL,
          source_security VARCHAR(16) NOT NULL,
          source_username VARCHAR(255) NOT NULL,
          source_password_enc TEXT NOT NULL,
          destination_host VARCHAR(255) NOT NULL,
          destination_port INT NOT NULL,
          destination_security VARCHAR(16) NOT NULL,
          destination_username VARCHAR(255) NOT NULL,
          destination_password_enc TEXT NOT NULL,
          dry_run TINYINT(1) NOT NULL DEFAULT 0,
          delete_on_destination TINYINT(1) NOT NULL DEFAULT 0,
          folder_filter TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
      `
        CREATE TABLE IF NOT EXISTS migration_runs (
          id CHAR(36) PRIMARY KEY,
          job_id CHAR(36) NOT NULL,
          status VARCHAR(16) NOT NULL,
          trigger_type VARCHAR(16) NOT NULL DEFAULT 'manual',
          started_at DATETIME NULL,
          finished_at DATETIME NULL,
          exit_code INT NULL,
          command_preview TEXT NULL,
          error_message TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_migration_runs_job FOREIGN KEY (job_id) REFERENCES migration_jobs(id) ON DELETE CASCADE,
          INDEX idx_migration_runs_job_created (job_id, created_at DESC),
          INDEX idx_migration_runs_status_created (status, created_at ASC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
      `
        CREATE TABLE IF NOT EXISTS migration_run_logs (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          run_id CHAR(36) NOT NULL,
          stream VARCHAR(16) NOT NULL,
          message MEDIUMTEXT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_migration_run_logs_run FOREIGN KEY (run_id) REFERENCES migration_runs(id) ON DELETE CASCADE,
          INDEX idx_migration_run_logs_run_id (run_id, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
    ],
  },
  {
    id: '002_job_items',
    statements: [
      `
        CREATE TABLE IF NOT EXISTS migration_job_items (
          id CHAR(36) PRIMARY KEY,
          job_id CHAR(36) NOT NULL,
          sort_order INT NOT NULL,
          source_host VARCHAR(255) NOT NULL,
          source_port INT NOT NULL,
          source_security VARCHAR(16) NOT NULL,
          source_username VARCHAR(255) NOT NULL,
          source_password_enc TEXT NOT NULL,
          destination_host VARCHAR(255) NOT NULL,
          destination_port INT NOT NULL,
          destination_security VARCHAR(16) NOT NULL,
          destination_username VARCHAR(255) NOT NULL,
          destination_password_enc TEXT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_migration_job_items_job FOREIGN KEY (job_id) REFERENCES migration_jobs(id) ON DELETE CASCADE,
          INDEX idx_migration_job_items_job_order (job_id, sort_order ASC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
    ],
  },
  {
    id: '003_batch_progress_and_continue_on_error',
    statements: [
      `
        ALTER TABLE migration_jobs
        ADD COLUMN continue_on_error TINYINT(1) NOT NULL DEFAULT 0
      `,
      `
        ALTER TABLE migration_runs
        ADD COLUMN batch_completed_items INT NOT NULL DEFAULT 0,
        ADD COLUMN batch_failed_items INT NOT NULL DEFAULT 0,
        ADD COLUMN batch_total_items INT NOT NULL DEFAULT 0
      `,
    ],
  },
]

async function withTransaction(callback: (connection: PoolConnection) => Promise<void>) {
  const db = await getDb()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()
    await callback(connection)
    await connection.commit()
  }
  catch (error) {
    await connection.rollback()
    throw error
  }
  finally {
    connection.release()
  }
}

export async function ensureSchemaReady() {
  const db = await getDb()

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const appliedRows = await queryRows<AppliedMigrationRow[]>(
    'SELECT id FROM schema_migrations ORDER BY applied_at ASC',
  )

  const appliedIds = new Set(appliedRows.map((row) => row.id))

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue
    }

    await withTransaction(async (connection) => {
      for (const statement of migration.statements) {
        await connection.query(statement)
      }

      await connection.execute('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id])
    })
  }
}
