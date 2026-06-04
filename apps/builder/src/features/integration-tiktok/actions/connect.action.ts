import {
  connectChannelIntegration,
  workspaceService,
} from "@chatbotx.io/business"
import { db } from "@chatbotx.io/database/client"
import type { TiktokCredential } from "@chatbotx.io/database/partials"
import { integrationTiktokModel } from "@chatbotx.io/database/schema"
import type { TiktokAuthValue } from "@chatbotx.io/integration-tiktok"
import { createId } from "@chatbotx.io/utils"
import { integrations } from "@/integration"

export async function connectTiktokHandler({
  tiktokSettings,
  workspaceId,
  req,
  redirectUrl,
}: {
  tiktokSettings: TiktokCredential
  workspaceId: string
  req: Request
  redirectUrl: string
}) {
  const authValue = (await integrations.tiktok.handleRequest?.({
    config: {
      ...tiktokSettings,
      redirectUrl,
    },
    req,
  })) as TiktokAuthValue

  const openId = authValue.metadata.openId
  const displayName = authValue.metadata.displayName

  const { ownerId } = await workspaceService.findById({ id: workspaceId })

  await db.transaction(async (tx) => {
    await connectChannelIntegration({
      tx,
      ownerId,
      inboxData: {
        workspaceId,
        name: displayName,
        channel: "tiktok",
        sourceId: authValue.metadata.username,
      },
      insertIntegration: async (inboxId) => {
        await tx
          .insert(integrationTiktokModel)
          .values({
            id: createId(),
            inboxId,
            workspaceId,
            openId,
            name: displayName,
            auth: authValue,
          })
          .onConflictDoUpdate({
            target: [integrationTiktokModel.openId],
            set: { auth: authValue, name: displayName },
          })
      },
    })
  })
}
