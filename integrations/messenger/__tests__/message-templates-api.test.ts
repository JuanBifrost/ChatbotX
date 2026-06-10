import {
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from "vitest"

vi.mock("../src/lib/http-client", () => ({
  facebookGraphClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

// Dynamic imports ensure vi.mock is fully applied before loading these modules
const {
  listPageMessageTemplates,
  createPageMessageTemplate,
  clonePageMessageTemplate,
} = await import("../src/apis/message-templates")
const { facebookGraphClient } = await import("../src/lib/http-client")

const mockGet = facebookGraphClient.get as MockInstance
const mockPost = facebookGraphClient.post as MockInstance

const AUTH = {
  tokens: { accessToken: "test-token-abc" },
  metadata: {
    pageId: "PAGE123",
    version: "v23.0",
    pageName: "Test Page",
    webhookUrl: "https://example.com/webhook",
  },
} as never

// ─── listPageMessageTemplates ─────────────────────────────────────────────────

describe("listPageMessageTemplates", () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  test("single page — returns data, get called once", async () => {
    const template = {
      id: "tmpl1",
      name: "order_confirm",
      status: "APPROVED" as const,
      language: "en",
      category: "UTILITY" as const,
      components: [],
    }
    mockGet.mockResolvedValueOnce({ data: [template] })

    const result = await listPageMessageTemplates(AUTH)

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({ id: "tmpl1", name: "order_confirm" })
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  test("two pages — accumulates both, get called twice", async () => {
    const page1 = {
      id: "t1",
      name: "tmpl1",
      status: "APPROVED" as const,
      language: "en",
      category: "UTILITY" as const,
      components: [],
    }
    const page2 = {
      id: "t2",
      name: "tmpl2",
      status: "PENDING" as const,
      language: "vi",
      category: "UTILITY" as const,
      components: [],
    }

    mockGet
      .mockResolvedValueOnce({
        data: [page1],
        paging: {
          cursors: { before: "cursor_start", after: "cursor123" },
          next: "https://graph.facebook.com/v23.0/PAGE123/message_templates?after=cursor123",
        },
      })
      .mockResolvedValueOnce({ data: [page2] })

    const result = await listPageMessageTemplates(AUTH)

    expect(result.data).toHaveLength(2)
    expect(result.data[0].id).toBe("t1")
    expect(result.data[1].id).toBe("t2")
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  test("second get call uses cursors.after (not absolute paging.next url)", async () => {
    const cursorAfter = "xyz"
    mockGet
      .mockResolvedValueOnce({
        data: [],
        paging: {
          cursors: { before: "abc", after: cursorAfter },
          next: "https://graph.facebook.com/v23.0/PAGE123/message_templates?after=xyz",
        },
      })
      .mockResolvedValueOnce({ data: [] })

    await listPageMessageTemplates(AUTH)

    const secondCall = mockGet.mock.calls[1]
    expect(secondCall[0]).toContain(`after=${cursorAfter}`)
    expect(secondCall[0]).not.toContain("https://")
  })

  test("uses paging.cursors.after to build second page URL (not absolute paging.next)", async () => {
    const absoluteNextUrl =
      "https://graph.facebook.com/v23.0/PAGE123/message_templates?after=cursor_abc"
    mockGet
      .mockResolvedValueOnce({
        data: [],
        paging: {
          cursors: { before: "cursor_start", after: "cursor_abc" },
          next: absoluteNextUrl,
        },
      })
      .mockResolvedValueOnce({ data: [] })

    await listPageMessageTemplates(AUTH)

    const secondCallUrl = mockGet.mock.calls[1][0] as string
    expect(secondCallUrl).toContain("after=cursor_abc")
    expect(secondCallUrl).not.toContain("https://")
    expect(secondCallUrl).not.toContain("graph.facebook.com")
  })

  test("stops pagination when paging.next is absent even if cursors.after exists", async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: "t1",
          name: "t",
          status: "APPROVED",
          language: "en",
          category: "UTILITY",
          components: [],
        },
      ],
      paging: {
        cursors: { before: "x", after: "y" },
      },
    })

    await listPageMessageTemplates(AUTH)

    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  test("Authorization Bearer header passed on first call", async () => {
    mockGet.mockResolvedValueOnce({ data: [] })

    await listPageMessageTemplates(AUTH)

    const [, options] = mockGet.mock.calls[0]
    expect(options.headers.Authorization).toBe("Bearer test-token-abc")
  })

  test("first url contains pageId and fields param", async () => {
    mockGet.mockResolvedValueOnce({ data: [] })

    await listPageMessageTemplates(AUTH)

    const [url] = mockGet.mock.calls[0]
    expect(url).toContain("PAGE123")
    expect(url).toContain("message_templates")
    expect(url).toContain("fields=")
  })

  test("adds name filter when listing one template", async () => {
    mockGet.mockResolvedValueOnce({ data: [] })

    await listPageMessageTemplates(AUTH, { name: "delivery_confirmation" })

    const [url] = mockGet.mock.calls[0]
    expect(url).toContain("name=delivery_confirmation")
  })

  test("keeps name filter on paginated requests", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [],
        paging: {
          cursors: { before: "abc", after: "cursor_abc" },
          next: "https://graph.facebook.com/v23.0/PAGE123/message_templates?after=cursor_abc",
        },
      })
      .mockResolvedValueOnce({ data: [] })

    await listPageMessageTemplates(AUTH, { name: "delivery_confirmation" })

    const secondCallUrl = mockGet.mock.calls[1][0] as string
    expect(secondCallUrl).toContain("name=delivery_confirmation")
    expect(secondCallUrl).toContain("after=cursor_abc")
  })

  test("auth without version uses DEFAULT_API_VERSION (v23.0)", async () => {
    const authNoVersion = {
      ...AUTH,
      metadata: { ...AUTH.metadata, version: undefined },
    } as never
    mockGet.mockResolvedValueOnce({ data: [] })

    await listPageMessageTemplates(authNoVersion)

    const [url] = mockGet.mock.calls[0]
    expect(url).toContain("v23.0")
  })

  test("returns empty paging object", async () => {
    mockGet.mockResolvedValueOnce({ data: [] })

    const result = await listPageMessageTemplates(AUTH)
    expect(result.paging).toEqual({})
  })
})

// ─── createPageMessageTemplate ────────────────────────────────────────────────

describe("createPageMessageTemplate", () => {
  beforeEach(() => {
    mockPost.mockReset()
  })

  const newTemplate = {
    name: "delivery_update",
    language: "en",
    category: "UTILITY" as const,
    components: [{ type: "BODY", text: "Your order {{1}} is delivered!" }],
  }

  test("calls post with correct url (no leading slash)", async () => {
    const created = {
      id: "new-tmpl",
      ...newTemplate,
      status: "APPROVED" as const,
      parameter_format: undefined,
    }
    mockPost.mockResolvedValueOnce(created)

    await createPageMessageTemplate(AUTH, newTemplate)

    const [url] = mockPost.mock.calls[0]
    expect(url).toBe("v23.0/PAGE123/message_templates")
    expect(url.startsWith("/")).toBe(false)
  })

  test("passes Authorization and Content-Type headers", async () => {
    mockPost.mockResolvedValueOnce({})

    await createPageMessageTemplate(AUTH, newTemplate)

    const [, options] = mockPost.mock.calls[0]
    expect(options.headers.Authorization).toBe("Bearer test-token-abc")
    expect(options.headers["Content-Type"]).toBe("application/json")
  })

  test("passes data as json body", async () => {
    mockPost.mockResolvedValueOnce({})

    await createPageMessageTemplate(AUTH, newTemplate)

    const [, options] = mockPost.mock.calls[0]
    expect(options.json).toEqual(newTemplate)
  })

  test("returns post result directly", async () => {
    const serverResponse = {
      id: "tmpl-999",
      status: "APPROVED",
      category: "UTILITY",
    }
    mockPost.mockResolvedValueOnce(serverResponse)

    const result = await createPageMessageTemplate(AUTH, newTemplate)
    expect(result).toEqual(serverResponse)
  })
})

// ─── clonePageMessageTemplate ─────────────────────────────────────────────────

describe("clonePageMessageTemplate", () => {
  beforeEach(() => {
    mockPost.mockReset()
  })

  const cloneData = {
    name: "order_confirm",
    category: "UTILITY" as const,
    language: "en",
    library_template_name: "order_confirm",
  }

  test("calls post with correct url (no leading slash)", async () => {
    mockPost.mockResolvedValueOnce({
      id: "cloned-tmpl",
      name: "order_confirm",
      status: "APPROVED" as const,
      language: "en",
      category: "UTILITY" as const,
      components: [],
    })

    await clonePageMessageTemplate(AUTH, cloneData)

    const [url] = mockPost.mock.calls[0]
    expect(url).toBe("v23.0/PAGE123/message_templates")
    expect(url.startsWith("/")).toBe(false)
  })

  test("passes Authorization and Content-Type headers", async () => {
    mockPost.mockResolvedValueOnce({})

    await clonePageMessageTemplate(AUTH, cloneData)

    const [, options] = mockPost.mock.calls[0]
    expect(options.headers.Authorization).toBe("Bearer test-token-abc")
    expect(options.headers["Content-Type"]).toBe("application/json")
  })

  test("body has exactly 4 keys: name, category, language, library_template_name", async () => {
    mockPost.mockResolvedValueOnce({})

    await clonePageMessageTemplate(AUTH, cloneData)

    const [, options] = mockPost.mock.calls[0]
    const body = options.json as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(
      ["category", "language", "library_template_name", "name"].sort(),
    )
  })

  test("body does NOT contain components or *_inputs keys", async () => {
    mockPost.mockResolvedValueOnce({})

    await clonePageMessageTemplate(AUTH, cloneData)

    const [, options] = mockPost.mock.calls[0]
    const body = options.json as Record<string, unknown>
    expect(body).not.toHaveProperty("components")
    expect(body).not.toHaveProperty("library_template_body_inputs")
    expect(body).not.toHaveProperty("library_template_button_inputs")
  })

  test("body values match the passed data", async () => {
    mockPost.mockResolvedValueOnce({})

    await clonePageMessageTemplate(AUTH, cloneData)

    const [, options] = mockPost.mock.calls[0]
    expect(options.json).toEqual(cloneData)
  })

  test("returns post result directly", async () => {
    const serverResponse = {
      id: "cloned-999",
      name: "order_confirm",
      status: "APPROVED" as const,
      language: "en",
      category: "UTILITY" as const,
      components: [],
    }
    mockPost.mockResolvedValueOnce(serverResponse)

    const result = await clonePageMessageTemplate(AUTH, cloneData)
    expect(result).toEqual(serverResponse)
  })
})
