import {
  ActiveCampaignApiError,
  activeCampaignAutomationSchema,
  activeCampaignCustomFieldSchema,
  integration as activeCampaignIntegration,
  activeCampaignListSchema,
  activeCampaignTagSchema,
} from "@chatbotx.io/integration-active-campaign"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { getActiveCampaignContext } from "../queries"

const workspaceInput = z.object({ workspaceId: zodBigintAsString() })

const throwOnRateLimit = (error: unknown): never => {
  if (error instanceof ActiveCampaignApiError && error.statusCode === 429) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      status: 429,
      message: error.message,
    })
  }
  throw error
}

export const integrationActiveCampaignAPI = {
  listLists: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/active-campaign/lists",
      summary: "List ActiveCampaign lists",
      tags: ["ActiveCampaign"],
    })
    .input(workspaceInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(activeCampaignListSchema) }))
    .handler(async ({ input }) => {
      const ctx = await getActiveCampaignContext(input.workspaceId)
      return {
        data: await activeCampaignIntegration
          .runAction("listLists", { ctx, props: {} })
          .catch(throwOnRateLimit),
      }
    }),

  listAutomations: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/active-campaign/automations",
      summary: "List ActiveCampaign automations",
      tags: ["ActiveCampaign"],
    })
    .input(workspaceInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(activeCampaignAutomationSchema) }))
    .handler(async ({ input }) => {
      const ctx = await getActiveCampaignContext(input.workspaceId)
      return {
        data: await activeCampaignIntegration
          .runAction("listAutomations", { ctx, props: {} })
          .catch(throwOnRateLimit),
      }
    }),

  listTags: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/active-campaign/tags",
      summary: "List ActiveCampaign tags",
      tags: ["ActiveCampaign"],
    })
    .input(workspaceInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(activeCampaignTagSchema) }))
    .handler(async ({ input }) => {
      const ctx = await getActiveCampaignContext(input.workspaceId)
      return {
        data: await activeCampaignIntegration
          .runAction("listTags", { ctx, props: {} })
          .catch(throwOnRateLimit),
      }
    }),

  listCustomFields: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/active-campaign/custom-fields",
      summary: "List ActiveCampaign custom fields",
      tags: ["ActiveCampaign"],
    })
    .input(workspaceInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(activeCampaignCustomFieldSchema) }))
    .handler(async ({ input }) => {
      const ctx = await getActiveCampaignContext(input.workspaceId)
      return {
        data: await activeCampaignIntegration
          .runAction("listCustomFields", { ctx, props: {} })
          .catch(throwOnRateLimit),
      }
    }),
}
