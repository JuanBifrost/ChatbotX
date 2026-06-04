import { and, db, eq, isNull } from "@chatbotx.io/database/client"
import { contactModel } from "@chatbotx.io/database/schema"
import type { IntegrationJobUpdateContactAvatar } from "@chatbotx.io/worker-config"
import { logger } from "../../../lib/logger"
import {
  allIntegrations,
  resolveIntegrationContextFromContactInbox,
} from "../../../services/integrations"

/**
 * Mirror a contact's channel avatar URL to our object storage and persist the
 * resulting storage path on the Contact row.
 *
 * Dispatched per-contact after Coexist historical sync creates contacts from
 * `/me/conversations` participants (which carry only `id` + `name`, no
 * `profile_pic`). Idempotent: skips when avatar already set so a re-run never
 * overwrites a live-set or previously-mirrored avatar.
 */
export const updateContactAvatar = async (
  data: IntegrationJobUpdateContactAvatar["data"],
): Promise<void> => {
  const { workspaceId, contactInboxId, sourceId } = data

  const contactInbox = await db.query.contactInboxModel.findFirst({
    where: { id: contactInboxId },
  })
  if (!contactInbox) {
    logger.warn({ contactInboxId }, "[update-avatar] ContactInbox not found")
    return
  }

  const contact = await db.query.contactModel.findFirst({
    where: { id: contactInbox.contactId },
    columns: { id: true, avatar: true },
  })
  if (!contact) {
    logger.warn(
      { contactId: contactInbox.contactId },
      "[update-avatar] Contact not found",
    )
    return
  }
  if (contact.avatar) {
    return
  }

  const integration = allIntegrations[contactInbox.channel]
  if (!integration) {
    return
  }

  let avatar: string | undefined
  try {
    const { ctx } = await resolveIntegrationContextFromContactInbox({
      workspaceId,
      contactInbox,
    })
    const profile = await integration.runChannelHandler(
      "contact",
      "getProfile",
      { ctx, data: { sourceId } },
    )
    avatar = profile?.avatar
  } catch (error) {
    logger.warn(
      { error, contactInboxId, sourceId, channel: contactInbox.channel },
      "[update-avatar] getProfile failed",
    )
    return
  }

  if (!avatar) {
    return
  }

  await db
    .update(contactModel)
    .set({ avatar, updatedAt: new Date() })
    .where(and(eq(contactModel.id, contact.id), isNull(contactModel.avatar)))
}
