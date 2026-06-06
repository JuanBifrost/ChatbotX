import { beforeEach, describe, expect, test, vi } from "vitest"

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

const {
  mockBulkCreate,
  mockBulkCreateAttachments,
  mockCreateMessageRepository,
  mockDbInsert,
  mockTxInsert,
  mockTxExecute,
  mockDbUpdate,
  mockDbTransaction,
} = vi.hoisted(() => {
  const txChain = {
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn().mockResolvedValue([]),
  }
  txChain.values.mockReturnValue(txChain)
  txChain.onConflictDoNothing.mockReturnValue(txChain)

  const mockTxInsert = vi.fn().mockReturnValue(txChain)
  const mockTxExecute = vi.fn().mockResolvedValue(undefined)

  const mockDbTransaction = vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
    fn({ insert: mockTxInsert, execute: mockTxExecute, update: vi.fn() }),
  )

  const dbInsertChain = {
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn().mockResolvedValue([]),
  }
  dbInsertChain.values.mockReturnValue(dbInsertChain)
  dbInsertChain.onConflictDoNothing.mockReturnValue(dbInsertChain)

  const mockDbInsert = vi.fn().mockReturnValue(dbInsertChain)

  const mockBulkCreate = vi.fn().mockResolvedValue([])
  const mockBulkCreateAttachments = vi.fn().mockResolvedValue([])
  const mockCreateMessageRepository = vi.fn().mockResolvedValue({
    bulkCreate: mockBulkCreate,
    bulkCreateAttachments: mockBulkCreateAttachments,
  })

  const updateChain = { set: vi.fn(), where: vi.fn() }
  updateChain.set.mockReturnValue(updateChain)
  updateChain.where.mockResolvedValue(undefined)
  const mockDbUpdate = vi.fn().mockReturnValue(updateChain)

  return {
    mockBulkCreate,
    mockBulkCreateAttachments,
    mockCreateMessageRepository,
    mockDbInsert,
    mockTxInsert,
    mockTxExecute,
    mockDbUpdate,
    mockDbTransaction,
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@chatbotx.io/database/repositories", () => ({
  createMessageRepository: mockCreateMessageRepository,
}))

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    insert: mockDbInsert,
    update: mockDbUpdate,
    transaction: mockDbTransaction,
    execute: vi.fn().mockResolvedValue(undefined),
    query: {},
  },
  eq: vi.fn((col: unknown, val: unknown) => ({ __eq: [col, val] })),
  inArray: vi.fn(),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
    { raw: (s: string) => s },
  ),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  messageModel: {
    id: "id",
    sourceId: "sourceId",
    contactInboxId: "contactInboxId",
  },
  attachmentModel: { id: "id", messageId: "messageId" },
  contactModel: { id: "id" },
  contactInboxModel: {},
  conversationModel: {},
  workspaceModel: {},
  userQuotaModel: {},
}))

