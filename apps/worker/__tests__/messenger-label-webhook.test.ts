import { beforeEach, describe, expect, test, vi } from "vitest"

// ---------------------------------------------------------------------------
// DB mock — chainable builder pattern (mirrors sync-tag.test.ts)
// ---------------------------------------------------------------------------

type ChainBuilder = Record<string, unknown>

const queryResults = {
  integrationMessengerFindFirst: null as unknown,
  tagModelFindFirst: null as unknown,
  tagChannelFindFirst: null as unknown,
  contactInboxFindFirst: null as unknown,
}

// Shared mutable holder for insert returning values
const insertReturning = { current: [] as unknown[] }

// Generic chainable builder for insert / delete chains
function makeChain(): ChainBuilder {
  const builder: ChainBuilder = {}
  const noop = () => builder
  builder.values = vi.fn(noop)
  builder.where = vi.fn(noop)
  builder.onConflictDoNothing = vi.fn(noop)
  builder.returning = vi.fn(async () => insertReturning.current)
  return builder
}

const insertChain = makeChain()
const deleteChain = makeChain()

// deleteChain.where() must be awaitable (no .returning() call on delete path)
;(deleteChain.where as ReturnType<typeof vi.fn>).mockImplementation(
  async () => undefined,
)

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      integrationMessengerModel: {
        findFirst: vi.fn(
          async () => queryResults.integrationMessengerFindFirst,
        ),
      },
      tagModel: {
        findFirst: vi.fn(async () => queryResults.tagModelFindFirst),
      },
      tagChannelModel: {
        findFirst: vi.fn(async () => queryResults.tagChannelFindFirst),
      },
      contactInboxModel: {
        findFirst: vi.fn(async () => queryResults.contactInboxFindFirst),
      },
    },
    insert: vi.fn(() => insertChain),
    delete: vi.fn(() => deleteChain),
  },
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  isNull: (...args: unknown[]) => args,
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  tagModel: {
    id: "id",
    workspaceId: "workspaceId",
    name: "name",
  },
  tagChannelModel: {
    id: "id",
    tagId: "tagId",
    channelType: "channelType",
    integrationId: "integrationId",
    workspaceId: "workspaceId",
    externalLabelId: "externalLabelId",
  },
  contactsToTagsModel: {
    contactId: "contactId",
    tagId: "tagId",
  },
  contactToTagChannelModel: {
    tagId: "tagId",
    tagChannelId: "tagChannelId",
    contactInboxId: "contactInboxId",
  },
}))

// ---------------------------------------------------------------------------
// createId mock — returns predictable ids
// ---------------------------------------------------------------------------

const createId = vi.fn(() => "generated-id")
vi.mock("@chatbotx.io/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chatbotx.io/utils")>()
  return { ...actual, createId }
})

// ---------------------------------------------------------------------------
// Logger — silence / spy
// ---------------------------------------------------------------------------

vi.mock("../src/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Lazy imports AFTER mocks
// ---------------------------------------------------------------------------

const { handleMessengerLabelWebhook } = await import(
  "../src/integration/handlers/messenger-label-webhook"
)
const { logger } = await import("../src/lib/logger")
const { db } = await import("@chatbotx.io/database/client")
const {
  tagModel,
  tagChannelModel,
  contactsToTagsModel,
  contactToTagChannelModel,
} = await import("@chatbotx.io/database/schema")

// ---------------------------------------------------------------------------
// Typed cast helpers
// ---------------------------------------------------------------------------

const dbInsert = db.insert as ReturnType<typeof vi.fn>
const dbDelete = db.delete as ReturnType<typeof vi.fn>
const loggerWarn = logger.warn as ReturnType<typeof vi.fn>
const integrationFindFirst = db.query.integrationMessengerModel
  .findFirst as ReturnType<typeof vi.fn>
const tagFindFirst = db.query.tagModel.findFirst as ReturnType<typeof vi.fn>
const tagChannelFindFirst = db.query.tagChannelModel.findFirst as ReturnType<
  typeof vi.fn
>
const contactInboxFindFirst = db.query.contactInboxModel
  .findFirst as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const PAGE_ID = "page-123"
const WS_ID = "ws-1"
const INTEGRATION_ID = "intg-msg-1"
const INBOX_ID = "inbox-1"
const LABEL_ID = "label-ext-1"
const LABEL_NAME = "VIP"
const USER_PSID = "psid-abc"

function makeIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: INTEGRATION_ID,
    workspaceId: WS_ID,
    inboxId: INBOX_ID,
    pageId: PAGE_ID,
    syncTagEnabledAt: new Date("2026-01-01"),
    ...overrides,
  }
}

