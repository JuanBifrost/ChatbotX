import { db } from "@chatbotx.io/database/client"
import type { MessengerTemplateParams } from "@chatbotx.io/flow-config"
import {
  contactVariableService,
  type ReplaceVariableProps,
} from "@chatbotx.io/variables"

export async function replaceMessengerTemplateVariables(props: {
  templateParams: MessengerTemplateParams
  variables: ReplaceVariableProps
  parameterFormat?: "POSITIONAL" | "NAMED"
}): Promise<MessengerTemplateParams> {
  const { variables, templateParams } = props
  const replacedParams = { ...templateParams }

  if (templateParams.header) {
    replacedParams.header = await Promise.all(
      templateParams.header.map(async (param) => {
        if (param.type === "text" && param.text) {
          return {
            ...param,
            text: await contactVariableService.replaceAll({
              variables,
              text: param.text,
            }),
          }
        }
        return param
      }),
    )
  }

  if (templateParams.body) {
    replacedParams.body = await Promise.all(
      templateParams.body.map(async (param) => ({
        ...param,
        text: await contactVariableService.replaceAll({
          text: param.text,
          variables,
        }),
      })),
    )
  }

  return replacedParams
}

export type ValidatedMessengerTemplate = {
  inbox: NonNullable<Awaited<ReturnType<typeof db.query.inboxModel.findFirst>>>
  template: NonNullable<
    Awaited<ReturnType<typeof db.query.messengerMessageTemplateModel.findFirst>>
  >
}

// Accepts templateId string — returns fetched entities so caller avoids re-querying.
// Returns null on any validation failure (inbox not found, no integration, template not approved).
export async function validateMessengerTemplate(
  templateId: string,
  inboxId: string,
): Promise<ValidatedMessengerTemplate | null> {
  const inbox = await db.query.inboxModel.findFirst({
    where: { id: inboxId },
    with: { integrationMessenger: true },
  })

  if (!inbox?.integrationMessenger) {
    return null
  }

  const template = await db.query.messengerMessageTemplateModel.findFirst({
    where: {
      id: templateId,
      integrationMessengerId: inbox.integrationMessenger.id,
      status: "APPROVED",
    },
  })

  if (!template) {
    return null
  }

  return { inbox, template }
}
