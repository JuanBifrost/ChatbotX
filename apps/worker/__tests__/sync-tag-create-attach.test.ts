import { beforeEach, describe, expect, test, vi } from "vitest"

// ── Query spies ───────────────────────────────────────────────────────────────
const findTagFirst = vi.fn()
const findManyMessengerIntegrations = vi.fn()
const findManyZaloIntegrations = vi.fn()
const findTagChannelFirst = vi.fn()
const findManyContactInboxes = vi.fn()
const findMessengerIntegrationFirst = vi.fn()
const findZaloIntegrationFirst = vi.fn()

// ── Mutation spies ────────────────────────────────────────────────────────────
const insertValues = vi.fn()
const insertReturning = vi.fn()
const updateSet = vi.fn()
const updateWhere = vi.fn()

// ── Integration API spies ─────────────────────────────────────────────────────
const messengerCreateLabel = vi.fn()
const messengerAssignLabel = vi.fn()
const zaloTagFollower = vi.fn()
const zaloRunAction = vi.fn()

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      tagModel: { findFirst: (...args: unknown[]) => findTagFirst(...args) },
      integrationMessengerModel: {
        findMany: (...args: unknown[]) =>
          findManyMessengerIntegrations(...args),
        findFirst: (...args: unknown[]) =>
          findMessengerIntegrationFirst(...args),
      },
      integrationZaloModel: {
        findMany: (...args: unknown[]) => findManyZaloIntegrations(...args),
        findFirst: (...args: unknown[]) => findZaloIntegrationFirst(...args),
      },
      tagChannelModel: {
        findFirst: (...args: unknown[]) => findTagChannelFirst(...args),
      },
      contactInboxModel: {
        findMany: (...args: unknown[]) => findManyContactInboxes(...args),
      },
    },
    insert: () => ({
      values: (vals: unknown) => {
        insertValues(vals)
        return {
          onConflictDoNothing: () => ({
            returning: () => insertReturning(),
          }),
          onConflictDoUpdate: () => ({
            returning: () => insertReturning(),
          }),
        }
      },
    }),
    update: () => ({
      set: (vals: unknown) => {
        updateSet(vals)
        return {
          where: (cond: unknown) => {
            updateWhere(cond)
            return Promise.resolve()
          },
        }
      },
    }),
  },
  and: (...args: unknown[]) => ({ and: args }),
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  inArray: (col: unknown, vals: unknown) => ({ inArray: [col, vals] }),
  isNotNull: (col: unknown) => ({ isNotNull: col }),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  tagModel: { __name: "Tag" },
  tagChannelModel: { __name: "TagChannel" },
  contactToTagChannelModel: { __name: "ContactToTagChannel" },
  contactInboxModel: { __name: "ContactInbox" },
  integrationMessengerModel: { __name: "IntegrationMessenger" },
  integrationZaloModel: { __name: "IntegrationZalo" },
}))

vi.mock("@chatbotx.io/business", () => ({
  buildContext: vi.fn().mockResolvedValue({ auth: {}, workspaceId: "ws-1" }),
}))

vi.mock("@chatbotx.io/integration-messenger", () => ({
  integration: {
    runChannelHandler: (_group: unknown, name: unknown, ...args: unknown[]) => {
      if (name === "createLabel") {
        return messengerCreateLabel(...args)
      }
      if (name === "assignLabel") {
        return messengerAssignLabel(...args)
      }
      return Promise.resolve()
    },
  },
}))

vi.mock("@chatbotx.io/integration-zalo", () => ({
  integration: {
    runAction: (name: unknown, ...args: unknown[]) => {
      if (name === "tagFollower") {
        return zaloTagFollower(...args)
      }
      return zaloRunAction(name, ...args)
    },
  },
}))

vi.mock("@chatbotx.io/redis", () => ({
  distributedLock: {
    runExclusive: vi.fn(({ fn }: { fn: () => Promise<unknown> }) => fn()),
  },
}))

vi.mock("@chatbotx.io/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chatbotx.io/utils")>()
  return { ...actual, createId: () => "generated-id" }
})

vi.mock("@chatbotx.io/database/partials", async () => {
  const actual = await vi.importActual<
    typeof import("@chatbotx.io/database/partials")
  >("@chatbotx.io/database/partials")
  return actual
})

