"use server"

import { db, eq, findOrFail } from "@chatbotx.io/database/client"
import { inboxStatuses } from "@chatbotx.io/database/partials"
import {
  inboxModel,
  integrationTiktokModel,
} from "@chatbotx.io/database/schema"
import {
  type WorkspaceIdAndIdRequestParams,
  workspaceIdAndIdRequestParams,
} from "@/features/common/schemas"
import { workspaceActionClient } from "@/lib/safe-action"

export const disconnectTiktokAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdAndIdRequestParams)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId, id],
    }: {
      bindArgsParsedInputs: WorkspaceIdAndIdRequestParams
    }) => {
      const integrationTiktok = await findOrFail({
        table: integrationTiktokModel,
        where: { workspaceId, id },
        message: "Integration TikTok not found",
      })

      await db.transaction(async (tx) => {
        await tx
          .delete(integrationTiktokModel)
          .where(eq(integrationTiktokModel.id, integrationTiktok.id))
        await tx
          .update(inboxModel)
          .set({ status: inboxStatuses.enum.disconnected })
          .where(eq(inboxModel.id, integrationTiktok.inboxId))
      })
    },
  )
