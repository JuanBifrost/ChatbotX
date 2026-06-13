import {
  DripApiError,
  dripAccountSchema,
  dripCustomFieldSchema,
  integration as dripIntegration,
} from "@chatbotx.io/integration-drip"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { getDripContext } from "../queries"

const workspaceInput = z.object({ workspaceId: zodBigintAsString() })
const accountInput = workspaceInput.extend({ accountId: z.string().min(1) })

const throwOnRateLimit = (error: unknown): never => {
  if (error instanceof DripApiError && error.statusCode === 429) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      status: 429,
      message: error.message,
    })
  }
  throw error
}

export const integrationDripAPI = {
  listAccounts: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/drip/accounts",
      summary: "List Drip accounts",
      tags: ["Drip"],
    })
    .input(workspaceInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(dripAccountSchema) }))
    .handler(async ({ input }) => {
      const ctx = await getDripContext(input.workspaceId)
      return {
        data: await dripIntegration
          .runAction("listAccounts", { ctx, props: {} })
          .catch(throwOnRateLimit),
      }
    }),

  listTags: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/drip/tags",
      summary: "List Drip tags",
      tags: ["Drip"],
    })
    .input(accountInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(z.string()) }))
    .handler(async ({ input }) => {
      const ctx = await getDripContext(input.workspaceId)
      return {
        data: await dripIntegration
          .runAction("listTags", { ctx, props: { accountId: input.accountId } })
          .catch(throwOnRateLimit),
      }
    }),

  listCustomFields: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/drip/custom-fields",
      summary: "List Drip custom fields",
      tags: ["Drip"],
    })
    .input(accountInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(dripCustomFieldSchema) }))
    .handler(async ({ input }) => {
      const ctx = await getDripContext(input.workspaceId)
      return {
        data: await dripIntegration
          .runAction("listCustomFields", {
            ctx,
            props: { accountId: input.accountId },
          })
          .catch(throwOnRateLimit),
      }
    }),
}
