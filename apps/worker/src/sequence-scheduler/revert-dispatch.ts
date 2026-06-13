import { and, db, eq } from "@chatbotx.io/database/client"
import { sequenceDispatchModel } from "@chatbotx.io/database/schema"

export async function revertDispatchToPending(
  dispatchId: string,
  workspaceId: string,
) {
  await db
    .update(sequenceDispatchModel)
    .set({
      status: "pending",
      lockedAt: null,
      lockOwner: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sequenceDispatchModel.id, dispatchId),
        eq(sequenceDispatchModel.workspaceId, workspaceId),
        eq(sequenceDispatchModel.status, "running"),
      ),
    )
}