/** Build a valid messengerWebhookEventSchema payload with an inbox_labels change */
function makePayload(changeValue: Record<string, unknown>) {
  return {
    object: "page",
    entry: [
      {
        id: PAGE_ID,
        time: 1_700_000_000,
        changes: [
          {
            field: "inbox_labels",
            value: changeValue,
          },
        ],
      },
    ],
  }
}

function makeData(
  payload: unknown,
): Parameters<typeof handleMessengerLabelWebhook>[0] {
  return {
    integrationIdentifier: PAGE_ID,
    integrationType: "messenger",
    payload,
  }
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  queryResults.integrationMessengerFindFirst = null
  queryResults.tagModelFindFirst = null
  queryResults.tagChannelFindFirst = null
  queryResults.contactInboxFindFirst = null
  insertReturning.current = []

  vi.clearAllMocks()

  // Restore delete chain where to async no-op after clearAllMocks
  ;(deleteChain.where as ReturnType<typeof vi.fn>).mockImplementation(
    async () => undefined,
  )

  // Restore insert chain defaults after clearAllMocks
  ;(insertChain.values as ReturnType<typeof vi.fn>).mockReturnValue(insertChain)
  ;(
    insertChain.onConflictDoNothing as ReturnType<typeof vi.fn>
  ).mockReturnValue(insertChain)
  ;(insertChain.returning as ReturnType<typeof vi.fn>).mockImplementation(
    async () => insertReturning.current,
  )

  dbInsert.mockReturnValue(insertChain)
  dbDelete.mockReturnValue(deleteChain)

  // Restore findFirst implementations after clearAllMocks — tests that call
  // .mockResolvedValue(...) on these spies would otherwise leak into later tests
  // (config uses clearMocks, which does not reset implementations).
  integrationFindFirst.mockImplementation(
    async () => queryResults.integrationMessengerFindFirst,
  )
  tagFindFirst.mockImplementation(async () => queryResults.tagModelFindFirst)
  tagChannelFindFirst.mockImplementation(
    async () => queryResults.tagChannelFindFirst,
  )
  contactInboxFindFirst.mockImplementation(
    async () => queryResults.contactInboxFindFirst,
  )
})

// ===========================================================================
// Test suites
// ===========================================================================

describe("handleMessengerLabelWebhook — payload parsing", () => {
  test("warns and returns early when payload fails safeParse", async () => {
    await handleMessengerLabelWebhook(makeData({ not: "valid" }))

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: PAGE_ID }),
      "messenger inbox_labels: invalid payload",
    )
    expect(dbInsert).not.toHaveBeenCalled()
    expect(dbDelete).not.toHaveBeenCalled()
    expect(integrationFindFirst).not.toHaveBeenCalled()
  })

  test("returns early when entry has no inbox_labels change", async () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: PAGE_ID,
          time: 1_700_000_000,
          changes: [
            {
              field: "messaging",
              value: { action: "some_other", label: { id: LABEL_ID } },
            },
          ],
        },
      ],
    }
    await handleMessengerLabelWebhook(makeData(payload))

    expect(integrationFindFirst).not.toHaveBeenCalled()
    expect(dbInsert).not.toHaveBeenCalled()
  })

  test("returns early when entry has no changes at all", async () => {
    const payload = {
      object: "page",
      entry: [{ id: PAGE_ID, time: 1_700_000_000 }],
    }
    await handleMessengerLabelWebhook(makeData(payload))

    expect(integrationFindFirst).not.toHaveBeenCalled()
    expect(dbInsert).not.toHaveBeenCalled()
  })
})

describe("handleMessengerLabelWebhook — integration guard", () => {
  test("returns early when integration is not found", async () => {
    queryResults.integrationMessengerFindFirst = null
    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add",
          user: { id: USER_PSID },
          label: { id: LABEL_ID, page_label_name: LABEL_NAME },
        }),
      ),
    )

    expect(dbInsert).not.toHaveBeenCalled()
    expect(dbDelete).not.toHaveBeenCalled()
  })

  test("returns early when integration exists but syncTagEnabledAt is null", async () => {
    queryResults.integrationMessengerFindFirst = makeIntegration({
      syncTagEnabledAt: null,
    })
    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add",
          user: { id: USER_PSID },
          label: { id: LABEL_ID, page_label_name: LABEL_NAME },
        }),
      ),
    )

    expect(dbInsert).not.toHaveBeenCalled()
  })
})

