import { beforeEach, describe, expect, test, vi } from "vitest"

// ── select chain spy ──────────────────────────────────────────────────────────
// syncTagDetach builds: db.select(...).from(...).innerJoin(...).innerJoin(...).where(...)
const selectWhere = vi.fn()

// ── delete spy ────────────────────────────────────────────────────────────────
const dbDeleteCalls: Array<{ model: unknown; condition: unknown }> = []

// ── integration context resolution ────────────────────────────────────────────
const findMessengerIntegrationFirst = vi.fn()
const findZaloIntegrationFirst = vi.fn()

// ── channel API spies ─────────────────────────────────────────────────────────
const messengerRemoveLabel = vi.fn()
const zaloRemoveFollower = vi.fn()

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      integrationMessengerModel: {
        findFirst: (...args: unknown[]) =>
          findMessengerIntegrationFirst(...args),
      },
      integrationZaloModel: {
        findFirst: (...args: unknown[]) => findZaloIntegrationFirst(...args),
      },
    },
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            where: (cond: unknown) => selectWhere(cond),
          }),
        }),
      }),
    }),
    delete: (model: unknown) => ({
      where: (cond: unknown) => {
        dbDeleteCalls.push({ model, condition: cond })
        return Promise.resolve()
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
  tagChannelModel: {
    __name: "TagChannel",
    id: "TagChannel.id",
    channelType: "TagChannel.channelType",
    integrationId: "TagChannel.integrationId",
    externalLabelId: "TagChannel.externalLabelId",
  },
  contactToTagChannelModel: {
    __name: "ContactToTagChannel",
    tagId: "ContactToTagChannel.tagId",
    tagChannelId: "ContactToTagChannel.tagChannelId",
    contactInboxId: "ContactToTagChannel.contactInboxId",
  },
  contactInboxModel: {
    __name: "ContactInbox",
    id: "ContactInbox.id",
    contactId: "ContactInbox.contactId",
    sourceId: "ContactInbox.sourceId",
  },
  integrationMessengerModel: { __name: "IntegrationMessenger" },
  integrationZaloModel: { __name: "IntegrationZalo" },
}))

vi.mock("@chatbotx.io/business", () => ({
  buildContext: vi.fn().mockResolvedValue({ auth: {}, workspaceId: "ws-1" }),
}))

vi.mock("@chatbotx.io/integration-messenger", () => ({
  integration: {
    runChannelHandler: (_group: unknown, name: unknown, ...args: unknown[]) => {
      if (name === "removeLabel") {
        return messengerRemoveLabel(...args)
      }
      return Promise.resolve()
    },
  },
}))

