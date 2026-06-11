import { beforeEach, describe, expect, test, vi } from "vitest"

const { mockFindConversationAuthenticatedAPI } = vi.hoisted(() => ({
  mockFindConversationAuthenticatedAPI: vi.fn(),
}))

vi.mock("@/lib/orpc/orpc", () => ({
  client: {
    conversationsAPI: {
      findConversationAuthenticatedAPI: mockFindConversationAuthenticatedAPI,
    },
  },
}))

const { createChatStore } = await import(
  "../src/features/chat/store/chat-store"
)

type TestConversation = {
  id: string
  workspaceId: string
  contactId: string
  messages: unknown[]
  lastActivityAt: Date
  agentLastReadAt?: Date
}

type TestMessage = {
  id: string
  workspaceId: string
  conversationId: string
  createdAt: Date
  messageType: string
}

const makeConversation = (id: string, lastActivityAt: Date) =>
  ({
    id,
    workspaceId: "ws-1",
    contactId: `contact-${id}`,
    messages: [],
    lastActivityAt,
  }) as TestConversation

const makeMessage = (conversationId: string, createdAt: Date) =>
  ({
    id: `msg-${conversationId}`,
    workspaceId: "ws-1",
    conversationId,
    createdAt,
    messageType: "incoming",
  }) as TestMessage

describe("chat store conversation updates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("updateConversationViaMessage moves an existing conversation to the top and refreshes lastActivityAt", async () => {
    const store = createChatStore()
    const oldFirst = makeConversation(
      "conv-1",
      new Date("2026-01-01T00:00:00Z"),
    )
    const target = makeConversation("conv-2", new Date("2026-01-01T01:00:00Z"))
    const originalList = [oldFirst, target]
    store.setState({ conversations: originalList as never })

    const message = makeMessage("conv-2", new Date("2026-01-02T00:00:00Z"))
    await store.getState().updateConversationViaMessage(message as never)

    const conversations = store.getState().conversations
    expect(conversations).not.toBe(originalList)
    expect(conversations.map((c) => c.id)).toEqual(["conv-2", "conv-1"])
    expect(conversations[0].messages).toEqual([message])
    expect(conversations[0].lastActivityAt).toBe(message.createdAt)
    expect(conversations[1]).toBe(oldFirst)
  })

  test("updateConversationViaMessage fetches and prepends a missing conversation", async () => {
    const store = createChatStore()
    const existing = makeConversation(
      "conv-1",
      new Date("2026-01-01T00:00:00Z"),
    )
    const fetched = makeConversation(
      "conv-new",
      new Date("2026-01-01T02:00:00Z"),
    )
    store.setState({ conversations: [existing] as never })
    mockFindConversationAuthenticatedAPI.mockResolvedValue({ data: fetched })

    const message = makeMessage("conv-new", new Date("2026-01-02T00:00:00Z"))
    await store.getState().updateConversationViaMessage(message as never)

    expect(mockFindConversationAuthenticatedAPI).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      id: "conv-new",
    })
    expect(store.getState().conversations).toEqual([
      { ...fetched, messages: [message] },
      existing,
    ])
  })

  test("updateConversation merges partial data without touching other conversations", () => {
    const store = createChatStore()
    const first = makeConversation("conv-1", new Date("2026-01-01T00:00:00Z"))
    const second = makeConversation("conv-2", new Date("2026-01-01T01:00:00Z"))
    store.setState({ conversations: [first, second] as never })

    store.getState().updateConversation("conv-2", {
      agentLastReadAt: new Date("2026-01-02T00:00:00Z"),
    })

    const conversations = store.getState().conversations
    expect(conversations[0]).toBe(first)
    expect(conversations[1]).toEqual({
      ...second,
      agentLastReadAt: new Date("2026-01-02T00:00:00Z"),
    })
  })
})
