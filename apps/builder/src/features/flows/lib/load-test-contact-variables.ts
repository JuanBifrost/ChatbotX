import { contactInboxService, contactService } from "@chatbotx.io/business"
import type { ContactInboxModel } from "@chatbotx.io/database/types"
import {
  contactVariableService,
  type ReplaceVariableProps,
} from "@chatbotx.io/variables"
import { requireContactPermissionScope } from "@/features/contacts/permissions"

/**
 * Picks the inbox Test Now should interpolate against: prefer WhatsApp
 * (the usual {{WhatsApp ID}} / sourceId case), then the most recently
 * messaged inbox, then the first row.
 */
export const pickPreferredTestInbox = (
  inboxes: ContactInboxModel[],
): ContactInboxModel | null => {
  if (inboxes.length === 0) {
    return null
  }

  const byIncoming = [...inboxes].sort((left, right) => {
    const leftTime = left.lastIncomingMessageAt?.getTime() ?? 0
    const rightTime = right.lastIncomingMessageAt?.getTime() ?? 0
    return rightTime - leftTime
  })

  return (
    byIncoming.find((inbox) => inbox.channel === "whatsapp") ??
    byIncoming[0] ??
    null
  )
}

/**
 * Confirms the caller can read this workspace contact (same scope as the
 * contacts list). Throws if the contact is missing or out of scope.
 */
export const assertTestContactAccess = async (props: {
  workspaceId: string
  contactId: string
}) => {
  const accessScope = await requireContactPermissionScope(props.workspaceId)
  await contactService.findDetailOrFail({
    workspaceId: props.workspaceId,
    id: props.contactId,
    accessScope,
  })
}

/**
 * Loads a workspace-scoped contact's variable context for builder Test Now.
 * Reuses the same getAll path the worker uses at send time.
 */
export const loadTestContactVariables = async (props: {
  workspaceId: string
  contactId: string
}): Promise<ReplaceVariableProps> => {
  await assertTestContactAccess(props)

  const inboxes = await contactInboxService.listByContactId({
    workspaceId: props.workspaceId,
    contactId: props.contactId,
  })
  const contactInbox = pickPreferredTestInbox(inboxes)

  return await contactVariableService.getAll({
    contactId: props.contactId,
    contactInbox: contactInbox ?? "",
  })
}
