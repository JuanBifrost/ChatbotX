import {
  SendGridApiError,
  sendGridCustomFieldSchema,
  integration as sendGridIntegration,
  sendGridListPageSchema,
} from "@chatbotx.io/integration-sendgrid"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { getSendGridContext } from "../queries"

const workspaceInput = z.object({ workspaceId: zodBigintAsString() })
const listInput = workspaceInput.extend({
  pageSize: z.coerce.number().int().min(1).max(1000).default(1000),
  pageToken: z.string().trim().min(1).optional(),
})

const throwOnRateLimit = (error: unknown): never => {
  if (error instanceof SendGridApiError && error.statusCode === 429) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      status: 429,
      message: error.message,
    })
  }
  throw error
}

export const integrationSendGridAPI = {
  listLists: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/sendgrid/lists",
      summary: "List SendGrid lists",
      tags: ["SendGrid"],
    })
    .input(listInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sendGridListPageSchema)
    .handler(async ({ input }) => {
      const ctx = await getSendGridContext(input.workspaceId)
      return sendGridIntegration
        .runAction("listLists", {
          ctx,
          props: { pageSize: input.pageSize, pageToken: input.pageToken },
        })
        .catch(throwOnRateLimit)
    }),
  listCustomFields: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/sendgrid/custom-fields",
      summary: "List SendGrid custom fields",
      tags: ["SendGrid"],
    })
    .input(workspaceInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(sendGridCustomFieldSchema) }))
    .handler(async ({ input }) => {
      const ctx = await getSendGridContext(input.workspaceId)
      return {
        data: await sendGridIntegration
          .runAction("listCustomFields", { ctx, props: {} })
          .catch(throwOnRateLimit),
      }
    }),
}
