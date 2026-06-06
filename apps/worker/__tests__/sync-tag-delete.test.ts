import { beforeEach, describe, expect, test, vi } from "vitest"

// ── db spies ──────────────────────────────────────────────────────────────────
const findManyTagChannel = vi.fn()
const findMessengerIntegrationFirst = vi.fn()
const findZaloIntegrationFirst = vi.fn()

// Track delete calls in order so we can assert on sequence and model identity.
const dbDeleteCalls: Array<{ model: unknown; condition: unknown }> = []

// ── channel API spies ─────────────────────────────────────────────────────────
const messengerDeleteLabel = vi.fn()
const zaloRemoveTag = vi.fn()

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      tagChannelModel: {
        findMany: (...args: unknown[]) => findManyTagChannel(...args),
      },
      integrationMessengerModel: {
        findFirst: (...args: unknown[]) =>
          findMessengerIntegrationFirst(...args),
      },
      integrationZaloModel: {
        findFirst: (...args: unknown[]) => findZaloIntegrationFirst(...args),
      },
      contactInboxModel: { findFirst: vi.fn().mockResolvedValue(null) },
    },
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

// Inline sentinel objects — avoids vi.mock hoisting / variable-capture issues.
vi.mock("@chatbotx.io/database/schema", () => ({
  contactToTagChannelModel: {
    __name: "ContactToTagChannel",
    tagId: "ContactToTagChannel.tagId",
    tagChannelId: "ContactToTagChannel.tagChannelId",
  },
  tagChannelModel: { __name: "TagChannel" },
  contactsToTagsModel: { __name: "ContactsToTags" },
  tagModel: { __name: "Tag", deletedAt: "Tag.deletedAt" },
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
      if (name === "deleteLabel") {
        return messengerDeleteLabel(...args)
      }
      return Promise.resolve()
    },
  },
}))

vi.mock("@chatbotx.io/integration-zalo", () => ({
  integration: {
    runAction: (name: unknown, ...args: unknown[]) => {
      if (name === "removeTag") {
        return zaloRemoveTag(...args)
      }
      return Promise.resolve()
    },
  },
}))

vi.mock("@chatbotx.io/redis", () => ({
  distributedLock: vi.fn((_key: unknown, fn: () => Promise<unknown>) => fn()),
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

const MESSENGER_CHANNEL = {
  id: "tc-1",
  channelType: "messenger",
  integrationId: "int-1",
  externalLabelId: "fb-label-123",
}
const ZALO_CHANNEL = {
  id: "tc-2",
  channelType: "zalo",
  integrationId: "zalo-int-1",
  externalLabelId: "VIP",
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

const runDelete = () =>
  handleSyncTag({ action: "delete", workspaceId: WS, tagId: TAG_ID })

// Helper: extract __name from a model sentinel
const modelName = (m: unknown) => (m as { __name: string }).__name

beforeEach(() => {
  findManyTagChannel.mockReset()
  findMessengerIntegrationFirst.mockReset()
  findZaloIntegrationFirst.mockReset()
  messengerDeleteLabel.mockReset()
  zaloRemoveTag.mockReset()
  dbDeleteCalls.length = 0

  findManyTagChannel.mockResolvedValue([])
  findMessengerIntegrationFirst.mockResolvedValue(ENABLED_MESSENGER)
  findZaloIntegrationFirst.mockResolvedValue(ENABLED_ZALO)
  messengerDeleteLabel.mockResolvedValue(undefined)
  zaloRemoveTag.mockResolvedValue(undefined)
})

describe("syncTagDelete — child cleanup order", () => {
  test("reads TagChannel rows for the tag before any delete", async () => {
    await runDelete()
    expect(findManyTagChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tagId: TAG_ID }),
      }),
    )
  })

  test("deletes ContactToTagChannel first (step 3)", async () => {
    await runDelete()
    expect(modelName(dbDeleteCalls[0]?.model)).toBe("ContactToTagChannel")
  })

  test("deletes TagChannel second (step 4)", async () => {
    await runDelete()
    expect(modelName(dbDeleteCalls[1]?.model)).toBe("TagChannel")
  })

  test("deletes ContactsToTags third (step 5)", async () => {
    await runDelete()
    expect(modelName(dbDeleteCalls[2]?.model)).toBe("ContactsToTags")
  })

  test("hard-deletes Tag last (step 6)", async () => {
    await runDelete()
    expect(modelName(dbDeleteCalls[3]?.model)).toBe("Tag")
  })

  test("deletion order: ContactToTagChannel → TagChannel → ContactsToTags → Tag", async () => {
    await runDelete()
    expect(dbDeleteCalls).toHaveLength(4)
    expect(dbDeleteCalls.map((c) => modelName(c.model))).toEqual([
      "ContactToTagChannel",
      "TagChannel",
      "ContactsToTags",
      "Tag",
    ])
  })

  test("hard-delete WHERE includes isNotNull(deletedAt) guard", async () => {
    await runDelete()
    const condStr = JSON.stringify(dbDeleteCalls[3]?.condition)
    expect(condStr).toContain("isNotNull")
  })
})

