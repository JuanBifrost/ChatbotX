import { webhookService } from "@chatbotx.io/business"
import { createSelectSchema, webhookModel } from "@chatbotx.io/database/schema"
import z from "zod"
import { workspaceTokenAuthAPI } from "@/orpc"

const webhookResource = createSelectSchema(webhookModel, {
  id: z.string(),
  workspaceId: z.string(),
  folderId: z.string().nullable(),
})

const listWebhooksWorkspaceTokenAPI = workspaceTokenAuthAPI
  .route({
    method: "GET",
    path: "/v1/webhooks",
    summary: "List webhooks",
    tags: ["Webhooks"],
  })
  .output(z.object({ data: z.array(webhookResource) }))
  .handler(async ({ context }) => {
    const data = await webhookService.listByWorkspaceId(context.workspace.id)
    return { data }
  })

export const webhooksWorkspaceTokenAPIs = {
  listWebhooksWorkspaceTokenAPI,
}

export default webhooksWorkspaceTokenAPIs
