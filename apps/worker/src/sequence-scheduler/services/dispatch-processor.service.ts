import { and, db, eq } from "@chatbotx.io/database/client"
import { sequenceDispatchModel } from "@chatbotx.io/database/schema"
import { logger } from "../../lib/logger"
import type { DispatchWithRelations } from "./types"

export class DispatchProcessorService {
  async fetchDispatch(
    dispatchId: string,
    expectedStatus: string,
    workspaceId: string,
  ) {
    try {
      const dispatch = await db.query.sequenceDispatchModel.findFirst({
        where: {
          id: dispatchId,
          status: expectedStatus,
          workspaceId,
        },
        with: {
          sequence: true,
          contact: true,
          enrollment: true,
        },
      })

      return dispatch ?? null
    } catch (error) {
      logger.error(error, "Error fetchDispatch query failed")
      return null
    }
  }

  validateDispatch(
    dispatch: Awaited<ReturnType<typeof this.fetchDispatch>>,
  ): dispatch is DispatchWithRelations {
    if (dispatch?.status !== "pending") {
      return false
    }

    return true
  }

  isDispatchReady(dispatch: DispatchWithRelations): boolean {
    const nowMs = Date.now()
    const runAt = Number(dispatch.runAtMs)

    return runAt <= nowMs + 1000
  }

  async lockDispatch(dispatch: DispatchWithRelations): Promise<boolean> {
    const updated = await db
      .update(sequenceDispatchModel)
      .set({
        status: "running",
        lockedAt: new Date(),
        lockOwner: process.env.HOSTNAME || "unknown",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sequenceDispatchModel.id, dispatch.id),
          eq(sequenceDispatchModel.workspaceId, dispatch.workspaceId),
          eq(sequenceDispatchModel.status, "pending"),
        ),
      )
      .returning({ id: sequenceDispatchModel.id })

    return updated.length > 0
  }
}