describe("handleMessengerLabelWebhook — add_label", () => {
  beforeEach(() => {
    queryResults.integrationMessengerFindFirst = makeIntegration()
  })

  test("returns early when user is missing from change value", async () => {
    // No user field
    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add_label",
          label: { id: LABEL_ID },
          // user omitted
        }),
      ),
    )

    expect(contactInboxFindFirst).not.toHaveBeenCalled()
    expect(dbInsert).not.toHaveBeenCalled()
  })

  test("returns early when contactInbox not found (resolveContactAndTagChannel → null)", async () => {
    queryResults.contactInboxFindFirst = null
    queryResults.tagChannelFindFirst = { id: "tc-1", tagId: "tag-1" }

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add_label",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    expect(dbInsert).not.toHaveBeenCalled()
  })

  test("returns early when tagChannel not found (resolveContactAndTagChannel → null)", async () => {
    queryResults.contactInboxFindFirst = { id: "ci-1", contactId: "contact-1" }
    queryResults.tagChannelFindFirst = null

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add_label",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    expect(dbInsert).not.toHaveBeenCalled()
  })

  test("inserts contactsToTags and contactToTagChannel when resolved", async () => {
    queryResults.contactInboxFindFirst = { id: "ci-1", contactId: "contact-1" }
    queryResults.tagChannelFindFirst = { id: "tc-1", tagId: "tag-1" }
    insertReturning.current = []

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add_label",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    const insertCalls = dbInsert.mock.calls.map((c: unknown[]) => c[0])
    expect(insertCalls).toContain(contactsToTagsModel)
    expect(insertCalls).toContain(contactToTagChannelModel)
  })

  test("uses onConflictDoNothing for both inserts (idempotent)", async () => {
    queryResults.contactInboxFindFirst = { id: "ci-1", contactId: "contact-1" }
    queryResults.tagChannelFindFirst = { id: "tc-1", tagId: "tag-1" }

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add_label",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    expect(insertChain.onConflictDoNothing).toHaveBeenCalledTimes(2)
  })

  test("passes correct contactId, tagId, tagChannelId, contactInboxId to inserts", async () => {
    queryResults.contactInboxFindFirst = {
      id: "ci-resolved",
      contactId: "contact-resolved",
    }
    queryResults.tagChannelFindFirst = {
      id: "tc-resolved",
      tagId: "tag-resolved",
    }

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add_label",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    const valuesCalls = (insertChain.values as ReturnType<typeof vi.fn>).mock
      .calls
    const contactsToTagsValues = valuesCalls[0]?.[0] as Record<string, string>
    expect(contactsToTagsValues).toMatchObject({
      contactId: "contact-resolved",
      tagId: "tag-resolved",
    })
    const contactToTagChannelValues = valuesCalls[1]?.[0] as Record<
      string,
      string
    >
    expect(contactToTagChannelValues).toMatchObject({
      tagId: "tag-resolved",
      tagChannelId: "tc-resolved",
      contactInboxId: "ci-resolved",
    })
  })
})

