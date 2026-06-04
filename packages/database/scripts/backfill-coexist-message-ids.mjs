// biome-ignore-all lint/suspicious/noBitwiseOperators: bit-packing 63-bit snowflake IDs
/**
 * Backfill coexist historically-imported Message IDs.
 *
 * Why:
 *   Earlier coexist sync inserts used `createId()` which mints today's wall-clock
 *   snowflake, breaking the (id ↔ createdAt) ordering invariant. This script
 *   re-IDs those rows with the same 63-bit time-derived layout the live coexist
 *   handler now uses:
 *
 *     [ ts: ms since 2004-02-01 epoch (<=53 bits) ][ 10 bits partition ][ 4 bits seq ]
 *     (partition + seq occupy the low 14 bits; ts is shifted left by 14)
 *
 *   Partition is derived from `conversationId` here (the original runId is
 *   unrecoverable retroactively). Pre-flight verifies no `Attachment` rows
 *   reference the IDs we're about to mutate — historical import never inserts
 *   attachments, so this should always be 0.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node ./scripts/backfill-coexist-message-ids.mjs
 *   DATABASE_URL=... DRY_RUN=1 node ./scripts/backfill-coexist-message-ids.mjs
 *
 * Idempotent: rows already satisfying the invariant are skipped.
 */
import { Pool } from "pg"
import {
  buildHistoricalIdMaker,
  DRIFT_THRESHOLD_MS,
  decodeLegacyTimestampMs,
} from "./coexist-id-layout.mjs"

const BATCH_SIZE = 1000
const DRY_RUN = process.env.DRY_RUN === "1"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required.")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl, max: 2 })

async function preflight() {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM "Attachment" a
    JOIN "Message" m ON m.id = a."messageId"
    WHERE m."createdAt" < NOW() - INTERVAL '1 day'
  `)
  const count = rows[0]?.count ?? 0
  if (count > 0) {
    console.error(
      `Preflight FAILED: ${count} Attachment rows reference historical Message rows. ` +
        "Add ON UPDATE CASCADE to Attachment.messageId FK before backfilling.",
    )
    process.exit(1)
  }
  console.log("Preflight OK: no Attachment rows reference historical messages.")
}

async function backfill() {
  let processed = 0
  let updated = 0
  let skipped = 0
  let lastId = "0"

  // Per-conversation factory cache so seq state survives across batches.
  const makers = new Map()
  const getMaker = (conversationId) => {
    let m = makers.get(conversationId)
    if (!m) {
      m = buildHistoricalIdMaker(conversationId)
      makers.set(conversationId, m)
    }
    return m
  }

  while (true) {
    const { rows } = await pool.query(
      `
        SELECT id, "conversationId", "createdAt"
        FROM "Message"
        WHERE id > $1
        ORDER BY id ASC
        LIMIT $2
      `,
      [lastId, BATCH_SIZE],
    )
    if (rows.length === 0) {
      break
    }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      for (const row of rows) {
        processed += 1
        lastId = row.id
        const decodedIdMs = decodeLegacyTimestampMs(row.id)
        const createdAtMs = new Date(row.createdAt).getTime()
        if (decodedIdMs - createdAtMs <= DRIFT_THRESHOLD_MS) {
          skipped += 1
          continue
        }
        const make = getMaker(row.conversationId)
        let attempts = 0
        while (attempts < 3) {
          const newId = make(createdAtMs)
          try {
            if (DRY_RUN) {
              break
            }
            await client.query(`UPDATE "Message" SET id = $1 WHERE id = $2`, [
              newId,
              row.id,
            ])
            break
          } catch (err) {
            if (err && err.code === "23505") {
              attempts += 1
              continue
            }
            throw err
          }
        }
        if (attempts >= 3) {
          throw new Error(
            `Failed to assign unique id after 3 retries for old id ${row.id}`,
          )
        }
        updated += 1
      }
      if (DRY_RUN) {
        await client.query("ROLLBACK")
      } else {
        await client.query("COMMIT")
      }
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }

    if (processed % 10_000 === 0) {
      console.log(
        `Progress: processed=${processed} updated=${updated} skipped=${skipped} lastId=${lastId}`,
      )
    }
  }

  console.log(
    `Done. processed=${processed} updated=${updated} skipped=${skipped}${
      DRY_RUN ? " (dry run — no commits)" : ""
    }`,
  )
}

try {
  console.log(`DRY_RUN=${DRY_RUN ? "yes" : "no"}`)
  await preflight()
  await backfill()
} catch (err) {
  console.error("Backfill failed:", err)
  process.exit(1)
} finally {
  await pool.end()
}