vi.mock("../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { handleSyncTag } = await import("../src/default/handlers/sync-tag")

const WS = "ws-1"
const TAG_ID = "tag-42"
const INTEGRATION_ID = "int-1"
const TAG = { id: TAG_ID, name: "VIP" }
const MESSENGER_INTEGRATION = {
  id: INTEGRATION_ID,
  inboxId: "inbox-1",
  pageId: "page-1",
  syncTagEnabledAt: new Date(),
  workspaceId: WS,
  auth: {},
}
const ZALO_INTEGRATION = {
  id: "zalo-int-1",
  inboxId: "zalo-inbox-1",
  syncTagEnabledAt: new Date(),
  workspaceId: WS,
  auth: {},
}
const TAG_CHANNEL = {
  id: "tc-1",
  externalLabelId: "fb-label-123",
  tagId: TAG_ID,
  workspaceId: WS,
  channelType: "messenger",
  integrationId: INTEGRATION_ID,
}
const MESSENGER_CONTACT_INBOX = {
  id: "ci-1",
  contactId: "contact-1",
  inboxId: "inbox-1",
  channel: "messenger",
  sourceId: "psid-1",
}
const ZALO_CONTACT_INBOX = {
  id: "ci-2",
  contactId: "contact-1",
  inboxId: "zalo-inbox-1",
  channel: "zalo",
  sourceId: "zalo-uid-1",
}

beforeEach(() => {
  findTagFirst.mockReset()
  findManyMessengerIntegrations.mockReset()
  findManyZaloIntegrations.mockReset()
  findTagChannelFirst.mockReset()
  findManyContactInboxes.mockReset()
  findMessengerIntegrationFirst.mockReset()
  findZaloIntegrationFirst.mockReset()
  insertValues.mockReset()
  insertReturning.mockReset()
  updateSet.mockReset()
  updateWhere.mockReset()
  messengerCreateLabel.mockReset()
  messengerAssignLabel.mockReset()
  zaloTagFollower.mockReset()
  zaloRunAction.mockReset()

  findManyMessengerIntegrations.mockResolvedValue([])
  findManyZaloIntegrations.mockResolvedValue([])
  messengerCreateLabel.mockResolvedValue({ id: "fb-label-123", name: "VIP" })
  messengerAssignLabel.mockResolvedValue(undefined)
  zaloTagFollower.mockResolvedValue(undefined)
  insertReturning.mockResolvedValue([TAG_CHANNEL])
})

// ── syncTagCreate / createMessengerLabel ──────────────────────────────────────
describe("syncTagCreate — Messenger (createMessengerLabel)", () => {
  const runCreate = () =>
    handleSyncTag({ action: "create", workspaceId: WS, tagId: TAG_ID })

  test("always calls createLabel API regardless of existing TagChannel", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyMessengerIntegrations.mockResolvedValue([MESSENGER_INTEGRATION])
    findTagChannelFirst.mockResolvedValue(TAG_CHANNEL)

    await runCreate()

    expect(messengerCreateLabel).toHaveBeenCalledTimes(1)
  })

  test("when TagChannel exists: updates externalLabelId, does NOT insert", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyMessengerIntegrations.mockResolvedValue([MESSENGER_INTEGRATION])
    findTagChannelFirst.mockResolvedValue(TAG_CHANNEL)
    messengerCreateLabel.mockResolvedValue({ id: "new-fb-label", name: "VIP" })

    await runCreate()

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ externalLabelId: "new-fb-label" }),
    )
    expect(insertValues).not.toHaveBeenCalled()
  })

  test("when TagChannel does not exist: inserts new row, does NOT update", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyMessengerIntegrations.mockResolvedValue([MESSENGER_INTEGRATION])
    findTagChannelFirst.mockResolvedValue(null)

    await runCreate()

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tagId: TAG_ID,
        externalLabelId: "fb-label-123",
        channelType: "messenger",
        integrationId: INTEGRATION_ID,
      }),
    )
    expect(updateSet).not.toHaveBeenCalled()
  })

  test("skips integration with syncTagEnabledAt = null", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyMessengerIntegrations.mockResolvedValue([
      { ...MESSENGER_INTEGRATION, syncTagEnabledAt: null },
    ])

    await runCreate()

    expect(messengerCreateLabel).not.toHaveBeenCalled()
  })

  test("returns early when tag not found", async () => {
    findTagFirst.mockResolvedValue(null)

    await runCreate()

    expect(messengerCreateLabel).not.toHaveBeenCalled()
    expect(findManyMessengerIntegrations).not.toHaveBeenCalled()
  })

  test("continues to next integration when one throws", async () => {
    const INT_2 = { ...MESSENGER_INTEGRATION, id: "int-2" }
    findTagFirst.mockResolvedValue(TAG)
    findManyMessengerIntegrations.mockResolvedValue([
      MESSENGER_INTEGRATION,
      INT_2,
    ])
    findTagChannelFirst.mockResolvedValue(null)
    messengerCreateLabel
      .mockRejectedValueOnce(new Error("Facebook API error"))
      .mockResolvedValueOnce({ id: "fb-2", name: "VIP" })

    await runCreate()

    expect(messengerCreateLabel).toHaveBeenCalledTimes(2)
  })

  test("calls createLabel once per enabled integration", async () => {
    const INT_2 = { ...MESSENGER_INTEGRATION, id: "int-2" }
    findTagFirst.mockResolvedValue(TAG)
    findManyMessengerIntegrations.mockResolvedValue([
      MESSENGER_INTEGRATION,
      INT_2,
    ])
    findTagChannelFirst.mockResolvedValue(null)

    await runCreate()

    expect(messengerCreateLabel).toHaveBeenCalledTimes(2)
  })
})