vi.mock("@chatbotx.io/event-bus", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@chatbotx.io/events", () => ({
  emitContactCreated: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("p-limit", () => ({ default: () => (fn: () => unknown) => fn() }))
vi.mock("../src/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { bulkImportMessages } = await import(
  "../src/integration/handlers/coexist/bulk-historical-import"
)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_PROPS = {
  workspaceId: "ws-1",
  runId: "99999999999",
  contactInboxId: "ci-1",
  contactId: "contact-1",
  conversationId: "conv-1",
}

function makeMessage(sourceId: string) {
  return {
    sourceId,
    text: "hello",
    messageType: "incoming" as const,
    contentType: "text" as const,
    attachments: [],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("bulkImportMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBulkCreate.mockResolvedValue([])
    mockBulkCreateAttachments.mockResolvedValue([])
    mockCreateMessageRepository.mockResolvedValue({
      bulkCreate: mockBulkCreate,
      bulkCreateAttachments: mockBulkCreateAttachments,
    })
    mockDbTransaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ insert: mockTxInsert, execute: mockTxExecute, update: vi.fn() }),
    )
  })

  test("returns empty result when messages array is empty", async () => {
    const result = await bulkImportMessages({ ...BASE_PROPS, messages: [] })

    expect(result.importedMessages).toBe(0)
    expect(result.skippedMessages).toBe(0)
    expect(mockBulkCreate).not.toHaveBeenCalled()
  })

  test("calls repository.bulkCreate() for message rows", async () => {
    mockBulkCreate.mockResolvedValue([{ id: "msg-1", sourceId: "src-1" }])

    await bulkImportMessages({
      ...BASE_PROPS,
      messages: [makeMessage("src-1")],
    })

    expect(mockCreateMessageRepository).toHaveBeenCalled()
    expect(mockBulkCreate).toHaveBeenCalledTimes(1)
  })

  test("does NOT call db.insert(messageModel) directly for message rows", async () => {
    mockBulkCreate.mockResolvedValue([{ id: "msg-1", sourceId: "src-1" }])

    await bulkImportMessages({
      ...BASE_PROPS,
      messages: [makeMessage("src-1")],
    })

    // db.insert may be called for attachments, but never with messageModel
    const messageModelMock = (await import("@chatbotx.io/database/schema"))
      .messageModel
    for (const call of mockDbInsert.mock.calls) {
      expect(call[0]).not.toBe(messageModelMock)
    }
    for (const call of mockTxInsert.mock.calls) {
      expect(call[0]).not.toBe(messageModelMock)
    }
  })

  test("returns correct importedMessages count from bulkCreate result", async () => {
    mockBulkCreate.mockResolvedValue([
      { id: "msg-1", sourceId: "src-1" },
      { id: "msg-2", sourceId: "src-2" },
    ])

    const result = await bulkImportMessages({
      ...BASE_PROPS,
      messages: [makeMessage("src-1"), makeMessage("src-2")],
    })

    expect(result.importedMessages).toBe(2)
  })

  test("returns correct skippedMessages = total messages - inserted", async () => {
    mockBulkCreate.mockResolvedValue([{ id: "msg-1", sourceId: "src-1" }])

    const result = await bulkImportMessages({
      ...BASE_PROPS,
      messages: [makeMessage("src-1"), makeMessage("src-2")],
    })

    expect(result.skippedMessages).toBe(1)
  })

  test("inserts attachments via repository.bulkCreateAttachments (shard-aware, not tx.insert)", async () => {
    mockBulkCreate.mockResolvedValue([{ id: "msg-1", sourceId: "src-1" }])

    await bulkImportMessages({
      ...BASE_PROPS,
      messages: [
        {
          sourceId: "src-1",
          text: "with attachment",
          messageType: "incoming",
          contentType: "text",
          attachments: [
            {
              sourceId: "att-1",
              fileType: "image",
              mimeType: "image/jpeg",
              originPath: "/path/to/img.jpg",
              size: 1024,
            },
          ],
        },
      ],
    })

    expect(mockBulkCreateAttachments).toHaveBeenCalledTimes(1)
    const [rows] = mockBulkCreateAttachments.mock.calls[0]
    expect(rows).toHaveLength(1)
    expect(rows[0].messageId).toBe("msg-1")
    expect(rows[0].workspaceId).toBe("ws-1")
    // messageCreatedAt must be set so shard repository can partition by it
    expect(rows[0].messageCreatedAt).toBeInstanceOf(Date)
    // attachments must NOT go through main-DB tx.insert (causes FK violation when sharding)
    expect(mockTxInsert).not.toHaveBeenCalled()
  })

  test("retries with regenerated IDs on a Message PK collision (TimescaleDB chunk constraint via drizzle .cause)", async () => {
    // Real shape: drizzle wraps the pg error; code/constraint live on `.cause`,
    // and TimescaleDB reports the chunk-prefixed constraint name.
    const pkError = Object.assign(new Error("duplicate key value"), {
      cause: { code: "23505", constraint: "17_17_Message_pkey" },
    })
    mockBulkCreate
      .mockRejectedValueOnce(pkError)
      .mockResolvedValueOnce([{ id: "msg-retry", sourceId: "src-1" }])

    const result = await bulkImportMessages({
      ...BASE_PROPS,
      messages: [makeMessage("src-1")],
    })

    expect(mockBulkCreate).toHaveBeenCalledTimes(2)
    const firstRows = mockBulkCreate.mock.calls[0][0] as { id: string }[]
    const secondRows = mockBulkCreate.mock.calls[1][0] as {
      id: string
      sourceId: string
    }[]
    // Same message (sourceId), but a fresh ID on retry to dodge the collision.
    expect(secondRows[0].sourceId).toBe("src-1")
    expect(secondRows[0].id).not.toBe(firstRows[0].id)
    expect(result.importedMessages).toBe(1)
  })

  test("does NOT retry on non-PK errors — they propagate", async () => {
    const fkError = Object.assign(new Error("fk violation"), {
      cause: { code: "23503", constraint: "Message_conversationId_fkey" },
    })
    mockBulkCreate.mockRejectedValueOnce(fkError)

    await expect(
      bulkImportMessages({ ...BASE_PROPS, messages: [makeMessage("src-1")] }),
    ).rejects.toThrow("fk violation")
    expect(mockBulkCreate).toHaveBeenCalledTimes(1)
  })
})
