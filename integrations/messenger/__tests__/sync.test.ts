import { beforeEach, describe, expect, test, vi } from "vitest"

const mockGet = vi.hoisted(() => vi.fn())

vi.mock("../src/exception", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/exception")>()
  return { ...actual, rescue: (_: string, fn: () => Promise<unknown>) => fn() }
})

vi.mock("../src/lib/http-client", () => ({
  facebookGraphClient: { get: mockGet },
  facebookAttachmentClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  // sync.ts uses getWithHeaders ({ data, headers }); adapt through mockGet so
  // the per-test setups/assertions keep working on (url, options) → body.
  facebookCoexistGraphClient: {
    getWithHeaders: vi.fn(async (url: string, options?: unknown) => ({
      data: await mockGet(url, options),
      headers: new Headers(),
    })),
  },
}))

import { listConversations, listMessages } from "../src/apis/sync"

const ACCESS_TOKEN = "test-access-token"
const PAGE_ID = "page-123"
const CONVERSATION_ID = "conv-456"
const VERSION = "v23.0"

describe("listConversations", () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  test("first call uses correct searchParams: platform, fields, limit", async () => {
    mockGet.mockResolvedValueOnce({ data: [], paging: {} })

    await listConversations({ pageId: PAGE_ID, accessToken: ACCESS_TOKEN })

    expect(mockGet).toHaveBeenCalledOnce()
    const [, options] = mockGet.mock.calls[0]
    expect(options.searchParams.platform).toBe("MESSENGER")
    expect(options.searchParams.fields).toBe("id,participants,updated_time")
    expect(options.searchParams.limit).toBe("499")
  })

  test("returns after from paging.cursors.after when paging.next is truthy", async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: "c1" }],
      paging: {
        cursors: { after: "cursor-abc" },
        next: "https://graph.facebook.com/next",
      },
    })

    const result = await listConversations({
      pageId: PAGE_ID,
      accessToken: ACCESS_TOKEN,
    })

    expect(result.after).toBe("cursor-abc")
    expect(result.data).toEqual([{ id: "c1" }])
  })

  test("passing after forwards it as searchParams.after", async () => {
    mockGet.mockResolvedValueOnce({ data: [], paging: {} })

    await listConversations({
      pageId: PAGE_ID,
      accessToken: ACCESS_TOKEN,
      after: "cursor-xyz",
    })

    const [, options] = mockGet.mock.calls[0]
    expect(options.searchParams.after).toBe("cursor-xyz")
  })

  test("paging.next absent → result.after is undefined", async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: "c2" }],
      paging: { cursors: { after: "cursor-should-be-ignored" } },
      // no `next` key
    })

    const result = await listConversations({
      pageId: PAGE_ID,
      accessToken: ACCESS_TOKEN,
    })

    expect(result.after).toBeUndefined()
  })

  test("two-page walk yields all data and final after === undefined", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [{ id: "c1" }, { id: "c2" }],
        paging: {
          cursors: { after: "page2-cursor" },
          next: "https://graph.facebook.com/next",
        },
      })
      .mockResolvedValueOnce({
        data: [{ id: "c3" }],
        paging: { cursors: { after: "page3-cursor" } },
        // no next — last page
      })

    const page1 = await listConversations({
      pageId: PAGE_ID,
      accessToken: ACCESS_TOKEN,
    })
    expect(page1.data).toEqual([{ id: "c1" }, { id: "c2" }])
    expect(page1.after).toBe("page2-cursor")

    const page2 = await listConversations({
      pageId: PAGE_ID,
      accessToken: ACCESS_TOKEN,
      after: page1.after,
    })
    expect(page2.data).toEqual([{ id: "c3" }])
    expect(page2.after).toBeUndefined()

    const allData = [...page1.data, ...page2.data]
    expect(allData).toHaveLength(3)
    expect(allData.map((c) => c.id)).toEqual(["c1", "c2", "c3"])
  })
})

describe("listMessages", () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  test("first call uses correct fields, limit, and endpoint", async () => {
    mockGet.mockResolvedValueOnce({ data: [], paging: {} })

    await listMessages({
      conversationId: CONVERSATION_ID,
      accessToken: ACCESS_TOKEN,
    })

    expect(mockGet).toHaveBeenCalledOnce()
    const [endpoint, options] = mockGet.mock.calls[0]
    expect(endpoint).toBe(`${VERSION}/${CONVERSATION_ID}/messages`)
    expect(options.searchParams.fields).toBe(
      "id,message,from,created_time,attachments{id,name,mime_type,size,image_data,video_data,file_url,generic_template}",
    )
    expect(options.searchParams.limit).toBe("499")
  })

  test("passing after forwards it as searchParams.after", async () => {
    mockGet.mockResolvedValueOnce({ data: [], paging: {} })

    await listMessages({
      conversationId: CONVERSATION_ID,
      accessToken: ACCESS_TOKEN,
      after: "msg-cursor",
    })

    const [, options] = mockGet.mock.calls[0]
    expect(options.searchParams.after).toBe("msg-cursor")
  })

  test("paging.next absent → result.after is undefined", async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: "m1", message: "hello" }],
      paging: { cursors: { after: "ignored-cursor" } },
    })

    const result = await listMessages({
      conversationId: CONVERSATION_ID,
      accessToken: ACCESS_TOKEN,
    })

    expect(result.after).toBeUndefined()
    expect(result.data).toEqual([{ id: "m1", message: "hello" }])
  })
})

describe("nextCursor sub-cases via returned .after", () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  test("paging undefined → after is undefined", async () => {
    mockGet.mockResolvedValueOnce({ data: [] })
    // no `paging` key at all
    const result = await listMessages({
      conversationId: CONVERSATION_ID,
      accessToken: ACCESS_TOKEN,
    })
    expect(result.after).toBeUndefined()
  })

  test("paging.next truthy but cursors missing → after is undefined", async () => {
    mockGet.mockResolvedValueOnce({
      data: [],
      paging: { next: "https://graph.facebook.com/next" },
      // cursors key absent
    })
    const result = await listMessages({
      conversationId: CONVERSATION_ID,
      accessToken: ACCESS_TOKEN,
    })
    expect(result.after).toBeUndefined()
  })

  test("paging.next truthy and cursors.after present → after equals cursors.after", async () => {
    mockGet.mockResolvedValueOnce({
      data: [],
      paging: {
        cursors: { after: "exact-cursor" },
        next: "https://graph.facebook.com/next",
      },
    })
    const result = await listMessages({
      conversationId: CONVERSATION_ID,
      accessToken: ACCESS_TOKEN,
    })
    expect(result.after).toBe("exact-cursor")
  })
})
