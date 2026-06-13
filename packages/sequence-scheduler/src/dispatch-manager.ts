import {
  and,
  type DatabaseClient,
  db,
  eq,
  inArray,
  type Transaction,
} from "@chatbotx.io/database/client"
import { sequenceDispatchModel } from "@chatbotx.io/database/schema"
import { sequenceConnections } from "@chatbotx.io/redis"
import { SchedulerClient } from "@chatbotx.io/scheduler"
import { createId } from "@chatbotx.io/utils"
import { createHash } from "crypto"

type DrizzleClient = typeof db | Transaction
type ScheduledDispatch = { id: string; bucket: number }

export function calculateBucket(
  workspaceId: string,
  contactId: string,
): number {
  const key = `${workspaceId}:${contactId}`
  const hash = createHash("sha256").update(key).digest()
  return hash[0] // First byte gives 0-255
}

export function generateIdempotencyKey(
  workspaceId: string,
  enrollmentId: string,
  stepId: string,
  runAt: Date,
): string {
  return `${workspaceId}:${enrollmentId}:${stepId}:${runAt.toISOString()}`
}
export interface CreateDispatchParams {
  client?: DrizzleClient
  contactId: string
  contactInboxId: string
  enrollmentId: string
  runAt: Date
  sequenceId: string
  stepId: string
  workspaceId: string
}
export async function createDispatch(
  params: CreateDispatchParams,
): Promise<{ id: string; bucket: number; runAtMs: string }> {
  const {
    workspaceId,
    sequenceId,
    contactId,
    contactInboxId,
    stepId,
    enrollmentId,
    runAt,
    client,
  } = params
  const bucket = calculateBucket(workspaceId, contactId)
  const runAtMs = String(runAt.getTime())
  const dispatchId = createId()
  const idempotencyKey = generateIdempotencyKey(
    workspaceId,
    enrollmentId,
    stepId,
    runAt,
  )

  const insertDispatch = async (tx: DrizzleClient) => {
    const [dispatch] = await tx
      .insert(sequenceDispatchModel)
      .values({
        id: dispatchId,
        workspaceId,
        sequenceId,
        contactId,
        contactInboxId,
        stepId,
        enrollmentId,
        runAtMs,
        bucket,
        idempotencyKey,
        status: "pending",
        attempt: 0,
      })
      .returning({
        id: sequenceDispatchModel.id,
        bucket: sequenceDispatchModel.bucket,
        runAtMs: sequenceDispatchModel.runAtMs,
      })

    if (!dispatch) {
      throw new Error("Failed to create dispatch")
    }

    return dispatch
  }

  if (client) {
    return await insertDispatch(client)
  }

  return await insertDispatch(db)
}
export interface CancelPendingDispatchesParams {
  client?: DatabaseClient | Transaction
  enrollmentId: string
  reason?: string
  /**
   * Set to false only when the caller removes scheduler entries after its
   * surrounding database transaction has committed.
   */
  removeFromSchedule?: boolean
  workspaceId: string
}
export async function cancelPendingDispatches(
  params: CancelPendingDispatchesParams,
): Promise<ScheduledDispatch[]> {
  const {
    enrollmentId,
    workspaceId,
    client = db,
    removeFromSchedule = true,
  } = params

  const pendingDispatches = await client.query.sequenceDispatchModel.findMany({
    where: {
      enrollmentId,
      workspaceId,
      status: "pending",
    },
    columns: {
      id: true,
      bucket: true,
      sequenceId: true,
      contactId: true,
      stepId: true,
    },
  })

  if (pendingDispatches.length === 0) {
    return []
  }

  const dispatchIds = pendingDispatches.map((d) => d.id)
  await client
    .update(sequenceDispatchModel)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(sequenceDispatchModel.id, dispatchIds),
        eq(sequenceDispatchModel.workspaceId, workspaceId),
        eq(sequenceDispatchModel.status, "pending"),
      ),
    )

  if (removeFromSchedule) {
    await removeDispatchesFromSchedule(pendingDispatches)
  }

  return pendingDispatches.map((d) => ({
    id: d.id,
    bucket: d.bucket,
  }))
}

export async function removeDispatchesFromSchedule(
  dispatches: ScheduledDispatch[],
) {
  if (dispatches.length === 0) {
    return
  }

  const redisClient = await sequenceConnections.useExisting()
  const scheduler = new SchedulerClient(redisClient)

  const results = await Promise.allSettled(
    dispatches.map((dispatch) =>
      scheduler.removeFromSchedule(dispatch.bucket, dispatch.id),
    ),
  )
  const failures = results.flatMap((result, index) => {
    if (result.status !== "rejected") {
      return []
    }

    const dispatch = dispatches[index]
    if (!dispatch) {
      return []
    }

    return [{ dispatch, reason: result.reason }]
  })

  if (failures.length > 0) {
    const failedDispatches = failures
      .map(({ dispatch }) => `${dispatch.id} bucket=${dispatch.bucket}`)
      .join(", ")

    throw new AggregateError(
      failures.map(({ dispatch, reason }) => {
        const reasonMessage =
          reason instanceof Error ? reason.message : String(reason)
        return new Error(
          `Failed to remove ${dispatch.id} bucket=${dispatch.bucket}: ${reasonMessage}`,
        )
      }),
      `Failed to remove sequence dispatches from schedule: ${failedDispatches}`,
    )
  }
}
