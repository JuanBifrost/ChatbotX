import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createMessageRepository: vi.fn(),
  findAIContextMessages: vi.fn(),
  findConversationAIContextState: vi.fn(),
  getSafeSinceTime: vi.fn(),
}))

vi.mock("@chatbotx.io/database/repositories", () => ({
  createMessageRepository: mocks.createMessageRepository,
  findConversationAIContextState: mocks.findConversationAIContextState,
  getSafeSinceTime: mocks.getSafeSinceTime,
}))

const { buildAIAgentMessages } = await import(
  "../src/integration/handlers/generate-text-agent/messages"
)
const { buildAIMessages } = await import(
  "../src/integration/handlers/generate-text/messages"
)

const conversation = {
  aiContextLastMessageId: "stale-marker",
  id: "conv-1",
  lastActivityAt: new Date("2026-06-15T01:00:00.000Z"),
  workspaceId: "ws-1",
} as never
const contactInbox = {
  lastMessageAt: new Date("2026-06-15T01:00:00.000Z"),
} as never
const sinceTime = new Date("2025-06-15T01:00:00.000Z")

describe("AI message history builders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createMessageRepository.mockResolvedValue({
      findAIContextMessages: mocks.findAIContextMessages,
    })
    mocks.findConversationAIContextState.mockResolvedValue({
      aiContextLastMessageId: "marker-1",
    })
    mocks.findAIContextMessages.mockResolvedValue([
      {
        id: "2",
        messageType: "incoming",
        senderType: "contact",
        text: "new user message",
      },
      {
        id: "3",
        messageType: "outgoing",
        senderType: "bot",
        text: "new bot message",
      },
    ])
    mocks.getSafeSinceTime.mockReturnValue(sinceTime)
  })

  test.each([
    {
      build: () =>
        buildAIAgentMessages(conversation, contactInbox, {
          message: "instruction",
          rememberConversation: true,
        } as never),
      expectedTail: "instruction",
    },
    {
      build: () =>
        buildAIMessages(conversation, contactInbox, {
          remember: true,
          text: "instruction",
        } as never),
      expectedTail: "instruction",
    },
  ])("uses the authoritative delete marker when loading remembered history", async ({
    build,
    expectedTail,
  }) => {
    const result = await build()

    expect(mocks.findAIContextMessages).toHaveBeenCalledWith({
      conversationId: "conv-1",
      limit: expect.any(Number),
      markerMessageId: "marker-1",
      messageTypes: ["incoming", "outgoing"],
      sinceTime,
      textNotNull: true,
      workspaceId: "ws-1",
    })
    expect(mocks.findConversationAIContextState).toHaveBeenCalledWith({
      conversationId: "conv-1",
      workspaceId: "ws-1",
    })
    expect(result).toEqual([
      { role: "user", content: "new user message" },
      { role: "assistant", content: "new bot message" },
      { role: "user", content: expectedTail },
    ])
  })
})
