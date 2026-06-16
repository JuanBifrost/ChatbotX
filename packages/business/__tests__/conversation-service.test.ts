import { beforeEach, describe, expect, test, vi } from "vitest"

const { invalidateCacheByTags, set, update, where } = vi.hoisted(() => {
  const where = vi.fn().mockResolvedValue(undefined)
  const set = vi.fn(() => ({ where }))
  return {
    invalidateCacheByTags: vi.fn().mockResolvedValue(undefined),
    set,
    update: vi.fn(() => ({ set })),
    where,
  }
})

vi.mock("@chatbotx.io/database/client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@chatbotx.io/database/client")>()
  return { ...original, db: { update } }
})
vi.mock("@chatbotx.io/redis", () => ({
  invalidateCacheByTags,
  withCache: vi.fn((_key: string, fn: () => unknown) => fn()),
}))

const { conversationService } = await import("../src/conversation/service")

// Recursively collect bound parameter values from a Drizzle SQL object.
// Drizzle stores user-supplied values as { value: T } nodes inside queryChunks.
function collectSqlValues(
  node: unknown,
  seen = new WeakSet(),
  out: unknown[] = [],
): unknown[] {
  if (!node || typeof node !== "object") {
    return out
  }
  if (seen.has(node as object)) {
    return out
  }
  seen.add(node as object)
  if (Array.isArray(node)) {
    for (const item of node) {
      collectSqlValues(item, seen, out)
    }
    return out
  }
  const obj = node as Record<string, unknown>
  if ("value" in obj && obj.value !== null && typeof obj.value !== "object") {
    out.push(obj.value)
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      collectSqlValues(val, seen, out)
    }
  }
  return out
}

describe("conversationService.updateAIContextLastMessageId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("updates with workspace scope and invalidates conversation cache tags", async () => {
    await conversationService.updateAIContextLastMessageId({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      messageId: "10",
    })

    expect(set).toHaveBeenCalledWith({ aiContextLastMessageId: "10" })
    expect(where).toHaveBeenCalledTimes(1)

    const whereValues = collectSqlValues(where.mock.calls[0][0])
    expect(whereValues).toContain("conv-1")
    expect(whereValues).toContain("ws-1")

    expect(invalidateCacheByTags).toHaveBeenCalledWith([
      "conversations",
      "conversations:ws-1",
      "conversations:conv-1",
    ])
  })

  test("scopes the null messageId update to the correct workspace", async () => {
    await conversationService.updateAIContextLastMessageId({
      workspaceId: "ws-2",
      conversationId: "conv-2",
      messageId: null,
    })

    expect(set).toHaveBeenCalledWith({ aiContextLastMessageId: null })

    const whereValues = collectSqlValues(where.mock.calls[0][0])
    expect(whereValues).toContain("conv-2")
    expect(whereValues).toContain("ws-2")
  })
})
