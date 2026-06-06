import { beforeEach, describe, expect, test, vi } from "vitest"

// ── db spies ──────────────────────────────────────────────────────────────────
const findManyTagChannel = vi.fn()
const findManyContactToTagChannel = vi.fn()
const findManyContactsToTags = vi.fn()
const findManyContactInbox = vi.fn()
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
      contactToTagChannelModel: {
        findMany: (...args: unknown[]) => findManyContactToTagChannel(...args),
      },
      contactsToTagsModel: {
        findMany: (...args: unknown[]) => findManyContactsToTags(...args),
      },
      contactInboxModel: {
        findMany: (...args: unknown[]) => findManyContactInbox(...args),
      },
      integrationMessengerModel: {
        findFirst: (...args: unknown[]) =>
          findMessengerIntegrationFirst(...args),
      },
      integrationZaloModel: {
        findFirst: (...args: unknown[]) => findZaloIntegrationFirst(...args),
      },
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
    contactInboxId: "ContactToTagChannel.contactInboxId",
  },
  tagChannelModel: { __name: "TagChannel", id: "TagChannel.id" },
  contactsToTagsModel: {
    __name: "ContactsToTags",
    tagId: "ContactsToTags.tagId",
    contactId: "ContactsToTags.contactId",
  },
  tagModel: { __name: "Tag", id: "Tag.id", deletedAt: "Tag.deletedAt" },
  contactInboxModel: { __name: "ContactInbox" },
  integrationMessengerModel: { __name: "IntegrationMessenger" },
  integrationZaloModel: { __name: "IntegrationZalo" },
}))

vi.mock("@chatbotx.io/database/utils", () => ({
  // Single-pass chunkById: the query builder pages by id; with our small fixed
  // result sets it returns < chunkSize on the first call and stops.
  chunkById: async (
    queryBuilder: (lastId: string | null) => Promise<{ id: string }[]>,
    options: { callback: (rows: { id: string }[]) => Promise<unknown> },
  ) => {
    const rows = await queryBuilder(null)
    if (rows.length > 0) {
      await options.callback(rows)
    }
  },
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

const runScopedDelete = (channelType: string, integrationId: string) =>
  handleSyncTag({
    action: "delete",
    workspaceId: WS,
    tagId: TAG_ID,
    channelType: channelType as "messenger" | "zalo",
    integrationId,
  })

const modelName = (m: unknown) => (m as { __name: string }).__name
const deletedModelNames = () => dbDeleteCalls.map((c) => modelName(c.model))

beforeEach(() => {
  findManyTagChannel.mockReset()
  findManyContactToTagChannel.mockReset()
  findManyContactsToTags.mockReset()
  findManyContactInbox.mockReset()
  findMessengerIntegrationFirst.mockReset()
  findZaloIntegrationFirst.mockReset()
  messengerDeleteLabel.mockReset()
  zaloRemoveTag.mockReset()
  dbDeleteCalls.length = 0

  findManyTagChannel.mockResolvedValue([])
  findManyContactToTagChannel.mockResolvedValue([])
  findManyContactsToTags.mockResolvedValue([])
  findManyContactInbox.mockResolvedValue([])
  findMessengerIntegrationFirst.mockResolvedValue(ENABLED_MESSENGER)
  findZaloIntegrationFirst.mockResolvedValue(ENABLED_ZALO)
  messengerDeleteLabel.mockResolvedValue(undefined)
  zaloRemoveTag.mockResolvedValue(undefined)
})

// ============================================================================
// Full workspace delete (delete-tag-action): callApi=true + Tag row removed
// ============================================================================
describe("syncTagDelete — full workspace delete", () => {
  test("does NOT call any channel label API (temporarily disabled)", async () => {
    findManyTagChannel.mockResolvedValue([MESSENGER_CHANNEL, ZALO_CHANNEL])

    await runDelete()

    expect(messengerDeleteLabel).not.toHaveBeenCalled()
    expect(zaloRemoveTag).not.toHaveBeenCalled()
    // cleanup + Tag delete still happen
    expect(deletedModelNames().at(-1)).toBe("Tag")
  })

  test("hard-deletes the Tag row LAST, with the isNotNull(deletedAt) guard", async () => {
    findManyTagChannel.mockResolvedValue([MESSENGER_CHANNEL])

    await runDelete()

    const last = dbDeleteCalls.at(-1)
    expect(modelName(last?.model)).toBe("Tag")
    expect(JSON.stringify(last?.condition)).toContain("isNotNull")
  })

  test("per channel: deletes ContactToTagChannel + ContactsToTags + TagChannel, then Tag", async () => {
    findManyTagChannel.mockResolvedValue([MESSENGER_CHANNEL])
    findManyContactToTagChannel.mockResolvedValue([{ contactInboxId: "ci-1" }])
    findManyContactInbox.mockResolvedValue([{ contactId: "c-1" }])

    await runDelete()

    const names = deletedModelNames()
    expect(names).toContain("ContactToTagChannel")
    expect(names).toContain("ContactsToTags")
    expect(names).toContain("TagChannel")
    expect(names.at(-1)).toBe("Tag")
  })

  test("catch-all removes manually-applied ContactToTag (no channel mapping)", async () => {
    findManyTagChannel.mockResolvedValue([]) // tag never synced to a channel
    findManyContactsToTags.mockResolvedValue([{ contactId: "c-manual" }])

    await runDelete()

    const names = deletedModelNames()
    expect(names).toContain("ContactsToTags")
    expect(names.at(-1)).toBe("Tag")
  })

  test("no channels, no manual links → only the Tag row is deleted", async () => {
    findManyTagChannel.mockResolvedValue([])
    findManyContactsToTags.mockResolvedValue([])

    await runDelete()

    expect(deletedModelNames()).toEqual(["Tag"])
  })

  test("deletes the Tag regardless of integration sync state (API disabled)", async () => {
    findManyTagChannel.mockResolvedValue([MESSENGER_CHANNEL])
    findMessengerIntegrationFirst.mockResolvedValue({
      ...ENABLED_MESSENGER,
      syncTagEnabledAt: null,
    })

    await runDelete()

    expect(messengerDeleteLabel).not.toHaveBeenCalled()
    expect(deletedModelNames().at(-1)).toBe("Tag")
  })
})

// ============================================================================
// Channel-scoped delete (inbound webhook): no API, no Tag row
// ============================================================================
describe("syncTagDelete — channel-scoped (webhook)", () => {
  test("does NOT call the channel API and does NOT delete the Tag row", async () => {
    findManyTagChannel.mockResolvedValue([ZALO_CHANNEL])
    findManyContactToTagChannel.mockResolvedValue([{ contactInboxId: "ci-1" }])
    findManyContactInbox.mockResolvedValue([{ contactId: "c-1" }])

    await runScopedDelete("zalo", "zalo-int-1")

    // The channel already removed the label → no API call.
    expect(zaloRemoveTag).not.toHaveBeenCalled()
    expect(messengerDeleteLabel).not.toHaveBeenCalled()

    const names = deletedModelNames()
    expect(names).toContain("ContactToTagChannel")
    expect(names).toContain("ContactsToTags")
    expect(names).toContain("TagChannel")
    // Tag row is kept.
    expect(names).not.toContain("Tag")
  })

  test("no-op when the tag is not mapped on that channel", async () => {
    findManyTagChannel.mockResolvedValue([])

    await runScopedDelete("zalo", "zalo-int-1")

    expect(dbDeleteCalls).toHaveLength(0)
  })
})
