import { describe, expect, it, vi } from "vitest"

/**
 * Hoist the mock so vi.mock() factory can reference it.
 * `postMock` is what the KyInstance returned by ky.create().post() calls.
 * `createMock` captures the ky.create() call so we can assert on headers/baseUrl.
 */
const { postMock, createMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  createMock: vi.fn(),
}))

vi.mock("ky", async () => {
  const actual = await vi.importActual<typeof import("ky")>("ky")
  return {
    ...actual,
    default: {
      ...actual.default,
      create: createMock,
    },
  }
})

import type { Context } from "@chatbotx.io/sdk"
import type { ChatbotxAuthValue } from "../src/auth"
import { broadcastMessageToWorkspaceParty } from "../src/lib/outgoing-message"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildCtx = (): Context<ChatbotxAuthValue> =>
  ({
    auth: {
      appUrl: "https://app.example.com",
      wsUrl: "https://ws.example.com",
      apiKey: "test-api-key",
    },
  }) as unknown as Context<ChatbotxAuthValue>

const buildMessage = (workspaceId = "ws-abc-123") =>
  ({
    workspaceId,
    conversationId: "conv-1",
    id: "msg-1",
    content: { type: "text", text: "hello" },
    createdAt: new Date().toISOString(),
  }) as unknown as import("@chatbotx.io/sdk").OutgoingMessage

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("broadcastMessageToWorkspaceParty", () => {
  it("POSTs to /parties/workspaces/{workspaceId} with eventType messageCreated", async () => {
    // Arrange — client.post() resolves immediately (happy-path)
    postMock.mockResolvedValueOnce({})
    createMock.mockReturnValue({ post: postMock })

    const ctx = buildCtx()
    const message = buildMessage("ws-abc-123")

    // Act
    await broadcastMessageToWorkspaceParty(ctx, message)

    // Assert — ky.create was called with the correct base config
    expect(createMock).toHaveBeenCalledOnce()
    const createArg = createMock.mock.calls[0][0] as Record<string, unknown>
    expect(createArg.baseUrl).toBe("https://ws.example.com")
    expect((createArg.headers as Record<string, string>)["X-API-KEY"]).toBe(
      "test-api-key",
    )

    // Assert — post was called with the right path and body
    expect(postMock).toHaveBeenCalledOnce()
    const [path, options] = postMock.mock.calls[0] as [
      string,
      { json: unknown },
    ]
    expect(path).toBe("/parties/workspaces/ws-abc-123")
    expect(options.json).toEqual({
      eventType: "messageCreated",
      data: message,
    })
  })

  it("does not throw and swallows errors when client.post() rejects", async () => {
    // Arrange — client.post() rejects with a network error
    const rejection = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("network failure")), 0),
    )
    postMock.mockReturnValueOnce(rejection)
    createMock.mockReturnValue({ post: postMock })

    const ctx = buildCtx()
    const message = buildMessage("ws-xyz-999")

    // Act — function returns void synchronously; must not throw
    expect(() => broadcastMessageToWorkspaceParty(ctx, message)).not.toThrow()

    // Allow the promise microtask queue to flush so the .catch() handler runs
    // and we confirm no unhandled rejection surfaces.
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
})
