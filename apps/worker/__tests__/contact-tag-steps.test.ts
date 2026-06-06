import { beforeEach, describe, expect, test, vi } from "vitest"

// ---------------------------------------------------------------------------
// These tests cover OUR orchestration logic in the flow-step handlers
// `addContactTag` / `removeContactTag` (apps/worker/src/integration/handlers/
// contact.ts): they must enqueue tag-sync jobs (enqueueAttach / enqueueDetach)
// and emit tag events for the correct set of tags. We do NOT test the channel
// APIs — only that we enqueue/emit with the right payloads.
// Mock pattern mirrors sync-tag.test.ts + contact-tag-actions.test.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mutable state holders controlled per-test
// ---------------------------------------------------------------------------
const state = {
  // addContactTag
  txExistingTags: [] as { id: string }[], // tx.select().from(tagModel).where()
  txNewlyLinked: [] as { tagId: string }[], // contactsToTags insert .returning()
  // removeContactTag
  tagFindMany: [] as { id: string }[], // db.query.tagModel.findMany()
}

// ---------------------------------------------------------------------------
// Mock: @chatbotx.io/database/client
// ---------------------------------------------------------------------------
const mockTxInsertBuilder = {
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
  returning: vi.fn(),
}
mockTxInsertBuilder.values.mockReturnValue(mockTxInsertBuilder)
mockTxInsertBuilder.onConflictDoNothing.mockReturnValue(mockTxInsertBuilder)
mockTxInsertBuilder.returning.mockImplementation(
  async () => state.txNewlyLinked,
)

const mockTxSelectBuilder = {
  from: vi.fn(),
  where: vi.fn(),
}
mockTxSelectBuilder.from.mockReturnValue(mockTxSelectBuilder)
mockTxSelectBuilder.where.mockImplementation(async () => state.txExistingTags)

const mockTx = {
  insert: vi.fn(() => mockTxInsertBuilder),
  select: vi.fn(() => mockTxSelectBuilder),
}

const mockDeleteBuilder = {
  where: vi.fn(),
}
mockDeleteBuilder.where.mockResolvedValue(undefined)

// Records the relative order of side effects (transaction vs enqueue)
const order: string[] = []

const dbTransaction = vi.fn(
  async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
    const result = await cb(mockTx)
    order.push("tx-done")
    return result
  },
)

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    transaction: dbTransaction,
    delete: vi.fn(() => mockDeleteBuilder),
    query: {
      tagModel: {
        findMany: vi.fn(async () => state.tagFindMany),
      },
    },
  },
  and: (...args: unknown[]) => ({ and: args }),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  inArray: (col: unknown, vals: unknown) => ({ inArray: [col, vals] }),
  isNull: (col: unknown) => ({ isNull: col }),
}))

// ---------------------------------------------------------------------------
// Mock: @chatbotx.io/database/schema — sentinel objects
// ---------------------------------------------------------------------------
vi.mock("@chatbotx.io/database/schema", () => ({
  tagModel: {
    id: "tagModel.id",
    name: "tagModel.name",
    workspaceId: "tagModel.workspaceId",
  },
  contactsToTagsModel: {
    contactId: "contactsToTagsModel.contactId",
    tagId: "contactsToTagsModel.tagId",
  },
}))

// ---------------------------------------------------------------------------
// Mock: @chatbotx.io/business — tagSyncService
// ---------------------------------------------------------------------------
const enqueueAttach = vi.fn(() => {
  order.push("enqueue")
})
const enqueueDetach = vi.fn(() => {
  order.push("enqueue")
})
vi.mock("@chatbotx.io/business", () => ({
  tagSyncService: { enqueueAttach, enqueueDetach },
}))

// ---------------------------------------------------------------------------
// Mock: @chatbotx.io/events
// ---------------------------------------------------------------------------
const emitTagApplied = vi.fn(async () => undefined)
const emitTagRemoved = vi.fn(async () => undefined)
const emitCustomFieldChanged = vi.fn(async () => undefined)
vi.mock("@chatbotx.io/events", () => ({
  emitTagApplied,
  emitTagRemoved,
  emitCustomFieldChanged,
}))

// ---------------------------------------------------------------------------
// Remaining runtime imports of contact.ts (unused by tested handlers)
// ---------------------------------------------------------------------------
vi.mock("@chatbotx.io/event-bus", () => ({ emit: vi.fn() }))
vi.mock("@chatbotx.io/sequence-scheduler", () => ({
  cancelPendingDispatches: vi.fn(),
  enrollContactInSequence: vi.fn(),
}))

let idCounter = 0
vi.mock("@chatbotx.io/utils", () => ({
  createId: vi.fn(() => `generated-id-${++idCounter}`),
}))

