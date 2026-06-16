import { describe, expect, test, vi } from "vitest"
import { findConversationAIContextState } from "../src/repositories/conversation-ai-context"

describe("findConversationAIContextState", () => {
  test("scopes the state read by conversation and workspace", async () => {
    const state = {
      aiContextLastMessageId: "10",
      lastActivityAt: new Date("2026-06-01T00:00:00Z"),
    }
    const findFirst = vi.fn().mockResolvedValue(state)

    await expect(
      findConversationAIContextState(
        { conversationId: "conv-1", workspaceId: "ws-1" },
        { query: { conversationModel: { findFirst } } } as never,
      ),
    ).resolves.toEqual(state)

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "conv-1", workspaceId: "ws-1" },
      columns: {
        aiContextLastMessageId: true,
        lastActivityAt: true,
      },
    })
  })

  test("returns null when the scoped conversation does not exist", async () => {
    const findFirst = vi.fn().mockResolvedValue(undefined)

    await expect(
      findConversationAIContextState(
        { conversationId: "conv-1", workspaceId: "other-ws" },
        { query: { conversationModel: { findFirst } } } as never,
      ),
    ).resolves.toBeNull()
  })
})
