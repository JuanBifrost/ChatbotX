import { db, sql } from "@chatbotx.io/database/client"
import { getChildLogger } from "@chatbotx.io/logger"
import {
  IntegrationJobAction,
  integrationQueue,
} from "@chatbotx.io/worker-config"

const log = getChildLogger("scan-coexist-runs")

const BATCH = 500
const MAX_ATTEMPTS = 5

type PickedRun = {
  id: string
  attempts: number
  channel: "whatsapp" | "messenger"
  integrationId: string
  workspaceId: string
}

export async function scanCoexistRuns(): Promise<void> {
  // Cap runs that have exhausted all retries → mark failed.
  await db.execute(sql`
    UPDATE "CoexistSyncRun"
    SET status = 'failed',
        "currentError" = 'Max scheduler retries exceeded',
        "finishedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE attempts >= ${MAX_ATTEMPTS}
      AND status IN ('init', 'running')
  `)

  // Atomically pick eligible runs and increment attempts.
  const picked = await db.execute<PickedRun>(sql`
    UPDATE "CoexistSyncRun"
    SET attempts = attempts + 1,
        status = 'init',
        "updatedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "CoexistSyncRun"
      WHERE (
        (status = 'init' AND "createdAt" < NOW() - INTERVAL '10 seconds')
        OR (status = 'running' AND "lastHeartbeatAt" < NOW() - INTERVAL '1 hour')
      )
      AND attempts < ${MAX_ATTEMPTS}
      ORDER BY "createdAt" ASC
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, attempts, channel, "integrationId", "workspaceId"
  `)

  if (picked.rows.length === 0) {
    return
  }

  log.info({ count: picked.rows.length }, "scanCoexistRuns: picked runs")

  // Collect distinct WhatsApp integration IDs from the batch and fetch them
  // all in a single query — avoids N sequential DB round-trips (H6 fix).
  const whatsappIntegIds = [
    ...new Set(
      picked.rows
        .filter((r) => r.channel === "whatsapp")
        .map((r) => r.integrationId),
    ),
  ]

  const whatsappIntegMap = new Map<
    string,
    { id: string; phoneNumberId: string | null }
  >()

  if (whatsappIntegIds.length > 0) {
    const integrations = await db.query.integrationWhatsappModel.findMany({
      where: { id: { in: whatsappIntegIds } },
      columns: { id: true, phoneNumberId: true },
    })
    for (const integ of integrations) {
      whatsappIntegMap.set(integ.id, integ)
    }
  }

  for (const run of picked.rows) {
    try {
      if (run.channel === "whatsapp") {
        const integ = whatsappIntegMap.get(run.integrationId)

        if (!integ?.phoneNumberId) {
          await db.execute(sql`
            UPDATE "CoexistSyncRun"
            SET status = 'failed',
                "currentError" = 'integration missing phoneNumberId',
                "finishedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = ${run.id}
          `)
          log.warn(
            { runId: run.id },
            "scanCoexistRuns: missing phoneNumberId, marked failed",
          )
          continue
        }

        await integrationQueue.add(
          IntegrationJobAction.coexistWhatsappFlush,
          {
            type: IntegrationJobAction.coexistWhatsappFlush,
            data: { runId: run.id, phoneNumberId: integ.phoneNumberId },
          },
          {
            jobId: `coexist-run-${run.id}-${run.attempts}`,
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: { count: 100 },
          },
        )
      } else {
        await integrationQueue.add(
          IntegrationJobAction.coexistMessengerSync,
          {
            type: IntegrationJobAction.coexistMessengerSync,
            data: {
              runId: run.id,
              integrationId: run.integrationId,
              workspaceId: run.workspaceId,
            },
          },
          {
            jobId: `coexist-run-${run.id}-${run.attempts}`,
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: { count: 100 },
          },
        )
      }
    } catch (err) {
      log.error({ err, runId: run.id }, "scanCoexistRuns: enqueue failed")
    }
  }
}
