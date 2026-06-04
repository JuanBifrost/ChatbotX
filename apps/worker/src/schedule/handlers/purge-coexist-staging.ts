import { db, sql } from "@chatbotx.io/database/client"
import { getChildLogger } from "@chatbotx.io/logger"

const log = getChildLogger("purge-coexist-staging")

const RETENTION_INTERVAL = sql`INTERVAL '48 hours'`
const CHUNK_SIZE = 500
const MAX_CHUNKS_PER_RUN = 20
const INTER_CHUNK_DELAY_MS = 100

type PurgedId = { id: string }

export async function purgeCoexistStaging(): Promise<void> {
  let totalDeleted = 0

  for (let chunk = 0; chunk < MAX_CHUNKS_PER_RUN; chunk++) {
    const deleted = await db.execute<PurgedId>(sql`
      DELETE FROM "WhatsappCoexistStaging"
      WHERE id IN (
        SELECT id FROM "WhatsappCoexistStaging"
        WHERE "processedAt" IS NOT NULL
          AND "processedAt" < NOW() - ${RETENTION_INTERVAL}
        ORDER BY "processedAt" ASC
        LIMIT ${CHUNK_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `)

    const count = deleted.rows.length
    totalDeleted += count

    if (count < CHUNK_SIZE) {
      break
    }

    await new Promise((resolve) => setTimeout(resolve, INTER_CHUNK_DELAY_MS))
  }

  if (totalDeleted > 0) {
    log.info({ deleted: totalDeleted }, "purgeCoexistStaging: rows purged")
  }
}
