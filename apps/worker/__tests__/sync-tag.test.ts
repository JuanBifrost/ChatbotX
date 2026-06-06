import { beforeEach, describe, expect, test, vi } from "vitest"

const UNKNOWN_ACTION_RE = /unknown action/

// ---------------------------------------------------------------------------
// DB mock — chainable builder pattern (see contact-analytics.service.test.ts)
// ---------------------------------------------------------------------------

type ChainBuilder = Record<string, unknown>

// Shared result holders mutated by individual tests
const queryResults = {
  tagModelFindFirst: null as unknown,
  integrationMessengerFindMany: [] as unknown[],
  integrationZaloFindMany: [] as unknown[],
  tagChannelFindFirst: null as unknown,
  tagChannelFindMany: [] as unknown[],
  integrationMessengerFindFirst: null as unknown,
  integrationZaloFindFirst: null as unknown,
  contactInboxFindMany: [] as unknown[],
  selectRows: [] as unknown[],
}

const insertReturning = { current: [] as unknown[] }
const updateReturning = { current: [] as unknown[] }

// Generic chainable builder factory
function makeChain(terminalFn?: () => Promise<unknown>): ChainBuilder {
  const builder: ChainBuilder = {}
  const noop = () => builder
  builder.set = vi.fn(noop)
  builder.where = vi.fn(noop)
  builder.returning = vi.fn(async () => insertReturning.current)
  builder.onConflictDoNothing = vi.fn(noop)
  builder.onConflictDoUpdate = vi.fn(noop)
  builder.values = vi.fn(noop)
  builder.innerJoin = vi.fn(noop)
  builder.from = vi.fn(noop)
  // terminal
  if (terminalFn) {
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable for await support in tests
    builder.then = vi.fn((resolve: (v: unknown) => unknown) =>
      Promise.resolve(terminalFn()).then(resolve),
    )
  }
  return builder
}

const insertChain = makeChain()
const updateChain = makeChain(async () => updateReturning.current)
const deleteChain = makeChain()
const selectChain = makeChain(async () => queryResults.selectRows)

// Make insert().values().onConflictDoNothing().returning() work
insertChain.values = vi.fn(() => insertChain)
insertChain.onConflictDoNothing = vi.fn(() => insertChain)
insertChain.onConflictDoUpdate = vi.fn(() => insertChain)
insertChain.returning = vi.fn(async () => insertReturning.current)

// Make update().set().where() chain
updateChain.set = vi.fn(() => updateChain)
updateChain.where = vi.fn(() => updateChain)

// Make delete().where() chain
deleteChain.where = vi.fn(() => deleteChain)
// No returning needed for delete

// Make select().from().innerJoin().where() chain
selectChain.from = vi.fn(() => selectChain)
selectChain.innerJoin = vi.fn(() => selectChain)
selectChain.where = vi.fn(async () => queryResults.selectRows)

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      tagModel: {
        findFirst: vi.fn(async () => queryResults.tagModelFindFirst),
      },
      tagChannelModel: {
        findFirst: vi.fn(async () => queryResults.tagChannelFindFirst),
        findMany: vi.fn(async () => queryResults.tagChannelFindMany),
      },
      integrationMessengerModel: {
        findFirst: vi.fn(
          async () => queryResults.integrationMessengerFindFirst,
        ),
        findMany: vi.fn(async () => queryResults.integrationMessengerFindMany),
      },
      integrationZaloModel: {
        findFirst: vi.fn(async () => queryResults.integrationZaloFindFirst),
        findMany: vi.fn(async () => queryResults.integrationZaloFindMany),
      },
      contactInboxModel: {
        findMany: vi.fn(async () => queryResults.contactInboxFindMany),
      },
    },
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
    select: vi.fn(() => selectChain),
  },
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  inArray: (...args: unknown[]) => args,
  isNotNull: (...args: unknown[]) => args,
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  tagModel: { id: "id", workspaceId: "workspaceId", deletedAt: "deletedAt" },
  contactsToTagsModel: {
    contactId: "contactId",
    tagId: "tagId",
  },
  tagChannelModel: {
    id: "id",
    tagId: "tagId",
    channelType: "channelType",
    integrationId: "integrationId",
    workspaceId: "workspaceId",
  },
  contactToTagChannelModel: {
    tagChannelId: "tagChannelId",
    contactInboxId: "contactInboxId",
    tagId: "tagId",
  },
  contactInboxModel: { id: "id", contactId: "contactId" },
  integrationMessengerModel: { id: "id" },
  integrationZaloModel: { id: "id" },
}))