describe("handleMessengerLabelWebhook — remove_label", () => {
  beforeEach(() => {
    queryResults.integrationMessengerFindFirst = makeIntegration()
  })

  test("returns early when user is missing", async () => {
    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "remove_label",
          label: { id: LABEL_ID },
          // no user
        }),
      ),
    )

    expect(contactInboxFindFirst).not.toHaveBeenCalled()
    expect(dbDelete).not.toHaveBeenCalled()
  })

  test("returns early when contactInbox not found", async () => {
    queryResults.contactInboxFindFirst = null
    queryResults.tagChannelFindFirst = { id: "tc-1", tagId: "tag-1" }

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "remove_label",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    expect(dbDelete).not.toHaveBeenCalled()
  })

  test("returns early when tagChannel not found", async () => {
    queryResults.contactInboxFindFirst = { id: "ci-1", contactId: "contact-1" }
    queryResults.tagChannelFindFirst = null

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "remove_label",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    expect(dbDelete).not.toHaveBeenCalled()
  })

  test("deletes contactToTagChannel row when resolved", async () => {
    queryResults.contactInboxFindFirst = { id: "ci-1", contactId: "contact-1" }
    queryResults.tagChannelFindFirst = { id: "tc-1", tagId: "tag-1" }

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "remove_label",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    expect(dbDelete).toHaveBeenCalledWith(contactToTagChannelModel)
    expect(deleteChain.where).toHaveBeenCalled()
  })

  test("where clause for remove_label scoped by tagChannelId and contactInboxId", async () => {
    queryResults.contactInboxFindFirst = {
      id: "ci-specific",
      contactId: "contact-1",
    }
    queryResults.tagChannelFindFirst = {
      id: "tc-specific",
      tagId: "tag-1",
    }

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "remove_label",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    const whereArgs = (deleteChain.where as ReturnType<typeof vi.fn>).mock
      .calls[0]
    const conditions = whereArgs[0] as unknown[][]
    // Should scope by tagChannelId
    const tcCondition = conditions.find(
      (c) => Array.isArray(c) && c[1] === "tc-specific",
    )
    expect(tcCondition).toBeDefined()
    // Should scope by contactInboxId
    const ciCondition = conditions.find(
      (c) => Array.isArray(c) && c[1] === "ci-specific",
    )
    expect(ciCondition).toBeDefined()
  })
})

describe("handleMessengerLabelWebhook — short action aliases (add/remove)", () => {
  beforeEach(() => {
    queryResults.integrationMessengerFindFirst = makeIntegration()
  })

  test("'remove' behaves like remove_label (unassigns)", async () => {
    queryResults.contactInboxFindFirst = { id: "ci-1", contactId: "contact-1" }
    queryResults.tagChannelFindFirst = { id: "tc-1", tagId: "tag-1" }

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "remove",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    expect(dbDelete).toHaveBeenCalledWith(contactToTagChannelModel)
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  test("'add' assigns when the tag channel already exists", async () => {
    queryResults.contactInboxFindFirst = { id: "ci-1", contactId: "contact-1" }
    queryResults.tagChannelFindFirst = { id: "tc-1", tagId: "tag-1" }

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add",
          user: { id: USER_PSID },
          label: { id: LABEL_ID },
        }),
      ),
    )

    expect(dbInsert).toHaveBeenCalledWith(contactsToTagsModel)
    expect(dbInsert).toHaveBeenCalledWith(contactToTagChannelModel)
    expect(loggerWarn).not.toHaveBeenCalled()
  })
})

describe("handleMessengerLabelWebhook — add creates missing tag", () => {
  beforeEach(() => {
    queryResults.integrationMessengerFindFirst = makeIntegration()
    queryResults.contactInboxFindFirst = { id: "ci-1", contactId: "contact-1" }
    queryResults.tagChannelFindFirst = null // not synced locally yet
  })

  test("creates tag + channel from page_label_name in payload, then assigns", async () => {
    queryResults.tagModelFindFirst = null
    insertReturning.current = [{ id: "new-id" }]

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add",
          user: { id: USER_PSID },
          label: { id: LABEL_ID, page_label_name: LABEL_NAME },
        }),
      ),
    )

    // upsert created the tag + channel, then assigned to the contact
    expect(dbInsert).toHaveBeenCalledWith(tagModel)
    expect(dbInsert).toHaveBeenCalledWith(tagChannelModel)
    expect(dbInsert).toHaveBeenCalledWith(contactsToTagsModel)
    expect(dbInsert).toHaveBeenCalledWith(contactToTagChannelModel)
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  test("skips when the tag is missing and the payload carries no name", async () => {
    queryResults.tagModelFindFirst = null

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "add",
          user: { id: USER_PSID },
          label: { id: LABEL_ID }, // no page_label_name
        }),
      ),
    )

    expect(dbInsert).not.toHaveBeenCalled()
  })
})

describe("handleMessengerLabelWebhook — unknown action", () => {
  test("warns with action name and does not throw", async () => {
    queryResults.integrationMessengerFindFirst = makeIntegration()

    await handleMessengerLabelWebhook(
      makeData(
        makePayload({
          action: "some_future_action",
          label: { id: LABEL_ID },
        }),
      ),
    )

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "some_future_action" }),
      "messenger inbox_labels: unknown action",
    )
    expect(dbInsert).not.toHaveBeenCalled()
    expect(dbDelete).not.toHaveBeenCalled()
  })
})