// ── syncTagCreate — Zalo ──────────────────────────────────────────────────────
describe("syncTagCreate — Zalo (no API, insert tagChannel mapping)", () => {
  const runCreate = () =>
    handleSyncTag({ action: "create", workspaceId: WS, tagId: TAG_ID })

  test("inserts tagChannelModel for Zalo using tag name as externalLabelId", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyZaloIntegrations.mockResolvedValue([ZALO_INTEGRATION])

    await runCreate()

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tagId: TAG_ID,
        channelType: "zalo",
        integrationId: ZALO_INTEGRATION.id,
        externalLabelId: TAG.name,
      }),
    )
  })

  test("no Zalo API call — just DB insert", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyZaloIntegrations.mockResolvedValue([ZALO_INTEGRATION])

    await runCreate()

    expect(zaloRunAction).not.toHaveBeenCalled()
    expect(zaloTagFollower).not.toHaveBeenCalled()
  })

  test("skips Zalo integration with syncTagEnabledAt = null", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyZaloIntegrations.mockResolvedValue([
      { ...ZALO_INTEGRATION, syncTagEnabledAt: null },
    ])

    await runCreate()

    expect(insertValues).not.toHaveBeenCalled()
  })

  test("inserts for each enabled Zalo integration", async () => {
    const ZALO_2 = { ...ZALO_INTEGRATION, id: "zalo-int-2" }
    findTagFirst.mockResolvedValue(TAG)
    findManyZaloIntegrations.mockResolvedValue([ZALO_INTEGRATION, ZALO_2])

    await runCreate()

    expect(insertValues).toHaveBeenCalledTimes(2)
  })
})

// ── syncTagAttach — Messenger ─────────────────────────────────────────────────
describe("syncTagAttach — Messenger (attachOnMessenger)", () => {
  const runAttach = () =>
    handleSyncTag({
      action: "attach",
      workspaceId: WS,
      tagId: TAG_ID,
      contactId: "contact-1",
    })

  const setupMessengerAttach = () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyContactInboxes.mockResolvedValue([MESSENGER_CONTACT_INBOX])
    findMessengerIntegrationFirst.mockResolvedValue(MESSENGER_INTEGRATION)
    findTagChannelFirst.mockResolvedValue(TAG_CHANNEL)
  }

  test("does NOT call createLabel when TagChannel already exists", async () => {
    setupMessengerAttach()

    await runAttach()

    expect(messengerCreateLabel).not.toHaveBeenCalled()
  })

  test("calls createLabel when TagChannel does not exist", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyContactInboxes.mockResolvedValue([MESSENGER_CONTACT_INBOX])
    findMessengerIntegrationFirst.mockResolvedValue(MESSENGER_INTEGRATION)
    findTagChannelFirst
      .mockResolvedValueOnce(null) // lock: no existing → create
      .mockResolvedValue(null) // fallback findFirst after conflict
    insertReturning.mockResolvedValueOnce([TAG_CHANNEL]) // insert returns row

    await runAttach()

    expect(messengerCreateLabel).toHaveBeenCalledTimes(1)
  })

  test("always calls assignLabel after resolving TagChannel", async () => {
    setupMessengerAttach()

    await runAttach()

    expect(messengerAssignLabel).toHaveBeenCalledTimes(1)
    expect(messengerAssignLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          labelId: TAG_CHANNEL.externalLabelId,
          sourceId: MESSENGER_CONTACT_INBOX.sourceId,
        }),
      }),
    )
  })

  test("inserts contactToTagChannel row after assignLabel", async () => {
    setupMessengerAttach()

    await runAttach()

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tagId: TAG_ID,
        tagChannelId: TAG_CHANNEL.id,
        contactInboxId: MESSENGER_CONTACT_INBOX.id,
      }),
    )
  })

  test("skips when tagChannel cannot be resolved (lock returns null)", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyContactInboxes.mockResolvedValue([MESSENGER_CONTACT_INBOX])
    findMessengerIntegrationFirst.mockResolvedValue(MESSENGER_INTEGRATION)
    findTagChannelFirst.mockResolvedValue(null)
    insertReturning.mockResolvedValue([]) // insert conflict, nothing returned

    await runAttach()

    expect(messengerAssignLabel).not.toHaveBeenCalled()
  })

  test("skips when integration has syncTagEnabledAt = null", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyContactInboxes.mockResolvedValue([MESSENGER_CONTACT_INBOX])
    findMessengerIntegrationFirst.mockResolvedValue({
      ...MESSENGER_INTEGRATION,
      syncTagEnabledAt: null,
    })

    await runAttach()

    expect(messengerAssignLabel).not.toHaveBeenCalled()
  })

  test("skips when tag not found", async () => {
    findTagFirst.mockResolvedValue(null)

    await runAttach()

    expect(messengerAssignLabel).not.toHaveBeenCalled()
  })

  test("skips when no contact inboxes", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyContactInboxes.mockResolvedValue([])

    await runAttach()

    expect(messengerAssignLabel).not.toHaveBeenCalled()
  })
})

