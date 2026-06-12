import { beforeEach, describe, expect, test, vi } from "vitest"

// ── db spies ──────────────────────────────────────────────────────────────────
const findManyBroadcast = vi.fn()
const findManyContactsOnBroadcasts = vi.fn()

type UpdateCall = {
  table: unknown
  values: Record<string, unknown>
  condition: unknown
}
const updateCalls: UpdateCall[] = []

// ── queue spies ───────────────────────────────────────────────────────────────
const chatAddSpy = vi.fn()
const integrationAddSpy = vi.fn()

// ── logger spy ────────────────────────────────────────────────────────────────
const loggerErrorSpy = vi.fn()

// ── mocks ─────────────────────────────────────────────────────────────────────
vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      broadcastModel: {
        findMany: (...args: unknown[]) => findManyBroadcast(...args),
      },
      contactsOnBroadcastsModel: {
        findMany: (...args: unknown[]) => findManyContactsOnBroadcasts(...args),
      },
    },
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => {
          updateCalls.push({ table, values, condition })
          return Promise.resolve()
        },
      }),
    }),
  },
  and: (...args: unknown[]) => ({ __and: args }),
  eq: (a: unknown, b: unknown) => ({ __eq: [a, b] }),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  broadcastModel: { id: "broadcast.id", __name: "broadcastModel" },
  contactsOnBroadcastsModel: {
    broadcastId: "cob.broadcastId",
    contactId: "cob.contactId",
    __name: "contactsOnBroadcastsModel",
  },
}))

vi.mock("@chatbotx.io/database/partials", () => ({
  broadcastStatuses: {
    enum: { scheduled: "scheduled", sending: "sending", sent: "sent" },
  },
  channelTypes: {
    enum: {
      omnichannel: "omnichannel",
      whatsapp: "whatsapp",
      messenger: "messenger",
    },
  },
}))

vi.mock("@chatbotx.io/flow-config", () => ({
  BROADCAST_PAYLOAD_TYPE: "broadcast",
}))

vi.mock("@chatbotx.io/worker-config", () => ({
  chatQueue: {
    add: (...args: unknown[]) => chatAddSpy(...args),
  },
  integrationQueue: {
    add: (...args: unknown[]) => integrationAddSpy(...args),
  },
  ChatJobAction: {
    sendWhatsappTemplateMessage: "sendWhatsappTemplateMessage",
    sendMessengerTemplateMessage: "sendMessengerTemplateMessage",
  },
  IntegrationJobAction: {
    sendFlow: "sendFlow",
  },
}))

vi.mock("../src/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => loggerErrorSpy(...args),
  },
}))

const { processBroadcastContacts } = await import(
  "../src/schedule/handlers/process-broadcast-contacts"
)

// ── helpers ───────────────────────────────────────────────────────────────────
const BROADCAST_ID = "broadcast-1"
const WORKSPACE_ID = "workspace-1"

const makeConversation = (id = "conv-1", contactId = "contact-1") => ({
  id,
  contactId,
  workspaceId: WORKSPACE_ID,
})

const makeContactInbox = (id = "ci-1") => ({ id })

const makeContactOnBroadcast = (overrides: Record<string, unknown> = {}) => ({
  broadcastId: BROADCAST_ID,
  contactId: "contact-1",
  contactInboxId: "ci-1",
  conversationId: "conv-1",
  sent: false,
  conversation: makeConversation(),
  contactInbox: makeContactInbox(),
  ...overrides,
})

const makeBroadcast = (overrides: Record<string, unknown> = {}) => ({
  id: BROADCAST_ID,
  workspaceId: WORKSPACE_ID,
  status: "sending",
  flowId: null as string | null,
  templateId: null as string | null,
  channel: null as string | null,
  templateData: null as unknown,
  ...overrides,
})

// ── setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  updateCalls.length = 0
  findManyBroadcast.mockResolvedValue([])
  findManyContactsOnBroadcasts.mockResolvedValue([])
  chatAddSpy.mockResolvedValue(undefined)
  integrationAddSpy.mockResolvedValue(undefined)
})

