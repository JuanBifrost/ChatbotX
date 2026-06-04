import { messengerTemplateStatusSchema } from "@chatbotx.io/database/partials"
import { zodBigintAsString } from "@chatbotx.io/utils"
import z from "zod"
import { integrationMessengerResource } from "../../schema/resource"
import { messengerMessageTemplateResource } from "./resource"

export const listMessengerMessageTemplatesRequest = z.object({
  workspaceId: zodBigintAsString(),
  inboxId: zodBigintAsString().optional(),
  integrationMessengerId: zodBigintAsString().optional(),
  status: messengerTemplateStatusSchema.optional(),
})
export type ListMessengerMessageTemplatesRequest = z.infer<
  typeof listMessengerMessageTemplatesRequest
>

export const listMessengerMessageTemplatesResponse = z.array(
  messengerMessageTemplateResource.extend({
    integrationMessenger: integrationMessengerResource,
  }),
)
export type ListMessengerMessageTemplatesResponse = z.infer<
  typeof listMessengerMessageTemplatesResponse
>
