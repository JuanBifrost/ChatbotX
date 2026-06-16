import { aiContextStore } from "@chatbotx.io/ai/server"
import { conversationService } from "@chatbotx.io/business"
import { isMessageStorageError } from "@chatbotx.io/database/errors"
import {
  createMessageRepository,
  getSafeSinceTime,
} from "@chatbotx.io/database/repositories"
import type { AIDeleteMessageHistorySchema } from "@chatbotx.io/flow-config"
import { normalizeError } from "universal-error-normalizer"
import { logger } from "../../../lib/logger"
import type { ExecuteStepProps } from "../flow"
import type { ExecuteStepResult } from "../step"

export async function handleAIDeleteMessageHistory({
  conversation,
  contactInbox,
}: ExecuteStepProps<AIDeleteMessageHistorySchema>): Promise<ExecuteStepResult> {
  try {
    const repo = await createMessageRepository()
    await aiContextStore.runExclusive(conversation.id, async () => {
      const narrowSinceTime =
        getSafeSinceTime(contactInbox.lastMessageAt) ?? new Date(0)
      let lastMessages = await repo.findLastByConversation(conversation.id, {
        limit: 1,
        requireCompleteResults: true,
        sinceTime: narrowSinceTime,
        workspaceId: conversation.workspaceId,
      })

      if (lastMessages.length === 0 && contactInbox.lastMessageAt !== null) {
        lastMessages = await repo.findLastByConversation(conversation.id, {
          limit: 1,
          requireCompleteResults: true,
          sinceTime: new Date(0),
          workspaceId: conversation.workspaceId,
        })
      }

      const lastMessage = lastMessages[0] ?? null

      await aiContextStore.delete(conversation.id)
      await conversationService.updateAIContextLastMessageId({
        workspaceId: conversation.workspaceId,
        conversationId: conversation.id,
        messageId: lastMessage?.id ?? null,
      })
    })

    return { status: "success", result: null }
  } catch (err) {
    const error = normalizeError(err)
    logger.error(
      {
        err: error,
        workspaceId: conversation.workspaceId,
        conversationId: conversation.id,
        action: "aiDeleteMessageHistory",
      },
      "[ai-delete-message-history] Step failed",
    )
    if (isMessageStorageError(err)) {
      throw err
    }
    return { status: "error", errorMessage: error.message, result: null }
  }
}