// ---------------------------------------------------------------------------
// Integration SDK mocks
// ---------------------------------------------------------------------------

const messengerRunChannelHandler = vi.fn(async () => ({ id: "label-ext-123" }))
vi.mock("@chatbotx.io/integration-messenger", () => ({
  integration: { runChannelHandler: messengerRunChannelHandler },
}))

const zaloRunAction = vi.fn(async () => undefined)
vi.mock("@chatbotx.io/integration-zalo", () => ({
  integration: { runAction: zaloRunAction },
}))

// ---------------------------------------------------------------------------
// Redis distributedLock — execute fn immediately (no real lock)
// ---------------------------------------------------------------------------

const runExclusive = vi.fn(async ({ fn }: { fn: () => Promise<unknown> }) =>
  fn(),
)
vi.mock("@chatbotx.io/redis", () => ({
  distributedLock: { runExclusive },
}))

// ---------------------------------------------------------------------------
// Business buildContext
// ---------------------------------------------------------------------------

const fakeCtx = { _brand: "ctx" }
const buildContext = vi.fn(async () => fakeCtx)
vi.mock("@chatbotx.io/business", () => ({
  buildContext,
}))

// ---------------------------------------------------------------------------
// Utils createId — use importOriginal to preserve other named exports
// ---------------------------------------------------------------------------

const createId = vi.fn(() => "generated-id")
vi.mock("@chatbotx.io/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chatbotx.io/utils")>()
  return {
    ...actual,
    createId,
  }
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
// Lazy import AFTER mocks are registered
// ---------------------------------------------------------------------------

const { handleSyncTag } = await import("../src/default/handlers/sync-tag")
const { logger } = await import("../src/lib/logger")
const { db } = await import("@chatbotx.io/database/client")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessengerIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: "intg-msg-1",
    workspaceId: "ws-1",
    inboxId: "inbox-msg-1",
    pageId: "page-123",
    syncTagEnabledAt: new Date("2026-01-01"),
    auth: { accessToken: "tok" },
    ...overrides,
  }
}

function makeZaloIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: "intg-zalo-1",
    workspaceId: "ws-1",
    inboxId: "inbox-zalo-1",
    syncTagEnabledAt: new Date("2026-01-01"),
    auth: { accessToken: "ztok" },
    ...overrides,
  }
}

function makeTagChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: "tc-1",
    workspaceId: "ws-1",
    tagId: "tag-1",
    channelType: "messenger",
    integrationId: "intg-msg-1",
    externalLabelId: "label-ext-123",
    ...overrides,
  }
}

function makeContactInbox(overrides: Record<string, unknown> = {}) {
  return {
    id: "ci-1",
    contactId: "contact-1",
    inboxId: "inbox-msg-1",
    channel: "messenger",
    sourceId: "psid-abc",
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset mutable state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  queryResults.tagModelFindFirst = null
  queryResults.integrationMessengerFindMany = []
  queryResults.integrationZaloFindMany = []
  queryResults.tagChannelFindFirst = null
  queryResults.tagChannelFindMany = []
  queryResults.integrationMessengerFindFirst = null
  queryResults.integrationZaloFindFirst = null
  queryResults.contactInboxFindMany = []
  queryResults.selectRows = []
  insertReturning.current = []
  updateReturning.current = []

  // Reset all mock call counts — vi clears between tests via clearMocks:true
  // in vitest config, but reset result holders manually above
})

// ===========================================================================
// dispatch router
// ===========================================================================

