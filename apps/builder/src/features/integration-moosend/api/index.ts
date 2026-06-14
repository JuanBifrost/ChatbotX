import { buildContext } from "@chatbotx.io/business"
import {
  MOOSEND_EDITOR_PAGE_SIZE,
  MoosendApiError,
  integration as moosendIntegration,
  moosendMailingListPageSchema,
} from "@chatbotx.io/integration-moosend"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { getMoosendAuth } from "../queries"

const pageInput = z.object({
  workspaceId: zodBigintAsString(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MOOSEND_EDITOR_PAGE_SIZE)
    .default(MOOSEND_EDITOR_PAGE_SIZE),
})

const buildMoosendContext = async (workspaceId: string) => {
  const integration = await getMoosendAuth(workspaceId)
  if (!integration) {
    throw new ORPCError("FAILED_PRECONDITION", {
      message: "Moosend integration not connected",
    })
  }
  return await buildContext({
    workspaceId,
    integrationType: "moosend",
    integration: { ...integration.row, auth: integration.auth },
  })
}

const mapMoosendError = (error: unknown): never => {
  if (!(error instanceof MoosendApiError)) {
    throw error
  }
  if (error.kind === "rate_limited") {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      status: 429,
      message: "Moosend rate limit exceeded",
    })
  }
  if (
    error.kind === "invalid_credentials" ||
    error.kind === "user_not_enabled"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      status: 400,
      message: "Moosend integration is unavailable",
    })
  }
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    status: 502,
    message: "Moosend request failed",
  })
}

export const integrationMoosendAPI = {
  listMailingLists: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/moosend/mailing-lists",
      summary: "List Moosend mailing lists",
      tags: ["Moosend"],
    })
    .input(pageInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(moosendMailingListPageSchema)
    .handler(async ({ input }) => {
      const ctx = await buildMoosendContext(input.workspaceId)
      return moosendIntegration
        .runAction("listMailingLists", {
          ctx,
          props: { page: input.page, pageSize: input.pageSize },
        })
        .catch(mapMoosendError)
    }),
}
