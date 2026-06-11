import { buildContext } from "@chatbotx.io/business"
import {
  mailchimpAudienceSchema,
  integration as mailchimpIntegration,
  mailchimpMergeFieldSchema,
  mailchimpTagSchema,
} from "@chatbotx.io/integration-mailchimp"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { z } from "zod"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { getMailchimpAuth } from "../queries"

const workspaceInput = z.object({ workspaceId: zodBigintAsString() })
const listInput = workspaceInput.extend({ listId: z.string().min(1) })

export const integrationMailchimpAPI = {
  listAudiences: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/mailchimp/audiences",
      summary: "List Mailchimp audiences",
      tags: ["Mailchimp"],
    })
    .input(workspaceInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(mailchimpAudienceSchema) }))
    .handler(async ({ input }) => {
      const { auth, row } = await getMailchimpAuth(input.workspaceId)
      const ctx = await buildContext({
        workspaceId: input.workspaceId,
        integrationType: "mailchimp",
        integration: { ...row, auth },
      })
      return {
        data: await mailchimpIntegration.runAction("listAudiences", {
          ctx,
          props: {},
        }),
      }
    }),
  listTags: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/mailchimp/tags",
      summary: "List Mailchimp tags",
      tags: ["Mailchimp"],
    })
    .input(listInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(mailchimpTagSchema) }))
    .handler(async ({ input }) => {
      const { auth, row } = await getMailchimpAuth(input.workspaceId)
      const ctx = await buildContext({
        workspaceId: input.workspaceId,
        integrationType: "mailchimp",
        integration: { ...row, auth },
      })
      return {
        data: await mailchimpIntegration.runAction("listTags", {
          ctx,
          props: { listId: input.listId },
        }),
      }
    }),
  listMergeFields: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/mailchimp/merge-fields",
      summary: "List Mailchimp merge fields",
      tags: ["Mailchimp"],
    })
    .input(listInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ data: z.array(mailchimpMergeFieldSchema) }))
    .handler(async ({ input }) => {
      const { auth, row } = await getMailchimpAuth(input.workspaceId)
      const ctx = await buildContext({
        workspaceId: input.workspaceId,
        integrationType: "mailchimp",
        integration: { ...row, auth },
      })
      return {
        data: await mailchimpIntegration.runAction("listMergeFields", {
          ctx,
          props: { listId: input.listId },
        }),
      }
    }),
}
