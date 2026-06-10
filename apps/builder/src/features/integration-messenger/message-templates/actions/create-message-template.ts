"use server"

import { db } from "@chatbotx.io/database/client"
import { messengerMessageTemplateModel } from "@chatbotx.io/database/schema"
import { createPageMessageTemplate } from "@chatbotx.io/integration-messenger/apis/message-templates"
import { resumableUploadImage } from "@chatbotx.io/integration-messenger/apis/upload"
import type { MessengerAuthValue } from "@chatbotx.io/integration-messenger/schema"
import { invalidateCacheByTags } from "@chatbotx.io/redis"
import { createId, zodBigintAsString } from "@chatbotx.io/utils"
import { workspaceActionClient } from "@/lib/safe-action"
import { buildMessengerMessageTemplateComponents } from "../lib/build-template-components"
import { createMessengerMessageTemplateRequest } from "../schema/mutation"

export const createMessengerMessageTemplateAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .schema(createMessengerMessageTemplateRequest)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, integrationMessengerId],
      parsedInput,
    } = props

    const integrationMessenger =
      await db.query.integrationMessengerModel.findFirst({
        where: {
          id: integrationMessengerId,
          workspaceId,
        },
      })

    if (!integrationMessenger) {
      throw new Error("Messenger integration not found")
    }

    const auth = integrationMessenger.auth as MessengerAuthValue
    const headerHandle =
      parsedInput.headerType === "text_and_image" && parsedInput.headerImageUrl
        ? await resumableUploadImage(auth, parsedInput.headerImageUrl)
        : undefined
    const components = buildMessengerMessageTemplateComponents(
      parsedInput,
      headerHandle,
    )

    const resp = await createPageMessageTemplate(auth, {
      name: parsedInput.name,
      language: parsedInput.language,
      category: "UTILITY",
      components,
    })

    await db
      .insert(messengerMessageTemplateModel)
      .values({
        id: createId(),
        sourceId: resp.id,
        status: resp.status,
        name: parsedInput.name,
        language: parsedInput.language,
        category: "UTILITY",
        parameterFormat: resp.parameter_format ?? "POSITIONAL",
        components,
        integrationMessengerId: integrationMessenger.id,
      })
      .onConflictDoUpdate({
        target: [
          messengerMessageTemplateModel.integrationMessengerId,
          messengerMessageTemplateModel.sourceId,
        ],
        set: {
          sourceId: resp.id,
          status: resp.status,
          name: parsedInput.name,
          language: parsedInput.language,
          category: "UTILITY",
          parameterFormat: resp.parameter_format ?? "POSITIONAL",
          components,
        },
      })

    await invalidateCacheByTags([
      `workspaces:${workspaceId}#messenger#messageTemplates`,
    ])

    return { status: resp.status }
  })
