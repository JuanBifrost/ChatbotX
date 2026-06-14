import {
  KLAVIYO_LIST_PAGE_SIZE,
  KlaviyoApiError,
  integration as klaviyoIntegration,
  klaviyoListPageSchema,
} from "@chatbotx.io/integration-klaviyo"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { getKlaviyoContext } from "../queries"

const createPageInput = (maxSize: number) =>
  z.object({
    workspaceId: zodBigintAsString(),
    cursor: z.string().trim().min(1).optional(),
    size: z.coerce.number().int().positive().max(maxSize).default(maxSize),
  })

const listPageInput = createPageInput(KLAVIYO_LIST_PAGE_SIZE)

const mapKlaviyoError = (error: unknown): never => {
  if (error instanceof KlaviyoApiError && error.statusCode === 429) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      status: 429,
      message: "Klaviyo rate limit exceeded",
    })
  }
  throw error
}

export const integrationKlaviyoAPI = {
  listLists: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/klaviyo/lists",
      summary: "List Klaviyo lists",
      tags: ["Klaviyo"],
    })
    .input(listPageInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(klaviyoListPageSchema)
    .handler(async ({ input }) => {
      const ctx = await getKlaviyoContext(input.workspaceId)
      try {
        return await klaviyoIntegration.runAction("listLists", {
          ctx,
          props: { cursor: input.cursor, size: input.size },
        })
      } catch (error) {
        return mapKlaviyoError(error)
      }
    }),
}