describe("handleSyncTag — dispatch", () => {
  test("unknown action logs warn and does not throw", async () => {
    await expect(
      handleSyncTag({
        action: "bogus" as never,
        workspaceId: "ws-1",
        tagId: "t1",
      }),
    ).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledOnce()
    const [, msg] = (logger.warn as ReturnType<typeof vi.fn>).mock
      .calls[0] as unknown[]
    expect(msg).toMatch(UNKNOWN_ACTION_RE)
  })
})

// ===========================================================================
// syncTagCreate
// ===========================================================================

describe("syncTagCreate", () => {
  test("tag not found → early return, no SDK calls", async () => {
    queryResults.tagModelFindFirst = null

    await handleSyncTag({
      action: "create",
      workspaceId: "ws-1",
      tagId: "missing-tag",
    })

    expect(messengerRunChannelHandler).not.toHaveBeenCalled()
    expect(zaloRunAction).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  test("messenger integration with syncTagEnabledAt=null is skipped", async () => {
    queryResults.tagModelFindFirst = { id: "tag-1", name: "VIP" }
    queryResults.integrationMessengerFindMany = [
      makeMessengerIntegration({ syncTagEnabledAt: null }),
    ]
    queryResults.integrationZaloFindMany = []

    await handleSyncTag({
      action: "create",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).not.toHaveBeenCalled()
    expect(runExclusive).not.toHaveBeenCalled()
  })

  test("messenger sync-enabled → createLabel called under distributedLock with pageId and name", async () => {
    const tag = { id: "tag-1", name: "VIP" }
    const integration = makeMessengerIntegration()
    queryResults.tagModelFindFirst = tag
    queryResults.integrationMessengerFindMany = [integration]
    queryResults.integrationZaloFindMany = []
    queryResults.tagChannelFindFirst = null // no existing tagChannel
    insertReturning.current = []

    await handleSyncTag({
      action: "create",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    // distributedLock used with correct key
    expect(runExclusive).toHaveBeenCalledOnce()
    const lockCall = (runExclusive as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0]
    expect(lockCall.key).toBe(
      `tag-channel:messenger:${integration.id}:${tag.id}`,
    )
    expect(lockCall.timeoutInSeconds).toBe(30)

    // createLabel called with exact pageId and name
    expect(messengerRunChannelHandler).toHaveBeenCalledWith(
      "bot",
      "createLabel",
      expect.objectContaining({
        ctx: fakeCtx,
        data: { pageId: integration.pageId, name: tag.name },
      }),
    )
  })

  test("messenger sync-enabled, existing tagChannel → update externalLabelId (no insert)", async () => {
    const tag = { id: "tag-1", name: "VIP" }
    const integration = makeMessengerIntegration()
    const existing = makeTagChannel()
    queryResults.tagModelFindFirst = tag
    queryResults.integrationMessengerFindMany = [integration]
    queryResults.integrationZaloFindMany = []
    queryResults.tagChannelFindFirst = existing

    messengerRunChannelHandler.mockResolvedValueOnce({ id: "label-new-456" })

    await handleSyncTag({
      action: "create",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    expect(db.update).toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  test("messenger createLabel failure is caught; warn logged; no throw", async () => {
    const tag = { id: "tag-1", name: "VIP" }
    queryResults.tagModelFindFirst = tag
    queryResults.integrationMessengerFindMany = [makeMessengerIntegration()]
    queryResults.integrationZaloFindMany = []
    // Make the lock fn throw (simulates createLabel failure propagating)
    runExclusive.mockRejectedValueOnce(new Error("FB 500"))

    await expect(
      handleSyncTag({ action: "create", workspaceId: "ws-1", tagId: "tag-1" }),
    ).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalled()
  })

  test("zalo sync-enabled → insert tagChannel with onConflictDoNothing and correct externalLabelId=tag.name", async () => {
    const tag = { id: "tag-1", name: "VIP" }
    const integration = makeZaloIntegration()
    queryResults.tagModelFindFirst = tag
    queryResults.integrationMessengerFindMany = []
    queryResults.integrationZaloFindMany = [integration]

    await handleSyncTag({
      action: "create",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    expect(db.insert).toHaveBeenCalled()
    const insertValuesCall = (insertChain.values as ReturnType<typeof vi.fn>)
      .mock.calls[0]?.[0]
    expect(insertValuesCall).toMatchObject({
      workspaceId: "ws-1",
      tagId: tag.id,
      channelType: "zalo",
      integrationId: integration.id,
      externalLabelId: tag.name,
    })
    // onConflictDoNothing must be called
    expect(insertChain.onConflictDoNothing).toHaveBeenCalled()
    // No real Zalo API called (no create-empty-tag API)
    expect(zaloRunAction).not.toHaveBeenCalled()
  })

  test("zalo sync disabled → skip insert", async () => {
    queryResults.tagModelFindFirst = { id: "tag-1", name: "VIP" }
    queryResults.integrationMessengerFindMany = []
    queryResults.integrationZaloFindMany = [
      makeZaloIntegration({ syncTagEnabledAt: null }),
    ]

    await handleSyncTag({
      action: "create",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    expect(db.insert).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// syncTagAttach
// ===========================================================================

describe("syncTagAttach", () => {
  test("tag not found → early return, no SDK calls", async () => {
    queryResults.tagModelFindFirst = null

    await handleSyncTag({
      action: "attach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "missing",
    })

    expect(messengerRunChannelHandler).not.toHaveBeenCalled()
    expect(zaloRunAction).not.toHaveBeenCalled()
  })

  test("messenger channel — TagChannel already exists → skip createLabel, call assignLabel with exact labelId and sourceId", async () => {
    const tag = { id: "tag-1", name: "VIP", workspaceId: "ws-1" }
    const contactInbox = makeContactInbox()
    const integration = makeMessengerIntegration()
    const existingTagChannel = makeTagChannel({
      externalLabelId: "label-ext-123",
    })

    queryResults.tagModelFindFirst = tag
    queryResults.contactInboxFindMany = [contactInbox]
    queryResults.integrationMessengerFindFirst = integration
    queryResults.tagChannelFindFirst = existingTagChannel
    insertReturning.current = []

    await handleSyncTag({
      action: "attach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    // createLabel must NOT be called (TagChannel already exists)
    expect(messengerRunChannelHandler).toHaveBeenCalledWith(
      "contact",
      "assignLabel",
      expect.objectContaining({
        ctx: fakeCtx,
        data: {
          labelId: existingTagChannel.externalLabelId,
          sourceId: contactInbox.sourceId,
        },
      }),
    )
    // createLabel not called
    const createLabelCalls = (
      messengerRunChannelHandler as ReturnType<typeof vi.fn>
    ).mock.calls.filter((c) => c[1] === "createLabel")
    expect(createLabelCalls).toHaveLength(0)
  })

  test("messenger channel — TagChannel does not exist → createLabel then insert then assignLabel", async () => {
    const tag = { id: "tag-1", name: "VIP", workspaceId: "ws-1" }
    const contactInbox = makeContactInbox()
    const integration = makeMessengerIntegration()
    const newTagChannel = makeTagChannel({ id: "tc-new" })

    queryResults.tagModelFindFirst = tag
    queryResults.contactInboxFindMany = [contactInbox]
    queryResults.integrationMessengerFindFirst = integration
    queryResults.tagChannelFindFirst = null
    insertReturning.current = [newTagChannel]

    messengerRunChannelHandler.mockResolvedValueOnce({ id: "label-new-789" })

    await handleSyncTag({
      action: "attach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    const createLabelCall = (
      messengerRunChannelHandler as ReturnType<typeof vi.fn>
    ).mock.calls.find((c) => c[1] === "createLabel")
    expect(createLabelCall).toBeDefined()
    expect(createLabelCall?.[2]).toMatchObject({
      ctx: fakeCtx,
      data: { pageId: integration.pageId, name: tag.name },
    })

    const assignLabelCall = (
      messengerRunChannelHandler as ReturnType<typeof vi.fn>
    ).mock.calls.find((c) => c[1] === "assignLabel")
    expect(assignLabelCall).toBeDefined()
  })

  test("messenger integration with syncTagEnabledAt=null → skip entirely", async () => {
    const tag = { id: "tag-1", name: "VIP", workspaceId: "ws-1" }
    const contactInbox = makeContactInbox()

    queryResults.tagModelFindFirst = tag
    queryResults.contactInboxFindMany = [contactInbox]
    queryResults.integrationMessengerFindFirst = makeMessengerIntegration({
      syncTagEnabledAt: null,
    })

    await handleSyncTag({
      action: "attach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).not.toHaveBeenCalled()
  })

  test("zalo channel — tagFollower called with correct userId and tagName", async () => {
    const tag = { id: "tag-1", name: "VIP", workspaceId: "ws-1" }
    const contactInbox = makeContactInbox({
      channel: "zalo",
      inboxId: "inbox-zalo-1",
      sourceId: "zalo-user-999",
    })
    const integration = makeZaloIntegration()
    const newTagChannel = makeTagChannel({
      id: "tc-zalo",
      channelType: "zalo",
      externalLabelId: "VIP",
    })

    queryResults.tagModelFindFirst = tag
    queryResults.contactInboxFindMany = [contactInbox]
    queryResults.integrationZaloFindFirst = integration
    insertReturning.current = [newTagChannel]

    await handleSyncTag({
      action: "attach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    expect(zaloRunAction).toHaveBeenCalledWith(
      "tagFollower",
      expect.objectContaining({
        ctx: fakeCtx,
        userId: contactInbox.sourceId,
        tagName: tag.name,
      }),
    )
  })

  test("zalo channel — onConflictDoUpdate upserts tagChannel", async () => {
    const tag = { id: "tag-1", name: "VIP", workspaceId: "ws-1" }
    const contactInbox = makeContactInbox({
      channel: "zalo",
      inboxId: "inbox-zalo-1",
      sourceId: "zalo-user-999",
    })
    const integration = makeZaloIntegration()
    const tagChannel = makeTagChannel({
      id: "tc-zalo",
      channelType: "zalo",
      externalLabelId: "VIP",
    })

    queryResults.tagModelFindFirst = tag
    queryResults.contactInboxFindMany = [contactInbox]
    queryResults.integrationZaloFindFirst = integration
    insertReturning.current = [tagChannel]

    await handleSyncTag({
      action: "attach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    expect(insertChain.onConflictDoUpdate).toHaveBeenCalled()
  })

  test("zalo integration with syncTagEnabledAt=null → skip tagFollower", async () => {
    const tag = { id: "tag-1", name: "VIP", workspaceId: "ws-1" }
    const contactInbox = makeContactInbox({
      channel: "zalo",
      inboxId: "inbox-zalo-1",
      sourceId: "zalo-user-999",
    })

    queryResults.tagModelFindFirst = tag
    queryResults.contactInboxFindMany = [contactInbox]
    queryResults.integrationZaloFindFirst = makeZaloIntegration({
      syncTagEnabledAt: null,
    })

    await handleSyncTag({
      action: "attach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    expect(zaloRunAction).not.toHaveBeenCalled()
  })

  test("contactInbox not on messenger or zalo channel → no SDK calls", async () => {
    const tag = { id: "tag-1", name: "VIP", workspaceId: "ws-1" }
    queryResults.tagModelFindFirst = tag
    queryResults.contactInboxFindMany = [
      makeContactInbox({ channel: "webchat" }),
    ]

    await handleSyncTag({
      action: "attach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).not.toHaveBeenCalled()
    expect(zaloRunAction).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// syncTagDetach
// ===========================================================================

describe("syncTagDetach", () => {
  test("messenger row — removeLabel called with correct labelId and sourceId", async () => {
    const row = {
      tagChannelId: "tc-1",
      contactInboxId: "ci-1",
      channelType: "messenger",
      integrationId: "intg-msg-1",
      externalLabelId: "label-ext-123",
      sourceId: "psid-abc",
    }
    queryResults.selectRows = [row]
    queryResults.integrationMessengerFindFirst = makeMessengerIntegration()

    await handleSyncTag({
      action: "detach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).toHaveBeenCalledWith(
      "contact",
      "removeLabel",
      expect.objectContaining({
        ctx: fakeCtx,
        data: {
          labelId: row.externalLabelId,
          sourceId: row.sourceId,
        },
      }),
    )
  })

  test("zalo row — removeFollowerFromTag called with correct userId and tagName", async () => {
    const row = {
      tagChannelId: "tc-z1",
      contactInboxId: "ci-z1",
      channelType: "zalo",
      integrationId: "intg-zalo-1",
      externalLabelId: "VIP",
      sourceId: "zalo-user-777",
    }
    queryResults.selectRows = [row]
    queryResults.integrationZaloFindFirst = makeZaloIntegration()

    await handleSyncTag({
      action: "detach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    expect(zaloRunAction).toHaveBeenCalledWith(
      "removeFollowerFromTag",
      expect.objectContaining({
        ctx: fakeCtx,
        userId: row.sourceId,
        tagName: row.externalLabelId,
      }),
    )
  })

  test("local ContactToTagChannel row deleted even when API call throws", async () => {
    const row = {
      tagChannelId: "tc-1",
      contactInboxId: "ci-1",
      channelType: "messenger",
      integrationId: "intg-msg-1",
      externalLabelId: "label-ext-123",
      sourceId: "psid-abc",
    }
    queryResults.selectRows = [row]
    queryResults.integrationMessengerFindFirst = makeMessengerIntegration()

    // Make removeLabel throw
    messengerRunChannelHandler.mockRejectedValueOnce(new Error("FB offline"))

    await expect(
      handleSyncTag({
        action: "detach",
        workspaceId: "ws-1",
        contactId: "contact-1",
        tagId: "tag-1",
      }),
    ).resolves.toBeUndefined()

    // Local delete still called
    expect(db.delete).toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  test("error isolation — first row API failure does not abort second row", async () => {
    const row1 = {
      tagChannelId: "tc-1",
      contactInboxId: "ci-1",
      channelType: "messenger",
      integrationId: "intg-msg-1",
      externalLabelId: "label-1",
      sourceId: "psid-1",
    }
    const row2 = {
      tagChannelId: "tc-2",
      contactInboxId: "ci-2",
      channelType: "messenger",
      integrationId: "intg-msg-1",
      externalLabelId: "label-2",
      sourceId: "psid-2",
    }
    queryResults.selectRows = [row1, row2]
    queryResults.integrationMessengerFindFirst = makeMessengerIntegration()

    // First API call fails, second should succeed
    messengerRunChannelHandler
      .mockRejectedValueOnce(new Error("FB timeout"))
      .mockResolvedValueOnce(undefined)

    await expect(
      handleSyncTag({
        action: "detach",
        workspaceId: "ws-1",
        contactId: "contact-1",
        tagId: "tag-1",
      }),
    ).resolves.toBeUndefined()

    // Both rows should have had delete called (2 times)
    expect(db.delete).toHaveBeenCalledTimes(2)
    // Second row's removeLabel was still attempted
    expect(messengerRunChannelHandler).toHaveBeenCalledTimes(2)
  })

  test("sync-disabled context (integration.syncTagEnabledAt=null) → no API call but local row still deleted", async () => {
    const row = {
      tagChannelId: "tc-1",
      contactInboxId: "ci-1",
      channelType: "messenger",
      integrationId: "intg-msg-1",
      externalLabelId: "label-ext-123",
      sourceId: "psid-abc",
    }
    queryResults.selectRows = [row]
    // Sync disabled
    queryResults.integrationMessengerFindFirst = makeMessengerIntegration({
      syncTagEnabledAt: null,
    })

    await handleSyncTag({
      action: "detach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).not.toHaveBeenCalled()
    // Local delete still runs
    expect(db.delete).toHaveBeenCalled()
  })

  test("empty rows → no delete, no API", async () => {
    queryResults.selectRows = []

    await handleSyncTag({
      action: "detach",
      workspaceId: "ws-1",
      contactId: "contact-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).not.toHaveBeenCalled()
    expect(zaloRunAction).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// syncTagDelete
// ===========================================================================

describe("syncTagDelete", () => {
  test("messenger channel → deleteLabel called with correct labelId", async () => {
    const channel = {
      channelType: "messenger",
      integrationId: "intg-msg-1",
      externalLabelId: "label-ext-123",
    }
    queryResults.tagChannelFindMany = [channel]
    queryResults.integrationMessengerFindFirst = makeMessengerIntegration()

    await handleSyncTag({
      action: "delete",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).toHaveBeenCalledWith(
      "bot",
      "deleteLabel",
      expect.objectContaining({
        ctx: fakeCtx,
        data: { labelId: channel.externalLabelId },
      }),
    )
    // tag row deleted
    expect(db.delete).toHaveBeenCalled()
  })

  test("zalo channel → removeTag called with correct tagName", async () => {
    const channel = {
      channelType: "zalo",
      integrationId: "intg-zalo-1",
      externalLabelId: "VIP",
    }
    queryResults.tagChannelFindMany = [channel]
    queryResults.integrationZaloFindFirst = makeZaloIntegration()

    await handleSyncTag({
      action: "delete",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    expect(zaloRunAction).toHaveBeenCalledWith(
      "removeTag",
      expect.objectContaining({
        ctx: fakeCtx,
        tagName: channel.externalLabelId,
      }),
    )
    expect(db.delete).toHaveBeenCalled()
  })

  test("error isolation — first channel delete failure does not abort second channel or tag delete", async () => {
    const ch1 = {
      channelType: "messenger",
      integrationId: "intg-msg-1",
      externalLabelId: "label-1",
    }
    const ch2 = {
      channelType: "messenger",
      integrationId: "intg-msg-2",
      externalLabelId: "label-2",
    }
    queryResults.tagChannelFindMany = [ch1, ch2]
    // First integration has sync enabled, second also
    queryResults.integrationMessengerFindFirst = makeMessengerIntegration()

    // First deleteLabel throws
    messengerRunChannelHandler
      .mockRejectedValueOnce(new Error("FB error"))
      .mockResolvedValueOnce(undefined)

    await expect(
      handleSyncTag({
        action: "delete",
        workspaceId: "ws-1",
        tagId: "tag-1",
      }),
    ).resolves.toBeUndefined()

    // Both channels attempted
    expect(messengerRunChannelHandler).toHaveBeenCalledTimes(2)
    // Tag row delete still called
    expect(db.delete).toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  test("sync-disabled context (syncTagEnabledAt=null) → skip API but still delete tag row", async () => {
    const channel = {
      channelType: "messenger",
      integrationId: "intg-msg-1",
      externalLabelId: "label-ext-123",
    }
    queryResults.tagChannelFindMany = [channel]
    queryResults.integrationMessengerFindFirst = makeMessengerIntegration({
      syncTagEnabledAt: null,
    })

    await handleSyncTag({
      action: "delete",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).not.toHaveBeenCalled()
    // Tag row still deleted
    expect(db.delete).toHaveBeenCalled()
  })

  test("no channels → only tag row deleted", async () => {
    queryResults.tagChannelFindMany = []

    await handleSyncTag({
      action: "delete",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).not.toHaveBeenCalled()
    expect(zaloRunAction).not.toHaveBeenCalled()
    expect(db.delete).toHaveBeenCalled()
  })

  test("multiple channels (messenger + zalo) — both API calls made then tag deleted", async () => {
    const messengerChannel = {
      channelType: "messenger",
      integrationId: "intg-msg-1",
      externalLabelId: "label-ext-123",
    }
    const zaloChannel = {
      channelType: "zalo",
      integrationId: "intg-zalo-1",
      externalLabelId: "VIP",
    }
    queryResults.tagChannelFindMany = [messengerChannel, zaloChannel]
    queryResults.integrationMessengerFindFirst = makeMessengerIntegration()
    queryResults.integrationZaloFindFirst = makeZaloIntegration()

    await handleSyncTag({
      action: "delete",
      workspaceId: "ws-1",
      tagId: "tag-1",
    })

    expect(messengerRunChannelHandler).toHaveBeenCalledWith(
      "bot",
      "deleteLabel",
      expect.anything(),
    )
    expect(zaloRunAction).toHaveBeenCalledWith("removeTag", expect.anything())
    expect(db.delete).toHaveBeenCalled()
  })
})