vi.mock("@chatbotx.io/integration-zalo", () => ({
  integration: {
    runAction: (name: unknown, ...args: unknown[]) => {
      if (name === "removeFollowerFromTag") {
        return zaloRemoveFollower(...args)
      }
      return Promise.resolve()
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
const CONTACT_ID = "contact-1"

const MESSENGER_ROW = {
  tagChannelId: "tc-1",
  contactInboxId: "ci-1",
  channelType: "messenger",
  integrationId: "int-1",
  externalLabelId: "fb-label-123",
  sourceId: "psid-1",
}
const ZALO_ROW = {
  tagChannelId: "tc-zalo-1",
  contactInboxId: "ci-2",
  channelType: "zalo",
  integrationId: "zalo-int-1",
  externalLabelId: "VIP",
  sourceId: "zalo-uid-1",
}

const ENABLED_MESSENGER = {
  id: "int-1",
  syncTagEnabledAt: new Date(),
  auth: {},
}
const ENABLED_ZALO = {
  id: "zalo-int-1",
  syncTagEnabledAt: new Date(),
  auth: {},
}

const runDetach = () =>
  handleSyncTag({
    action: "detach",
    workspaceId: WS,
    tagId: TAG_ID,
    contactId: CONTACT_ID,
  })

beforeEach(() => {
  selectWhere.mockReset()
  findMessengerIntegrationFirst.mockReset()
  findZaloIntegrationFirst.mockReset()
  messengerRemoveLabel.mockReset()
  zaloRemoveFollower.mockReset()
  dbDeleteCalls.length = 0

  selectWhere.mockResolvedValue([])
  findMessengerIntegrationFirst.mockResolvedValue(ENABLED_MESSENGER)
  findZaloIntegrationFirst.mockResolvedValue(ENABLED_ZALO)
  messengerRemoveLabel.mockResolvedValue(undefined)
  zaloRemoveFollower.mockResolvedValue(undefined)
})

describe("syncTagDetach", () => {
  test("no mapping rows: no API calls, no deletes", async () => {
    selectWhere.mockResolvedValue([])

    await runDetach()

    expect(messengerRemoveLabel).not.toHaveBeenCalled()
    expect(zaloRemoveFollower).not.toHaveBeenCalled()
    expect(dbDeleteCalls).toHaveLength(0)
  })

  test("messenger row: calls removeLabel then deletes mapping", async () => {
    selectWhere.mockResolvedValue([MESSENGER_ROW])

    await runDetach()

    expect(messengerRemoveLabel).toHaveBeenCalledTimes(1)
    expect(messengerRemoveLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          labelId: MESSENGER_ROW.externalLabelId,
          sourceId: MESSENGER_ROW.sourceId,
        }),
      }),
    )
    expect(dbDeleteCalls).toHaveLength(1)
  })

  test("zalo row: calls removeFollowerFromTag then deletes mapping", async () => {
    selectWhere.mockResolvedValue([ZALO_ROW])

    await runDetach()

    expect(zaloRemoveFollower).toHaveBeenCalledTimes(1)
    expect(zaloRemoveFollower).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ZALO_ROW.sourceId,
        tagName: ZALO_ROW.externalLabelId,
      }),
    )
    expect(dbDeleteCalls).toHaveLength(1)
  })

  test("deletes local mapping even when channel API throws", async () => {
    selectWhere.mockResolvedValue([MESSENGER_ROW])
    messengerRemoveLabel.mockRejectedValue(new Error("Facebook API down"))

    await runDetach()

    // API failed but the local mapping is still deleted
    expect(dbDeleteCalls).toHaveLength(1)
  })

  test("skips messenger API when integration sync disabled, still deletes mapping", async () => {
    selectWhere.mockResolvedValue([MESSENGER_ROW])
    findMessengerIntegrationFirst.mockResolvedValue({
      ...ENABLED_MESSENGER,
      syncTagEnabledAt: null,
    })

    await runDetach()

    expect(messengerRemoveLabel).not.toHaveBeenCalled()
    expect(dbDeleteCalls).toHaveLength(1)
  })

  test("skips zalo API when integration sync disabled, still deletes mapping", async () => {
    selectWhere.mockResolvedValue([ZALO_ROW])
    findZaloIntegrationFirst.mockResolvedValue({
      ...ENABLED_ZALO,
      syncTagEnabledAt: null,
    })

    await runDetach()

    expect(zaloRemoveFollower).not.toHaveBeenCalled()
    expect(dbDeleteCalls).toHaveLength(1)
  })

  test("processes multiple rows: one delete per row", async () => {
    selectWhere.mockResolvedValue([MESSENGER_ROW, ZALO_ROW])

    await runDetach()

    expect(messengerRemoveLabel).toHaveBeenCalledTimes(1)
    expect(zaloRemoveFollower).toHaveBeenCalledTimes(1)
    expect(dbDeleteCalls).toHaveLength(2)
  })

  test("delete is scoped by tagChannelId AND contactInboxId", async () => {
    selectWhere.mockResolvedValue([MESSENGER_ROW])

    await runDetach()

    const condStr = JSON.stringify(dbDeleteCalls[0]?.condition)
    expect(condStr).toContain("tc-1")
    expect(condStr).toContain("ci-1")
  })

  test("continues to second row when first row API throws", async () => {
    selectWhere.mockResolvedValue([MESSENGER_ROW, ZALO_ROW])
    messengerRemoveLabel.mockRejectedValue(new Error("boom"))

    await runDetach()

    // Both rows still deleted; zalo API still called
    expect(zaloRemoveFollower).toHaveBeenCalledTimes(1)
    expect(dbDeleteCalls).toHaveLength(2)
  })
})
