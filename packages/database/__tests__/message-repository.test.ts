import { beforeEach, describe, expect, test, vi } from "vitest"
import type {
  BulkCreateAttachmentInput,
  CreateMessageInput,
} from "../src/repositories/message/message-repository"
import { MessageRepository } from "../src/repositories/message/message-repository"
import { attachmentModel, messageModel } from "../src/schema"

// ---------------------------------------------------------------------------
// Inline mock DatabaseClient — MessageRepository takes client in constructor
// ---------------------------------------------------------------------------

function makeDbMock() {
  const chain = {
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn().mockResolvedValue([]),
  }
  chain.values.mockReturnValue(chain)
  chain.onConflictDoNothing.mockReturnValue(chain)
  const insert = vi.fn().mockReturnValue(chain)

  const updateChain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue(undefined),
  }
  updateChain.set.mockReturnValue(updateChain)
  const update = vi.fn().mockReturnValue(updateChain)

  return { insert, chain, update, updateChain }
}

function makeMessage(
  overrides: Partial<CreateMessageInput> = {},
): CreateMessageInput {
  return {
    id: "msg-1",
    contactInboxId: "ci-1",
    workspaceId: "ws-1",
    conversationId: "conv-1",
    messageType: "incoming",
    contentType: "text",
    senderType: "contact",
    sourceId: "src-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MessageRepository.bulkCreate", () => {
  let repo: MessageRepository
  let insert: ReturnType<typeof vi.fn>
  let chain: ReturnType<typeof makeDbMock>["chain"]
  let update: ReturnType<typeof vi.fn>
  let updateChain: ReturnType<typeof makeDbMock>["updateChain"]

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = makeDbMock()
    insert = mock.insert
    chain = mock.chain
    update = mock.update
    updateChain = mock.updateChain
    repo = new MessageRepository({ insert, update } as never)
  })

  test("inserts messages and returns { id, sourceId }[]", async () => {
    chain.returning.mockResolvedValue([{ id: "msg-1", sourceId: "src-1" }])

    const result = await repo.bulkCreate([makeMessage()])

    expect(result).toEqual([{ id: "msg-1", sourceId: "src-1" }])
    expect(insert).toHaveBeenCalledTimes(1)
  })

  test("conflict target is (contactInboxId, sourceId) — no createdAt for main table", async () => {
    chain.returning.mockResolvedValue([])

    await repo.bulkCreate([makeMessage()])

    const [callArg] = chain.onConflictDoNothing.mock.calls[0]
    expect(callArg.target).toHaveLength(2)
    expect(callArg.target).toContain(messageModel.contactInboxId)
    expect(callArg.target).toContain(messageModel.sourceId)
    expect(callArg.target).not.toContain(messageModel.createdAt)
  })

  test("returns empty array when no messages provided", async () => {
    const result = await repo.bulkCreate([])

    expect(result).toEqual([])
    expect(insert).not.toHaveBeenCalled()
  })

  test("chunks correctly — 2001 messages triggers 3 db.insert calls with correct slice sizes", async () => {
    chain.returning.mockResolvedValue([])
    const messages = Array.from({ length: 2001 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, sourceId: `src-${i}` }),
    )

    await repo.bulkCreate(messages)

    expect(insert).toHaveBeenCalledTimes(3)
    expect(chain.values.mock.calls[0][0]).toHaveLength(1000)
    expect(chain.values.mock.calls[1][0]).toHaveLength(1000)
    expect(chain.values.mock.calls[2][0]).toHaveLength(1)
    expect(chain.values.mock.calls[0][0][0].sourceId).toBe("src-0")
    expect(chain.values.mock.calls[1][0][0].sourceId).toBe("src-1000")
    expect(chain.values.mock.calls[2][0][0].sourceId).toBe("src-2000")
  })

  test("aggregates results from multiple chunks", async () => {
    // Use 2001 messages to force 3 chunks; each chunk returns some inserted rows
    chain.returning
      .mockResolvedValueOnce([{ id: "msg-0", sourceId: "src-0" }])
      .mockResolvedValueOnce([{ id: "msg-1000", sourceId: "src-1000" }])
      .mockResolvedValueOnce([{ id: "msg-2000", sourceId: "src-2000" }])

    const messages = Array.from({ length: 2001 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, sourceId: `src-${i}` }),
    )

    const result = await repo.bulkCreate(messages)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ id: "msg-0", sourceId: "src-0" })
    expect(result[1]).toEqual({ id: "msg-1000", sourceId: "src-1000" })
    expect(result[2]).toEqual({ id: "msg-2000", sourceId: "src-2000" })
  })

  test("updateSourceId calls db.update on messageModel with correct id and sourceId", async () => {
    await repo.updateSourceId("msg-1", "prov-abc", "ws-1")

    expect(update).toHaveBeenCalledWith(messageModel)
    expect(updateChain.set).toHaveBeenCalledWith({ sourceId: "prov-abc" })
    expect(updateChain.where).toHaveBeenCalled()
  })

  test("bulkCreateAttachments inserts into main attachmentModel and returns { id }[]", async () => {
    chain.returning.mockResolvedValue([{ id: "att-1" }])

    const input: BulkCreateAttachmentInput = {
      id: "att-1",
      workspaceId: "ws-1",
      conversationId: "conv-1",
      messageId: "msg-1",
      messageCreatedAt: new Date("2026-01-01"),
      fileType: "image",
      mimeType: "image/png",
      originPath: "/uploads/img.png",
    }

    const result = await repo.bulkCreateAttachments([input])

    expect(result).toEqual([{ id: "att-1" }])
    expect(insert).toHaveBeenCalledWith(attachmentModel)
    const insertedValues: Record<string, unknown>[] =
      chain.values.mock.calls[0][0]
    expect(insertedValues[0].messageId).toBe("msg-1")
    expect(insertedValues[0].workspaceId).toBe("ws-1")
    expect("messageCreatedAt" in insertedValues[0]).toBe(false)
  })

  test("bulkCreateAttachments returns empty array for empty input without calling insert", async () => {
    const result = await repo.bulkCreateAttachments([])

    expect(result).toEqual([])
    // insert call count must remain 0 — no DB roundtrip
    expect(insert).toHaveBeenCalledTimes(0)
  })
})