describe("syncTagDelete — ContactToTagChannel scoping", () => {
  test("no channels: deletes ContactToTagChannel by bare tagId (fallback)", async () => {
    findManyTagChannel.mockResolvedValue([])

    await runDelete()

    const condStr = JSON.stringify(dbDeleteCalls[0]?.condition)
    // fallback uses eq(tagId) not inArray(tagChannelId)
    expect(condStr).toContain("ContactToTagChannel.tagId")
    expect(condStr).not.toContain("inArray")
  })

  test("with channels: deletes ContactToTagChannel by tagChannelId via inArray", async () => {
    findManyTagChannel.mockResolvedValue([MESSENGER_CHANNEL, ZALO_CHANNEL])

    await runDelete()

    const condStr = JSON.stringify(dbDeleteCalls[0]?.condition)
    expect(condStr).toContain("inArray")
    expect(condStr).toContain("tc-1")
    expect(condStr).toContain("tc-2")
  })
})

describe("syncTagDelete — channel label deletion", () => {
  test("messenger channel: calls deleteLabel API with externalLabelId", async () => {
    findManyTagChannel.mockResolvedValue([MESSENGER_CHANNEL])

    await runDelete()

    expect(messengerDeleteLabel).toHaveBeenCalledTimes(1)
    expect(messengerDeleteLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          labelId: MESSENGER_CHANNEL.externalLabelId,
        }),
      }),
    )
  })

  test("zalo channel: calls removeTag API with externalLabelId", async () => {
    findManyTagChannel.mockResolvedValue([ZALO_CHANNEL])

    await runDelete()

    expect(zaloRemoveTag).toHaveBeenCalledTimes(1)
    expect(zaloRemoveTag).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: ZALO_CHANNEL.externalLabelId }),
    )
  })

  test("skips messenger label delete when integration sync disabled", async () => {
    findManyTagChannel.mockResolvedValue([MESSENGER_CHANNEL])
    findMessengerIntegrationFirst.mockResolvedValue({
      ...ENABLED_MESSENGER,
      syncTagEnabledAt: null,
    })

    await runDelete()

    expect(messengerDeleteLabel).not.toHaveBeenCalled()
    // DB cleanup still proceeds
    expect(dbDeleteCalls).toHaveLength(4)
  })

  test("continues DB cleanup even when channel API throws", async () => {
    findManyTagChannel.mockResolvedValue([MESSENGER_CHANNEL])
    messengerDeleteLabel.mockRejectedValue(new Error("Facebook API down"))

    await runDelete()

    expect(dbDeleteCalls).toHaveLength(4)
  })

  test("deletes labels on every channel before DB cleanup", async () => {
    findManyTagChannel.mockResolvedValue([MESSENGER_CHANNEL, ZALO_CHANNEL])

    await runDelete()

    expect(messengerDeleteLabel).toHaveBeenCalledTimes(1)
    expect(zaloRemoveTag).toHaveBeenCalledTimes(1)
    expect(dbDeleteCalls).toHaveLength(4)
  })
})
