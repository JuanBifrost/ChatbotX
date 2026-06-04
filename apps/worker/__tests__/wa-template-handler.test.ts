import {
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from "vitest"

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      inboxModel: { findFirst: vi.fn() },
      whatsappMessageTemplateModel: { findFirst: vi.fn() },
    },
  },
}))

const { validateWhatsappTemplate } = await import(
  "../src/integration/handlers/wa-template-handler"
)
const { db } = await import("@chatbotx.io/database/client")

const mockInboxFindFirst = db.query.inboxModel.findFirst as MockInstance
const mockTemplateFindFirst = db.query.whatsappMessageTemplateModel
  .findFirst as MockInstance

describe("validateWhatsappTemplate — new contract (entities | null)", () => {
  beforeEach(() => {
    mockInboxFindFirst.mockReset()
    mockTemplateFindFirst.mockReset()
  })

  test("returns null when inbox not found", async () => {
    mockInboxFindFirst.mockResolvedValueOnce(null)

    const result = await validateWhatsappTemplate("tmpl-1", "inbox-1")
    expect(result).toBeNull()
  })

  test("returns null when inbox has no integrationWhatsapp", async () => {
    mockInboxFindFirst.mockResolvedValueOnce({
      id: "inbox-1",
      integrationWhatsapp: null,
    })

    const result = await validateWhatsappTemplate("tmpl-1", "inbox-1")
    expect(result).toBeNull()
  })

  test("returns null when template not found", async () => {
    mockInboxFindFirst.mockResolvedValueOnce({
      id: "inbox-1",
      integrationWhatsapp: { id: "intg-99" },
    })
    mockTemplateFindFirst.mockResolvedValueOnce(null)

    const result = await validateWhatsappTemplate("tmpl-1", "inbox-1")
    expect(result).toBeNull()
  })

  test("returns { inbox, template } when both found", async () => {
    const mockInbox = { id: "inbox-1", integrationWhatsapp: { id: "intg-99" } }
    const mockTemplate = {
      id: "tmpl-1",
      name: "order_update",
      status: "APPROVED",
    }
    mockInboxFindFirst.mockResolvedValueOnce(mockInbox)
    mockTemplateFindFirst.mockResolvedValueOnce(mockTemplate)

    const result = await validateWhatsappTemplate("tmpl-1", "inbox-1")

    expect(result).not.toBeNull()
    expect(result).toMatchObject({ inbox: mockInbox, template: mockTemplate })
  })

  test("template query uses integrationWhatsappId and status APPROVED", async () => {
    mockInboxFindFirst.mockResolvedValueOnce({
      id: "inbox-1",
      integrationWhatsapp: { id: "intg-42" },
    })
    mockTemplateFindFirst.mockResolvedValueOnce({ id: "tmpl-1" })

    await validateWhatsappTemplate("tmpl-1", "inbox-1")

    const [queryArg] = mockTemplateFindFirst.mock.calls[0]
    expect(queryArg.where).toMatchObject({
      id: "tmpl-1",
      integrationWhatsappId: "intg-42",
      status: "APPROVED",
    })
  })
})
