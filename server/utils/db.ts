import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'

declare global {
  var __dashImapsyncDbPool: Pool | undefined
  var __dashImapsyncDbInitPromise: Promise<Pool> | undefined
}

function getDatabaseConfig() {
  const config = useRuntimeConfig()
  const host = config.dbHost || process.env.NUXT_DB_HOST || process.env.DB_HOST
  const port = Number(config.dbPort || process.env.NUXT_DB_PORT || process.env.DB_PORT || 3306)
  const user = config.dbUser || process.env.NUXT_DB_USER || process.env.DB_USER
  const password = config.dbPassword || process.env.NUXT_DB_PASSWORD || process.env.DB_PASSWORD || ''
  const database = config.dbName || process.env.NUXT_DB_NAME || process.env.DB_NAME

  if (!host || !user || !database) {
    throw new Error('Missing MySQL runtime config. Set NUXT_DB_HOST, NUXT_DB_USER, and NUXT_DB_NAME.')
  }

  return {
    host,
    port,
    user,
    password,
    database,
  }
}

async function initializePool() {
  const { host, port, user, password, database } = getDatabaseConfig()
  const adminConnection = await mysql.createConnection({
    host,
    port,
    user,
    password,
  })

  try {
    const escapedDatabase = database.replaceAll('`', '``')

    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${escapedDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
  }
  finally {
    await adminConnection.end()
  }

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
  })

  globalThis.__dashImapsyncDbPool = pool

  return pool
}

export async function getDb() {
  if (globalThis.__dashImapsyncDbPool) {
    return globalThis.__dashImapsyncDbPool
  }

  if (!globalThis.__dashImapsyncDbInitPromise) {
    globalThis.__dashImapsyncDbInitPromise = initializePool()
  }

  return globalThis.__dashImapsyncDbInitPromise
}

export async function queryRows<T extends RowDataPacket[]>(sql: string, params: any[] = []) {
  const db = await getDb()
  const [rows] = await db.query<T>(sql, params)
  return rows
}

export async function execute(sql: string, params: any[] = []) {
  const db = await getDb()
  const [result] = await db.execute<ResultSetHeader>(sql, params)
  return result
}

export async function withTransaction<T>(callback: (connection: PoolConnection) => Promise<T>) {
  const db = await getDb()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  }
  catch (error) {
    await connection.rollback()
    throw error
  }
  finally {
    connection.release()
  }
}

export function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date(value).toISOString()
}
