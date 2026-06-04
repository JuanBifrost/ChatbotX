"use server"

import { db, inArray } from "@chatbotx.io/database/client"
import {
  integrationMessengerModel,
  messengerMessageTemplateModel,
} from "@chatbotx.io/database/schema"
import { createPageMessageTemplate } from "@chatbotx.io/integration-messenger/apis/message-templates"
import { resumableUploadImage } from "@chatbotx.io/integration-messenger/apis/upload"
import type { MessengerAuthValue } from "@chatbotx.io/integration-messenger/schema"
import { invalidateCacheByTags } from "@chatbotx.io/redis"
import { SdkException } from "@chatbotx.io/sdk"
import { createId, zodBigintAsString } from "@chatbotx.io/utils"
import { chunk } from "remeda"
import { z } from "zod"
import { getAllWorkspaceMembers } from "@/features/workspace-members/queries"
import { workspaceActionClient } from "@/lib/safe-action"

// IMAGE header handles are page-scoped — re-upload each one to the target page
// to get a fresh handle. Other components pass through unchanged.
// PHP ref: UtilityMessageTemplateService::copyMessageTemplates + reuploadHeaderImage
async function prepareComponentsForClone(
  // biome-ignore lint/suspicious/noExplicitAny: Meta API component shape varies
  components: any[],
  auth: MessengerAuthValue,
  // biome-ignore lint/suspicious/noExplicitAny: Meta API component shape varies
): Promise<any[]> {
  return await Promise.all(
    // biome-ignore lint/suspicious/noExplicitAny: Meta API component shape varies
    components.map(async (c: any) => {
      if (
        c.type?.toUpperCase() !== "HEADER" ||
        c.format?.toUpperCase() !== "IMAGE"
      ) {
        return c
      }
      const existingHandle: string | undefined = c.example?.header_handle?.[0]
      if (!existingHandle) {
        return c
      }
      const newHandle = await resumableUploadImage(auth, existingHandle)
      return {
        ...c,
        example: {
          ...c.example,
          header_handle: [newHandle],
        },
      }
    }),
  )
}

export const cloneMessengerMessageTemplateAction = workspaceActionClient
  .bindArgsSchemas([
    zodBigintAsString(),
    zodBigintAsString(),
    zodBigintAsString(),
  ])
  .schema(
    z.object({
      targetIntegrationMessengerIds: z.array(zodBigintAsString()).min(1),
    }),
  )
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [
        workspaceId,
        sourceIntegrationMessengerId,
        templateId,
      ],
      parsedInput: { targetIntegrationMessengerIds },
      ctx: { user },
    } = props

    // Load source template, verifying it belongs to the source integration + workspace
    const sourceTemplate =
      await db.query.messengerMessageTemplateModel.findFirst({
        where: {
          id: templateId,
          integrationMessengerId: sourceIntegrationMessengerId,
          integrationMessenger: {
            workspaceId,
          },
        },
      })

    if (!sourceTemplate) {
      throw new Error("Source template not found")
    }

    // Source integration (for its pageId — never clone a template onto its own page).
    const sourceIntegration =
      await db.query.integrationMessengerModel.findFirst({
        where: { id: sourceIntegrationMessengerId, workspaceId },
        columns: { pageId: true },
      })

    // Resolve target rows by id (targets may live in OTHER workspaces).
    const candidateTargets = await db
      .select()
      .from(integrationMessengerModel)
      .where(
        inArray(integrationMessengerModel.id, targetIntegrationMessengerIds),
      )

    // Authorize per target: the user must be an owner of the target's workspace,
    // and the target must not be the source's own Facebook Page.
    const { workspaceMembers } = await getAllWorkspaceMembers(user.id)
    const ownerWorkspaceIds = new Set(
      workspaceMembers
        .filter((member) => member.role === "owner")
        .map((member) => member.workspaceId),
    )
    const targets = candidateTargets.filter(
      (target) =>
        ownerWorkspaceIds.has(target.workspaceId) &&
        target.pageId !== sourceIntegration?.pageId,
    )

    if (targets.length === 0) {
      throw new Error("No authorized target channels found")
    }

    const succeeded: { channel: string }[] = []
    const failed: { channel: string; error: string }[] = []

    const BATCH_SIZE = 5

    const cloneOne = async (
      target: (typeof targets)[number],
    ): Promise<void> => {
      const auth = target.auth as MessengerAuthValue
      try {
        // Re-upload IMAGE headers to the target page before creating the template.
        const components = await prepareComponentsForClone(
          // biome-ignore lint/suspicious/noExplicitAny: Meta API component shape varies
          sourceTemplate.components as any[],
          auth,
        )

        const resp = await createPageMessageTemplate(auth, {
          name: sourceTemplate.name,
          category: sourceTemplate.category as
            | "AUTHENTICATION"
            | "MARKETING"
            | "UTILITY",
          language: sourceTemplate.language,
          parameter_format: sourceTemplate.parameterFormat,
          components,
        })

        if (resp.status === "APPROVED") {
          await db
            .insert(messengerMessageTemplateModel)
            .values({
              id: createId(),
              sourceId: resp.id,
              status: resp.status,
              name: sourceTemplate.name,
              language: sourceTemplate.language,
              category: sourceTemplate.category,
              parameterFormat: sourceTemplate.parameterFormat,
              components: sourceTemplate.components,
              integrationMessengerId: target.id,
            })
            .onConflictDoUpdate({
              target: [
                messengerMessageTemplateModel.integrationMessengerId,
                messengerMessageTemplateModel.sourceId,
              ],
              set: {
                sourceId: resp.id,
                status: resp.status,
                name: sourceTemplate.name,
                language: sourceTemplate.language,
                category: sourceTemplate.category,
                parameterFormat: sourceTemplate.parameterFormat,
                components: sourceTemplate.components,
              },
            })
          succeeded.push({ channel: target.name })
        } else {
          failed.push({
            channel: target.name,
            error: `Template returned status: ${resp.status}`,
          })
        }
      } catch (error) {
        const message =
          error instanceof SdkException || error instanceof Error
            ? error.message
            : "Unknown error occurred"
        failed.push({ channel: target.name, error: message })
      }
    }

    const batches = chunk(targets, BATCH_SIZE)
    for (const batch of batches) {
      await Promise.allSettled(batch.map(cloneOne))
    }

    // Revalidate every workspace that received a clone, plus the source.
    const affectedWorkspaceIds = new Set(
      targets.map((target) => target.workspaceId),
    )
    affectedWorkspaceIds.add(workspaceId)
    for (const affectedWorkspaceId of affectedWorkspaceIds) {
      await invalidateCacheByTags([
        `workspaces:${affectedWorkspaceId}#messenger#messageTemplates`,
      ])
    }

    return { succeeded, failed }
  })
