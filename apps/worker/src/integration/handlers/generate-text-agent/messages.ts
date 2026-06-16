import {
  AI_MESSAGE_HISTORY_LOOKBACK_MS,
  MAX_CONVERSATION_HISTORY,
} from "@chatbotx.io/ai"
import { aiMessageRoles } from "@chatbotx.io/database/partials"
import {
  createMessageRepository,
  findConversationAIContextState,
  getSafeSinceTime,
} from "@chatbotx.io/database/repositories"
import type {
  ContactInboxModel,
  ConversationModel,
} from "@chatbotx.io/database/types"
import type { AIGenerateTextAgentSchema } from "@chatbotx.io/flow-config"
import type { ModelMessage } from "ai"

export async function buildAIAgentMessages(
  conversation: ConversationModel,
  contactInbox: ContactInboxModel,
  step: AIGenerateTextAgentSchema,
): Promise<ModelMessage[]> {
  const messages: ModelMessage[] = []

  if (step.rememberConversation) {
    const contextState = await findConversationAIContextState({
      conversationId: conversation.id,
      workspaceId: conversation.workspaceId,
    })
    const repo = await createMessageRepository()
    const lastMessages = await repo.findAIContextMessages({
      conversationId: conversation.id,
      limit: MAX_CONVERSATION_HISTORY,
      markerMessageId: contextState?.aiContextLastMessageId ?? null,
      messageTypes: ["incoming", "outgoing"],
      sinceTime:
        getSafeSinceTime(
          contactInbox.lastMessageAt ?? conversation.lastActivityAt,
          AI_MESSAGE_HISTORY_LOOKBACK_MS,
        ) ?? new Date(0),
      textNotNull: true,
      workspaceId: conversation.workspaceId,
    })

    for (const message of lastMessages) {
      if (
        !message.text ||
        (message.messageType !== "incoming" &&
          message.messageType !== "outgoing")
      ) {
        continue
      }

      if (message.senderType === "contact") {
        messages.push({
          role: aiMessageRoles.enum.user,
          content: message.text,
        })
      } else {
        messages.push({
          role: aiMessageRoles.enum.assistant,
          content: message.text,
        })
      }
    }
  }

  if (step.message) {
    messages.push({
      role: aiMessageRoles.enum.user,
      content: step.message,
    })
  }

  return messages
}