// ── tests ─────────────────────────────────────────────────────────────────────
describe("processBroadcastContacts", () => {
  describe("no broadcasts in 'sending' status", () => {
    test("returns { processed: 0 } without any db updates or queue adds", async () => {
      findManyBroadcast.mockResolvedValue([])

      const result = await processBroadcastContacts()

      expect(result).toEqual({ processed: 0 })
      expect(updateCalls).toHaveLength(0)
      expect(chatAddSpy).not.toHaveBeenCalled()
      expect(integrationAddSpy).not.toHaveBeenCalled()
    })
  })

  describe("broadcast has no unsent contacts", () => {
    test("updates broadcastModel status to 'sent' and returns processed: 0", async () => {
      findManyBroadcast.mockResolvedValue([makeBroadcast()])
      findManyContactsOnBroadcasts.mockResolvedValue([])

      const result = await processBroadcastContacts()

      expect(result).toEqual({ processed: 0 })
      expect(updateCalls).toHaveLength(1)
      expect(updateCalls[0].values).toMatchObject({ status: "sent" })
      expect(chatAddSpy).not.toHaveBeenCalled()
    })
  })

  describe("broadcast with flowId", () => {
    test("enqueues integrationQueue sendFlow with correct payload", async () => {
      findManyBroadcast.mockResolvedValue([makeBroadcast({ flowId: "flow-1" })])
      findManyContactsOnBroadcasts.mockResolvedValue([makeContactOnBroadcast()])

      await processBroadcastContacts()

      expect(integrationAddSpy).toHaveBeenCalledTimes(1)
      expect(integrationAddSpy).toHaveBeenCalledWith(
        "sendFlow",
        expect.objectContaining({
          type: "sendFlow",
          data: expect.objectContaining({
            flowId: "flow-1",
            conversationId: "conv-1",
            contactInboxId: "ci-1",
            metadata: expect.objectContaining({
              type: "broadcast",
              broadcastId: BROADCAST_ID,
            }),
          }),
        }),
      )
    })

    test("does not call chatQueue when only flowId is set", async () => {
      findManyBroadcast.mockResolvedValue([makeBroadcast({ flowId: "flow-1" })])
      findManyContactsOnBroadcasts.mockResolvedValue([makeContactOnBroadcast()])

      await processBroadcastContacts()

      expect(chatAddSpy).not.toHaveBeenCalled()
    })
  })

  describe("broadcast with templateId on non-messenger channel", () => {
    test("enqueues chatQueue sendWhatsappTemplateMessage with correct payload", async () => {
      findManyBroadcast.mockResolvedValue([
        makeBroadcast({
          templateId: "tmpl-1",
          channel: "whatsapp",
          templateData: { components: [] },
        }),
      ])
      findManyContactsOnBroadcasts.mockResolvedValue([makeContactOnBroadcast()])

      await processBroadcastContacts()

      expect(chatAddSpy).toHaveBeenCalledTimes(1)
      expect(chatAddSpy).toHaveBeenCalledWith(
        "sendWhatsappTemplateMessage",
        expect.objectContaining({
          type: "sendWhatsappTemplateMessage",
          data: expect.objectContaining({
            templateId: "tmpl-1",
            broadcastId: BROADCAST_ID,
            templateData: { components: [] },
            metadata: expect.objectContaining({
              type: "broadcast",
              broadcastId: BROADCAST_ID,
            }),
          }),
        }),
      )
    })
  })

  describe("broadcast with templateId on messenger channel", () => {
    test("enqueues chatQueue sendMessengerTemplateMessage", async () => {
      findManyBroadcast.mockResolvedValue([
        makeBroadcast({
          templateId: "tmpl-messenger",
          channel: "messenger",
          templateData: { text: "Hello" },
        }),
      ])
      findManyContactsOnBroadcasts.mockResolvedValue([makeContactOnBroadcast()])

      await processBroadcastContacts()

      expect(chatAddSpy).toHaveBeenCalledTimes(1)
      expect(chatAddSpy).toHaveBeenCalledWith(
        "sendMessengerTemplateMessage",
        expect.objectContaining({ type: "sendMessengerTemplateMessage" }),
      )
    })

    test("separates buttons from templateData so job receives correct shapes", async () => {
      const buttons = [{ id: "b1", label: "Yes", flowId: "flow-btn" }]
      findManyBroadcast.mockResolvedValue([
        makeBroadcast({
          templateId: "tmpl-messenger",
          channel: "messenger",
          templateData: { text: "Pick one", buttons },
        }),
      ])
      findManyContactsOnBroadcasts.mockResolvedValue([makeContactOnBroadcast()])

      await processBroadcastContacts()

      const callArgs = chatAddSpy.mock.calls[0] as [
        string,
        { data: { templateData: unknown; buttons: unknown } },
      ]
      const { data } = callArgs[1]
      expect(data.buttons).toEqual(buttons)
      expect(data.templateData).toEqual({ text: "Pick one" })
    })

    test("templateData is undefined when no non-button fields are present", async () => {
      findManyBroadcast.mockResolvedValue([
        makeBroadcast({
          templateId: "tmpl-messenger",
          channel: "messenger",
          templateData: { buttons: [{ id: "b1", label: "Yes" }] },
        }),
      ])
      findManyContactsOnBroadcasts.mockResolvedValue([makeContactOnBroadcast()])

      await processBroadcastContacts()

      const callArgs = chatAddSpy.mock.calls[0] as [
        string,
        { data: { templateData: unknown } },
      ]
      expect(callArgs[1].data.templateData).toBeUndefined()
    })
  })

  describe("successful contact processing", () => {
    test("marks contactOnBroadcast as sent=true after queue add", async () => {
      findManyBroadcast.mockResolvedValue([
        makeBroadcast({ templateId: "tmpl-1", channel: "whatsapp" }),
      ])
      findManyContactsOnBroadcasts.mockResolvedValue([makeContactOnBroadcast()])

      const result = await processBroadcastContacts()

      expect(result).toEqual({ processed: 1 })
      // update to contactsOnBroadcastsModel
      const cobUpdate = updateCalls.find(
        (c) =>
          (c.table as { __name?: string }).__name ===
          "contactsOnBroadcastsModel",
      )
      expect(cobUpdate).toBeDefined()
      expect(cobUpdate?.values).toMatchObject({ sent: true })
    })

    test("processes multiple contacts across multiple broadcasts and returns total count", async () => {
      findManyBroadcast.mockResolvedValue([
        makeBroadcast({ id: "b-1", templateId: "t-1", channel: "whatsapp" }),
        makeBroadcast({ id: "b-2", templateId: "t-2", channel: "whatsapp" }),
      ])
      findManyContactsOnBroadcasts
        .mockResolvedValueOnce([
          makeContactOnBroadcast({ broadcastId: "b-1" }),
          makeContactOnBroadcast({
            broadcastId: "b-1",
            contactId: "contact-2",
          }),
        ])
        .mockResolvedValueOnce([makeContactOnBroadcast({ broadcastId: "b-2" })])

      const result = await processBroadcastContacts()

      expect(result).toEqual({ processed: 3 })
    })
  })

  describe("error handling inside per-contact processing", () => {
    test("logs the error and continues processing remaining contacts", async () => {
      findManyBroadcast.mockResolvedValue([
        makeBroadcast({ templateId: "tmpl-1", channel: "whatsapp" }),
      ])
      findManyContactsOnBroadcasts.mockResolvedValue([
        makeContactOnBroadcast({ contactId: "contact-1" }),
        makeContactOnBroadcast({ contactId: "contact-2" }),
      ])

      // first add throws, second succeeds
      chatAddSpy
        .mockRejectedValueOnce(new Error("queue unavailable"))
        .mockResolvedValueOnce(undefined)

      const result = await processBroadcastContacts()

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1)
      // second contact still processed
      expect(result).toEqual({ processed: 1 })
    })
  })
})