// ── syncTagAttach — Zalo ──────────────────────────────────────────────────────
describe("syncTagAttach — Zalo (attachOnZalo)", () => {
  const runAttach = () =>
    handleSyncTag({
      action: "attach",
      workspaceId: WS,
      tagId: TAG_ID,
      contactId: "contact-1",
    })

  const ZALO_TAG_CHANNEL = {
    id: "tc-zalo-1",
    externalLabelId: TAG.name,
    tagId: TAG_ID,
    workspaceId: WS,
    channelType: "zalo",
    integrationId: ZALO_INTEGRATION.id,
  }

  const setupZaloAttach = () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyContactInboxes.mockResolvedValue([ZALO_CONTACT_INBOX])
    findZaloIntegrationFirst.mockResolvedValue(ZALO_INTEGRATION)
    insertReturning.mockResolvedValue([ZALO_TAG_CHANNEL])
  }

  test("calls tagFollower Zalo action", async () => {
    setupZaloAttach()

    await runAttach()

    expect(zaloTagFollower).toHaveBeenCalledTimes(1)
    expect(zaloTagFollower).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ZALO_CONTACT_INBOX.sourceId,
        tagName: TAG.name,
      }),
    )
  })

  test("upserts tagChannelModel with onConflictDoUpdate", async () => {
    setupZaloAttach()

    await runAttach()

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tagId: TAG_ID,
        channelType: "zalo",
        integrationId: ZALO_INTEGRATION.id,
        externalLabelId: TAG.name,
      }),
    )
  })

  test("inserts contactToTagChannel row after upsert", async () => {
    setupZaloAttach()

    await runAttach()

    // Second insert call is for contactToTagChannelModel
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tagId: TAG_ID,
        tagChannelId: ZALO_TAG_CHANNEL.id,
        contactInboxId: ZALO_CONTACT_INBOX.id,
      }),
    )
  })

  test("skips contactToTagChannel insert when tagChannel upsert returns nothing", async () => {
    setupZaloAttach()
    insertReturning.mockResolvedValue([]) // upsert returns empty (unexpected)

    await runAttach()

    // Only the tagChannel insert fires; no contactToTagChannel insert
    expect(insertValues).toHaveBeenCalledTimes(1)
  })

  test("skips when integration has syncTagEnabledAt = null", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyContactInboxes.mockResolvedValue([ZALO_CONTACT_INBOX])
    findZaloIntegrationFirst.mockResolvedValue({
      ...ZALO_INTEGRATION,
      syncTagEnabledAt: null,
    })

    await runAttach()

    expect(zaloTagFollower).not.toHaveBeenCalled()
  })

  test("routes messenger and zalo inboxes independently in the same attach", async () => {
    findTagFirst.mockResolvedValue(TAG)
    findManyContactInboxes.mockResolvedValue([
      MESSENGER_CONTACT_INBOX,
      ZALO_CONTACT_INBOX,
    ])
    findMessengerIntegrationFirst.mockResolvedValue(MESSENGER_INTEGRATION)
    findTagChannelFirst.mockResolvedValue(TAG_CHANNEL)
    findZaloIntegrationFirst.mockResolvedValue(ZALO_INTEGRATION)
    insertReturning.mockResolvedValue([TAG_CHANNEL])

    await runAttach()

    expect(messengerAssignLabel).toHaveBeenCalledTimes(1)
    expect(zaloTagFollower).toHaveBeenCalledTimes(1)
  })
})

// ── handleSyncTag dispatch ────────────────────────────────────────────────────
describe("handleSyncTag — dispatch", () => {
  test("logs warning for unknown action", async () => {
    const { logger } = await import("../src/lib/logger")
    // @ts-expect-error - testing unknown action
    await handleSyncTag({ action: "unknown", workspaceId: WS, tagId: TAG_ID })
    expect(logger.warn).toHaveBeenCalled()
  })
})
