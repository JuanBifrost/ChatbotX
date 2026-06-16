import { buildContext } from "@chatbotx.io/business"
import {
  GetResponseApiError,
  getResponseCampaignPageSchema,
  integration as getResponseIntegration,
  getResponseTagPageSchema,
} from "@chatbotx.io/integration-get-response"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { getGetResponseAuth } from "../queries"

const workspaceInput = z.object({ workspaceId: zodBigintAsString() })
const paginatedCampaignsInput = workspaceInput.extend({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(100),
})
const paginatedTagsInput = workspaceInput.extend({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(1000).default(1000),
})

const throwOnRateLimit = (error: unknown): never => {
  if (error instanceof GetResponseApiError && error.statusCode === 429) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      status: 429,
      message: error.message,
    })
  }
  throw error
}

const getGetResponseContext = async (workspaceId: string) => {
  const { auth, row } = await getGetResponseAuth(workspaceId)
  return buildContext({
    workspaceId,
    integrationType: "getResponse",
    integration: { ...row, auth },
  })
}

export const integrationGetResponseAPI = {
  listCampaigns: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/get-response/campaigns",
      summary: "List GetResponse campaigns",
      tags: ["GetResponse"],
    })
    .input(paginatedCampaignsInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(getResponseCampaignPageSchema)
    .handler(async ({ input }) => {
      const ctx = await getGetResponseContext(input.workspaceId)
      return getResponseIntegration
        .runAction("listCampaigns", {
          ctx,
          props: { page: input.page, perPage: input.perPage },
        })
        .catch(throwOnRateLimit)
    }),

  listTags: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/get-response/tags",
      summary: "List GetResponse tags",
      tags: ["GetResponse"],
    })
    .input(paginatedTagsInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(getResponseTagPageSchema)
    .handler(async ({ input }) => {
      const ctx = await getGetResponseContext(input.workspaceId)
      return getResponseIntegration
        .runAction("listTags", {
          ctx,
          props: { page: input.page, perPage: input.perPage },
        })
        .catch(throwOnRateLimit)
    }),
}
