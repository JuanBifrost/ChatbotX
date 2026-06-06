import { createConversationSourceRepository } from "@chatbotx.io/database/repositories"
import type { AttachmentModel } from "@chatbotx.io/database/types"
import { IMAGE_MIME_TYPES } from "@chatbotx.io/sdk"
import type { ResolveConversationSourceInput } from "./types"

const SUPPORTED_IMAGE_MIME_TYPES = new Set<string>(IMAGE_MIME_TYPES)
const IMAGE_ATTACHMENT_LOOKUP_LIMIT = 50

const sourceRepo = createConversationSourceRepository()

function normalizeMimeType(value: string): string {
  return value.toLowerCase().split(";")[0]?.trim() ?? ""
}

export function isSupportedImageMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.has(normalizeMimeType(mimeType))
}

export async function resolveImageAttachment(
  input: ResolveConversationSourceInput,
): Promise<AttachmentModel | null> {
  const allAttachments = await sourceRepo.findAttachmentsByConversation({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    limit: IMAGE_ATTACHMENT_LOOKUP_LIMIT,
  })

  const attachments = allAttachments.filter((attachment) =>
    isSupportedImageMimeType(attachment.mimeType),
  )

  if (attachments.length === 0) {
    return null
  }

  const triggerMessageAttachment = input.messageId
    ? attachments.find((attachment) => attachment.messageId === input.messageId)
    : null

  return triggerMessageAttachment ?? attachments[0] ?? null
}
