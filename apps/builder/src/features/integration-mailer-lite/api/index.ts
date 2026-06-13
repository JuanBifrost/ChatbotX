import { buildContext } from "@chatbotx.io/business"
import {
  MAILER_LITE_EDITOR_PAGE_SIZE,
  MailerLiteApiError,
  mailerLiteFieldPageSchema,
  mailerLiteGroupPageSchema,
  integration as mailerLiteIntegration,
} from "@chatbotx.io/integration-mailer-lite"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { getMailerLiteAuth } from "../queries"

const pageInput = z.object({
  workspaceId: zodBigintAsString(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAILER_LITE_EDITOR_PAGE_SIZE)
    .default(MAILER_LITE_EDITOR_PAGE_SIZE),
})

const buildMailerLiteContext = async (input: z.infer<typeof pageInput>) => {
  const { auth, row } = await getMailerLiteAuth(input.workspaceId)
  return await buildContext({
    workspaceId: input.workspaceId,
    integrationType: "mailerLite",
    integration: { ...row, auth },
  })
}

const mapMailerLiteError = (error: unknown): never => {
  if (error instanceof MailerLiteApiError && error.statusCode === 429) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      status: 429,
      message: "MailerLite rate limit exceeded",
    })
  }
  throw error
}

export const integrationMailerLiteAPI = {
  listGroups: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/mailer-lite/groups",
      summary: "List MailerLite groups",
      tags: ["MailerLite"],
    })
    .input(pageInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(mailerLiteGroupPageSchema)
    .handler(async ({ input }) => {
      const ctx = await buildMailerLiteContext(input)
      try {
        return await mailerLiteIntegration.runAction("listGroups", {
          ctx,
          props: { page: input.page, limit: input.limit },
        })
      } catch (error) {
        return mapMailerLiteError(error)
      }
    }),
  listFields: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/mailer-lite/fields",
      summary: "List MailerLite fields",
      tags: ["MailerLite"],
    })
    .input(pageInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(mailerLiteFieldPageSchema)
    .handler(async ({ input }) => {
      const ctx = await buildMailerLiteContext(input)
      try {
        return await mailerLiteIntegration.runAction("listFields", {
          ctx,
          props: { page: input.page, limit: input.limit },
        })
      } catch (error) {
        return mapMailerLiteError(error)
      }
    }),
}
