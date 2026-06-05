import {
  connectChannelIntegration,
  workspaceService,
} from "@chatbotx.io/business"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { db } from "@chatbotx.io/database/client"
import type { ZaloCredential } from "@chatbotx.io/database/partials"
import { integrationZaloModel } from "@chatbotx.io/database/schema"
import type { ZaloAuthValue } from "@chatbotx.io/integration-zalo"
import { redirect } from "next/navigation"
import { integrations } from "@/integration"

export async function connectZaloHandler({
  zaloSettings,
  workspaceId,
  req,
}: {
  zaloSettings: ZaloCredential
  workspaceId: string
  req: Request
}) {
  const authValue = (await integrations.zalo.handleRequest({
    config: {
      ...zaloSettings,
      redirectUrl: new URL("/integrations/zalo/callback", req.url).toString(),
      stateParams: { workspaceId },
    },
    req,
  })) as ZaloAuthValue

  const { ownerId } = await workspaceService.findById({ id: workspaceId })

  try {
    await db.transaction(async (tx) => {
      await connectChannelIntegration({
        tx,
        ownerId,
        inboxData: {
          workspaceId,
          name: authValue.metadata.oaName,
          channel: "zalo",
          sourceId: authValue.oaId,
        },
        insertIntegration: async (inboxId, wasCreated) => {
          if (!wasCreated) {
            redirect(
              `/space/${workspaceId}/settings/channels?channel=zalo&error=duplicated`,
            )
          }
          await tx.insert(integrationZaloModel).values({
            inboxId,
            workspaceId,
            oaId: authValue.oaId,
            auth: authValue,
            name: authValue.metadata.oaName,
          })
        },
      })
    })
  } catch (error) {
    if (
      error instanceof ChatbotXException &&
      error.code === "channelDuplicated"
    ) {
      redirect(
        `/space/${workspaceId}/settings/channels?channel=zalo&error=duplicated`,
      )
    }
    throw error
  }
}
