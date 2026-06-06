import { and, db, eq, isNull } from "@chatbotx.io/database/client"
import { channelTypes } from "@chatbotx.io/database/partials"
import {
  contactsToTagsModel,
  contactToTagChannelModel,
  tagChannelModel,
  tagModel,
} from "@chatbotx.io/database/schema"
import type { IntegrationMessengerModel } from "@chatbotx.io/database/types"
import { messengerWebhookEventSchema } from "@chatbotx.io/integration-messenger/schema"
import { createId } from "@chatbotx.io/utils"
import { logger } from "../../lib/logger"

export interface MessengerLabelWebhookData {
  integrationIdentifier: string
  integrationType: "messenger"
  payload: unknown
}

export async function handleMessengerLabelWebhook(
  data: MessengerLabelWebhookData,
): Promise<void> {
  const { integrationIdentifier: pageId, payload } = data

  const parsed = messengerWebhookEventSchema.safeParse(payload)
  if (!parsed.success) {
    logger.warn({ pageId }, "messenger inbox_labels: invalid payload")
    return
  }

  const entry = parsed.data.entry[0]
  const labelChange = entry?.changes?.find(
    (change) => change.field === "inbox_labels",
  )
  if (!labelChange) {
    return
  }
  const { action: rawAction, user, label } = labelChange.value
  // Facebook sends short action names (add/remove/create/delete) on some API
  // versions and the *_label long forms on others. Normalize to long forms.
  const action = normalizeLabelAction(rawAction)

  const integration = await db.query.integrationMessengerModel.findFirst({
    where: { pageId },
  })
  if (!integration?.syncTagEnabledAt) {
    return
  }

  switch (action) {
    case "add_label": {
      if (!user) {
        return
      }
      const contactInbox = await db.query.contactInboxModel.findFirst({
        where: { inboxId: integration.inboxId, sourceId: user.id },
        columns: { id: true, contactId: true },
      })
      if (!contactInbox) {
        return
      }
      // Get-or-create the tag + channel mapping: the label may exist on
      // Facebook but not locally yet (created on the FB side, never synced).
      const mapping = await getOrCreateTagChannel({
        integration,
        externalLabelId: label.id,
        name: label.page_label_name,
      })
      if (!mapping) {
        return
      }
      await db
        .insert(contactsToTagsModel)
        .values({ contactId: contactInbox.contactId, tagId: mapping.tagId })
        .onConflictDoNothing()
      await db
        .insert(contactToTagChannelModel)
        .values({
          tagId: mapping.tagId,
          tagChannelId: mapping.tagChannelId,
          contactInboxId: contactInbox.id,
        })
        .onConflictDoNothing()
      return
    }

    case "remove_label": {
      if (!user) {
        return
      }
      const result = await resolveContactAndTagChannel({
        workspaceId: integration.workspaceId,
        inboxId: integration.inboxId,
        sourceId: user.id,
        integrationId: integration.id,
        externalLabelId: label.id,
      })
      if (!result) {
        return
      }
      await db
        .delete(contactToTagChannelModel)
        .where(
          and(
            eq(contactToTagChannelModel.tagChannelId, result.tagChannelId),
            eq(contactToTagChannelModel.contactInboxId, result.contactInboxId),
          ),
        )
      return
    }

    default:
      logger.warn({ action }, "messenger inbox_labels: unknown action")
  }
}

function normalizeLabelAction(action: string): string {
  switch (action) {
    case "add":
      return "add_label"
    case "remove":
      return "remove_label"
    default:
      return action
  }
}

/**
 * Resolve the local tag + channel mapping for an external label, creating it
 * when the label exists on Facebook but hasn't been synced locally yet. The
 * label name comes from the webhook payload (Facebook includes
 * `page_label_name` on add/remove events).
 */
async function getOrCreateTagChannel(props: {
  integration: IntegrationMessengerModel
  externalLabelId: string
  name?: string
}): Promise<{ tagId: string; tagChannelId: string } | undefined> {
  const { integration, externalLabelId, name } = props

  const existing = await db.query.tagChannelModel.findFirst({
    where: {
      workspaceId: integration.workspaceId,
      channelType: channelTypes.enum.messenger,
      integrationId: integration.id,
      externalLabelId,
    },
    columns: { id: true, tagId: true },
  })
  if (existing) {
    return { tagId: existing.tagId, tagChannelId: existing.id }
  }

  if (!name) {
    return
  }

  return upsertTagAndChannel({
    workspaceId: integration.workspaceId,
    integrationId: integration.id,
    externalLabelId,
    name,
  })
}

async function upsertTagAndChannel(props: {
  workspaceId: string
  integrationId: string
  externalLabelId: string
  name: string
}): Promise<{ tagId: string; tagChannelId: string } | undefined> {
  const { workspaceId, integrationId, externalLabelId, name } = props

  const existingTag = await db.query.tagModel.findFirst({
    where: { workspaceId, name, deletedAt: { isNull: true as const } },
    columns: { id: true },
  })
  let tagId = existingTag?.id
  if (!tagId) {
    const inserted = await db
      .insert(tagModel)
      .values({ id: createId(), name, workspaceId })
      .onConflictDoNothing({
        target: [tagModel.workspaceId, tagModel.name],
        where: isNull(tagModel.deletedAt),
      })
      .returning({ id: tagModel.id })
    tagId =
      inserted[0]?.id ??
      (
        await db.query.tagModel.findFirst({
          where: { workspaceId, name, deletedAt: { isNull: true as const } },
          columns: { id: true },
        })
      )?.id
  }
  if (!tagId) {
    return
  }

  const inserted = await db
    .insert(tagChannelModel)
    .values({
      id: createId(),
      workspaceId,
      tagId,
      channelType: channelTypes.enum.messenger,
      integrationId,
      externalLabelId,
    })
    .onConflictDoNothing({
      target: [
        tagChannelModel.tagId,
        tagChannelModel.channelType,
        tagChannelModel.integrationId,
      ],
    })
    .returning({ id: tagChannelModel.id })
  const tagChannelId =
    inserted[0]?.id ??
    (
      await db.query.tagChannelModel.findFirst({
        where: {
          tagId,
          workspaceId,
          channelType: channelTypes.enum.messenger,
          integrationId,
        },
        columns: { id: true },
      })
    )?.id
  if (!tagChannelId) {
    return
  }

  return { tagId, tagChannelId }
}

async function resolveContactAndTagChannel(props: {
  workspaceId: string
  inboxId: string
  sourceId: string
  integrationId: string
  externalLabelId: string
}): Promise<
  | {
      contactId: string
      contactInboxId: string
      tagId: string
      tagChannelId: string
    }
  | undefined
> {
  const { workspaceId, inboxId, sourceId, integrationId, externalLabelId } =
    props

  const contactInbox = await db.query.contactInboxModel.findFirst({
    where: { inboxId, sourceId },
    columns: { id: true, contactId: true },
  })
  if (!contactInbox) {
    return
  }

  const tagChannel = await db.query.tagChannelModel.findFirst({
    where: {
      workspaceId,
      channelType: channelTypes.enum.messenger,
      integrationId,
      externalLabelId,
    },
    columns: { id: true, tagId: true },
  })
  if (!tagChannel) {
    return
  }

  return {
    contactId: contactInbox.contactId,
    contactInboxId: contactInbox.id,
    tagId: tagChannel.tagId,
    tagChannelId: tagChannel.id,
  }
}
