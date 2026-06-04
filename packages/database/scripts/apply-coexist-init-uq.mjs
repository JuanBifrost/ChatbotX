/**
 * One-shot: add CoexistSyncRun_integration_init_uq partial unique index.
 * Migration 20260527123019_coexist was already applied; index is appended
 * to that migration's SQL for fresh installs, but needs to be added to
 * existing DBs here.
 *
 * Steps:
 *  1. Drop duplicate init rows per (integrationId, channel) — keep newest.
 *  2. Create the partial unique index (idempotent via IF NOT EXISTS).
 */
import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required.")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 })

try {
  await pool.query("BEGIN")

  const dedupe = await pool.query(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY "integrationId", channel
               ORDER BY "createdAt" DESC
             ) AS rn
      FROM "CoexistSyncRun"
      WHERE status = 'init'
    )
    DELETE FROM "CoexistSyncRun"
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    RETURNING id
  `)
  console.log(`Deduped ${dedupe.rowCount} stale init row(s).`)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CoexistSyncRun_integration_init_uq"
    ON "CoexistSyncRun" ("integrationId", channel)
    WHERE status = 'init'
  `)
  console.log("Index CoexistSyncRun_integration_init_uq created (or exists).")

  await pool.query("COMMIT")
  console.log("Done.")
} catch (error) {
  await pool.query("ROLLBACK")
  console.error("Failed:", error)
  process.exit(1)
} finally {
  await pool.end()
}
