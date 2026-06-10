"use server"

import { buildContext } from "@chatbotx.io/business"
import { db, eq, findOrFail, inArray } from "@chatbotx.io/database/client"
import {
  integrationMessengerModel,
  messengerMessageTemplateModel,
} from "@chatbotx.io/database/schema"
import type { IntegrationMessengerModel } from "@chatbotx.io/database/types"
import type { MessengerAuthValue } from "@chatbotx.io/integration-messenger/schema"
import { invalidateCacheByTags } from "@chatbotx.io/redis"
import { SdkException } from "@chatbotx.io/sdk"
import { createId, zodBigintAsString } from "@chatbotx.io/utils"
import { integrations } from "@/integration"
import { workspaceActionClient } from "@/lib/safe-action"

export async function syncMessengerMessageTemplatesForIntegration({
  workspaceId,
  integrationMessenger,
  templateId,
  templateName,
  templateLanguage,
}: {
  workspaceId: string
  integrationMessenger: IntegrationMessengerModel
  templateId?: string
  templateName?: string
  templateLanguage?: string
}) {
  const isPartialSync = Boolean(templateId || templateName || templateLanguage)
  const ctx = await buildContext({
    workspaceId,
    integrationType: "messenger",
    integration: {
      ...integrationMessenger,
      auth: integrationMessenger.auth as MessengerAuthValue,
    },
  })
  let res: Awaited<
    ReturnType<typeof integrations.messenger.runAction<"listMessageTemplates">>
  >
  try {
    res = await integrations.messenger.runAction("listMessageTemplates", {
      ctx,
      input: templateName ? { name: templateName } : undefined,
    })
  } catch (error) {
    throw new SdkException(
      `Failed to fetch Messenger templates from Facebook API: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const templates = res.data.filter((template) => {
    if (templateId && template.id !== templateId) {
      return false
    }

    if (templateName && template.name !== templateName) {
      return false
    }

    if (templateLanguage && template.language !== templateLanguage) {
      return false
    }

    return true
  })

  await db.transaction(async (tx) => {
    if (!isPartialSync) {
      const existingTemplates = await tx
        .select({
          id: messengerMessageTemplateModel.id,
          sourceId: messengerMessageTemplateModel.sourceId,
        })
        .from(messengerMessageTemplateModel)
        .where(
          eq(
            messengerMessageTemplateModel.integrationMessengerId,
            integrationMessenger.id,
          ),
        )

      const incomingSourceIds = new Set(templates.map((t) => t.id))

      const templatesToDelete = existingTemplates.filter(
        (t) => !incomingSourceIds.has(t.sourceId),
      )

      if (templatesToDelete.length > 0) {
        await tx.delete(messengerMessageTemplateModel).where(
          inArray(
            messengerMessageTemplateModel.id,
            templatesToDelete.map((t) => t.id),
          ),
        )
      }
    }

    for (const template of templates) {
      await tx
        .insert(messengerMessageTemplateModel)
        .values([
          {
            id: createId(),
            name: template.name,
            integrationMessengerId: integrationMessenger.id,
            language: template.language,
            category: template.category,
            status: template.status,
            parameterFormat: template.parameter_format ?? "POSITIONAL",
            sourceId: template.id,
            components: template.components,
          },
        ])
        .onConflictDoUpdate({
          target: [
            messengerMessageTemplateModel.integrationMessengerId,
            messengerMessageTemplateModel.sourceId,
          ],
          set: {
            name: template.name,
            language: template.language,
            category: template.category,
            status: template.status,
            parameterFormat: template.parameter_format ?? "POSITIONAL",
            components: template.components,
          },
        })
    }
  })
}

export const syncMessengerMessageTemplateAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, id],
    } = props

    const integrationMessenger = await findOrFail({
      table: integrationMessengerModel,
      where: {
        workspaceId,
        id,
      },
      message: "Messenger integration not found",
    })

    await syncMessengerMessageTemplatesForIntegration({
      workspaceId,
      integrationMessenger,
    })

    await invalidateCacheByTags([
      `workspaces:${workspaceId}#messenger#messageTemplates`,
    ])
  })