// ---------------------------------------------------------------------------
// Import handlers under test (after all vi.mock calls)
// ---------------------------------------------------------------------------
const { addContactTag, removeContactTag } = await import(
  "../src/integration/handlers/contact"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addProps(tags: string[], workspaceId = "ws-1", contactId = "c-1") {
  return {
    conversation: { workspaceId, contactId },
    step: { tags },
  } as unknown as Parameters<typeof addContactTag>[0]
}

function removeProps(tags: string[], workspaceId = "ws-1", contactId = "c-1") {
  return {
    conversation: { workspaceId, contactId },
    step: { tags },
  } as unknown as Parameters<typeof removeContactTag>[0]
}

function reset() {
  state.txExistingTags = []
  state.txNewlyLinked = []
  state.tagFindMany = []
  order.length = 0
  idCounter = 0
  vi.clearAllMocks()
  // Re-wire chains (clearAllMocks resets mockReturnValue/Implementation)
  mockTxInsertBuilder.values.mockReturnValue(mockTxInsertBuilder)
  mockTxInsertBuilder.onConflictDoNothing.mockReturnValue(mockTxInsertBuilder)
  mockTxInsertBuilder.returning.mockImplementation(
    async () => state.txNewlyLinked,
  )
  mockTxSelectBuilder.from.mockReturnValue(mockTxSelectBuilder)
  mockTxSelectBuilder.where.mockImplementation(async () => state.txExistingTags)
  mockTx.insert.mockReturnValue(mockTxInsertBuilder)
  mockTx.select.mockReturnValue(mockTxSelectBuilder)
  mockDeleteBuilder.where.mockResolvedValue(undefined)
  enqueueAttach.mockImplementation(() => {
    order.push("enqueue")
  })
  enqueueDetach.mockImplementation(() => {
    order.push("enqueue")
  })
}

// ============================================================================
// addContactTag
// ============================================================================
describe("addContactTag", () => {
  beforeEach(reset)

  test("enqueues attach + emits applied only for newly-linked pairs", async () => {
    state.txExistingTags = [{ id: "tag-1" }, { id: "tag-2" }]
    // Only tag-1 was newly linked; tag-2 already existed on the contact
    state.txNewlyLinked = [{ tagId: "tag-1" }]

    await addContactTag(addProps(["alpha", "beta"]))

    expect(enqueueAttach).toHaveBeenCalledTimes(1)
    expect(enqueueAttach).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      contactId: "c-1",
      tagId: "tag-1",
    })
    expect(enqueueAttach).not.toHaveBeenCalledWith(
      expect.objectContaining({ tagId: "tag-2" }),
    )

    expect(emitTagApplied).toHaveBeenCalledTimes(1)
    expect(emitTagApplied).toHaveBeenCalledWith("ws-1", "c-1", "tag-1")
  })

  test("does NOT enqueue or emit when all pairs already exist (empty RETURNING)", async () => {
    state.txExistingTags = [{ id: "tag-1" }]
    state.txNewlyLinked = []

    await addContactTag(addProps(["alpha"]))

    expect(enqueueAttach).not.toHaveBeenCalled()
    expect(emitTagApplied).not.toHaveBeenCalled()
  })

  test("does NOT enqueue or emit when no tags resolve in the workspace", async () => {
    state.txExistingTags = []
    state.txNewlyLinked = []

    await addContactTag(addProps(["ghost"]))

    expect(enqueueAttach).not.toHaveBeenCalled()
    expect(emitTagApplied).not.toHaveBeenCalled()
  })

  test("enqueues attach AFTER the transaction commits (not inside the tx)", async () => {
    state.txExistingTags = [{ id: "tag-1" }]
    state.txNewlyLinked = [{ tagId: "tag-1" }]

    await addContactTag(addProps(["alpha"]))

    expect(order).toEqual(["tx-done", "enqueue"])
  })

  test("uses workspaceId and contactId from the conversation", async () => {
    state.txExistingTags = [{ id: "tag-9" }]
    state.txNewlyLinked = [{ tagId: "tag-9" }]

    await addContactTag(addProps(["alpha"], "ws-42", "c-77"))

    expect(enqueueAttach).toHaveBeenCalledWith({
      workspaceId: "ws-42",
      contactId: "c-77",
      tagId: "tag-9",
    })
    expect(emitTagApplied).toHaveBeenCalledWith("ws-42", "c-77", "tag-9")
  })
})

// ============================================================================
// removeContactTag
// ============================================================================
describe("removeContactTag", () => {
  beforeEach(reset)

  test("returns early when no tag names resolve (no delete/enqueue/emit)", async () => {
    state.tagFindMany = []

    await removeContactTag(removeProps(["ghost"]))

    const { db } = await import("@chatbotx.io/database/client")
    expect(db.delete).not.toHaveBeenCalled()
    expect(enqueueDetach).not.toHaveBeenCalled()
    expect(emitTagRemoved).not.toHaveBeenCalled()
  })

  test("deletes once and enqueues detach + emits removed per resolved tag", async () => {
    state.tagFindMany = [{ id: "tag-1" }, { id: "tag-2" }]

    await removeContactTag(removeProps(["alpha", "beta"]))

    const { db } = await import("@chatbotx.io/database/client")
    expect(db.delete).toHaveBeenCalledTimes(1)

    expect(enqueueDetach).toHaveBeenCalledTimes(2)
    expect(enqueueDetach).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      contactId: "c-1",
      tagId: "tag-1",
    })
    expect(enqueueDetach).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      contactId: "c-1",
      tagId: "tag-2",
    })

    expect(emitTagRemoved).toHaveBeenCalledTimes(2)
    expect(emitTagRemoved).toHaveBeenCalledWith("ws-1", "c-1", "tag-1")
    expect(emitTagRemoved).toHaveBeenCalledWith("ws-1", "c-1", "tag-2")
  })

  test("uses workspaceId and contactId from the conversation", async () => {
    state.tagFindMany = [{ id: "tag-5" }]

    await removeContactTag(removeProps(["alpha"], "ws-7", "c-9"))

    expect(enqueueDetach).toHaveBeenCalledWith({
      workspaceId: "ws-7",
      contactId: "c-9",
      tagId: "tag-5",
    })
  })
})
