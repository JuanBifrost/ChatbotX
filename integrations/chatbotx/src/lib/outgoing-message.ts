import type { Context, OutgoingMessage } from "@chatbotx.io/sdk"
import type { ChatbotxAuthValue } from "../auth"
import { getRealtimeClient } from "./client"

export const broadcastMessageToWorkspaceParty = (
  ctx: Context<ChatbotxAuthValue>,
  message: OutgoingMessage,
) => {
  const websocketClient = getRealtimeClient(ctx)
  websocketClient
    .post(`/parties/workspaces/${message.workspaceId}`, {
      json: {
        eventType: "messageCreated",
        data: message,
      },
    })
    .catch(() => {
      // Ignore errors
    })
}
