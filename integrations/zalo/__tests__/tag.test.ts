import type { Context } from "@chatbotx.io/sdk"
import { HttpResponse, http, server } from "@chatbotx.io/vitest-config/msw"
import { describe, expect, test } from "vitest"
import {
  listOaTags,
  removeFollowerFromTag,
  removeTag,
  tagFollower,
} from "../src/api/tag"
import type { ZaloAuthValue } from "../src/schema/definition"

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const ACCESS_TOKEN = "ZALO_TOKEN"

const ctx = {
  auth: { tokens: { accessToken: ACCESS_TOKEN } },
} as unknown as Context<ZaloAuthValue>

const BASE = "https://openapi.zalo.me"

// ---------------------------------------------------------------------------
// tagFollower
// ---------------------------------------------------------------------------

describe("tagFollower", () => {
  test("sends POST to correct URL with json body {user_id, tag_name}", async () => {
    // Arrange
    let capturedUrl = ""
    let capturedBody: unknown = null
    let capturedToken = ""

    server.use(
      http.post(`${BASE}/v2.0/oa/tag/tagfollower`, async ({ request }) => {
        capturedUrl = request.url
        capturedBody = await request.json()
        capturedToken = request.headers.get("access_token") ?? ""
        return HttpResponse.json({ error: 0, message: "Success", data: {} })
      }),
    )

    // Act
    const result = await tagFollower({
      ctx,
      userId: "U123",
      tagName: "vip",
    })

    // Assert
    expect(capturedUrl).toBe(`${BASE}/v2.0/oa/tag/tagfollower`)
    expect(capturedBody).toEqual({ user_id: "U123", tag_name: "vip" })
    expect(capturedToken).toBe(ACCESS_TOKEN)
    expect(result).toEqual({ success: true })
  })

  test("carries access_token header from context", async () => {
    let capturedToken = ""

    server.use(
      http.post(`${BASE}/v2.0/oa/tag/tagfollower`, ({ request }) => {
        capturedToken = request.headers.get("access_token") ?? ""
        return HttpResponse.json({ error: 0, message: "Success", data: {} })
      }),
    )

    await tagFollower({ ctx, userId: "U999", tagName: "gold" })

    expect(capturedToken).toBe(ACCESS_TOKEN)
  })
})

// ---------------------------------------------------------------------------
// removeFollowerFromTag
// ---------------------------------------------------------------------------

describe("removeFollowerFromTag", () => {
  test("sends POST to correct URL with json body {user_id, tag_name}", async () => {
    // Arrange
    let capturedUrl = ""
    let capturedBody: unknown = null
    let capturedToken = ""

    server.use(
      http.post(
        `${BASE}/v2.0/oa/tag/rmfollowerfromtag`,
        async ({ request }) => {
          capturedUrl = request.url
          capturedBody = await request.json()
          capturedToken = request.headers.get("access_token") ?? ""
          return HttpResponse.json({ error: 0, message: "Success", data: {} })
        },
      ),
    )

    // Act
    const result = await removeFollowerFromTag({
      ctx,
      userId: "U456",
      tagName: "bronze",
    })

    // Assert
    expect(capturedUrl).toBe(`${BASE}/v2.0/oa/tag/rmfollowerfromtag`)
    expect(capturedBody).toEqual({ user_id: "U456", tag_name: "bronze" })
    expect(capturedToken).toBe(ACCESS_TOKEN)
    expect(result).toEqual({ success: true })
  })

  test("carries access_token header from context", async () => {
    let capturedToken = ""

    server.use(
      http.post(`${BASE}/v2.0/oa/tag/rmfollowerfromtag`, ({ request }) => {
        capturedToken = request.headers.get("access_token") ?? ""
        return HttpResponse.json({ error: 0, message: "Success", data: {} })
      }),
    )

    await removeFollowerFromTag({ ctx, userId: "U000", tagName: "silver" })

    expect(capturedToken).toBe(ACCESS_TOKEN)
  })
})

// ---------------------------------------------------------------------------
// listOaTags
// ---------------------------------------------------------------------------

describe("listOaTags", () => {
  test("sends GET to correct URL with access_token header", async () => {
    // Arrange
    let capturedUrl = ""
    let capturedToken = ""

    server.use(
      http.get(`${BASE}/v2.0/oa/tag/gettagsofoa`, ({ request }) => {
        capturedUrl = request.url
        capturedToken = request.headers.get("access_token") ?? ""
        return HttpResponse.json({
          error: 0,
          message: "Success",
          data: ["vip", "gold", "silver"],
        })
      }),
    )

    // Act
    const result = await listOaTags({ ctx })

    // Assert
    expect(capturedUrl).toBe(`${BASE}/v2.0/oa/tag/gettagsofoa`)
    expect(capturedToken).toBe(ACCESS_TOKEN)
    expect(result).toEqual(["vip", "gold", "silver"])
  })

  test("returns data string[] when API response includes data", async () => {
    // Arrange
    server.use(
      http.get(`${BASE}/v2.0/oa/tag/gettagsofoa`, () =>
        HttpResponse.json({
          error: 0,
          message: "Success",
          data: ["tag-a", "tag-b"],
        }),
      ),
    )

    // Act
    const result = await listOaTags({ ctx })

    // Assert
    expect(result).toEqual(["tag-a", "tag-b"])
  })

  test("returns [] (our data ?? [] branch) when API response omits data field", async () => {
    // Arrange — response has no `data` key
    server.use(
      http.get(`${BASE}/v2.0/oa/tag/gettagsofoa`, () =>
        HttpResponse.json({ error: 0, message: "Success" }),
      ),
    )

    // Act
    const result = await listOaTags({ ctx })

    // Assert
    expect(result).toEqual([])
  })

  test("returns [] (our data ?? [] branch) when API response has data: null", async () => {
    // Arrange
    server.use(
      http.get(`${BASE}/v2.0/oa/tag/gettagsofoa`, () =>
        HttpResponse.json({ error: 0, message: "Success", data: null }),
      ),
    )

    // Act
    const result = await listOaTags({ ctx })

    // Assert
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// removeTag
// ---------------------------------------------------------------------------

describe("removeTag", () => {
  test("sends POST to correct URL with json body {tag_name} only (no user_id)", async () => {
    // Arrange
    let capturedUrl = ""
    let capturedBody: unknown = null
    let capturedToken = ""

    server.use(
      http.post(`${BASE}/v2.0/oa/tag/rmtag`, async ({ request }) => {
        capturedUrl = request.url
        capturedBody = await request.json()
        capturedToken = request.headers.get("access_token") ?? ""
        return HttpResponse.json({ error: 0, message: "Success", data: {} })
      }),
    )

    // Act
    const result = await removeTag({ ctx, tagName: "deprecated-tag" })

    // Assert
    expect(capturedUrl).toBe(`${BASE}/v2.0/oa/tag/rmtag`)
    expect(capturedBody).toEqual({ tag_name: "deprecated-tag" })
    expect(capturedBody).not.toHaveProperty("user_id")
    expect(capturedToken).toBe(ACCESS_TOKEN)
    expect(result).toEqual({ success: true })
  })

  test("carries access_token header from context", async () => {
    let capturedToken = ""

    server.use(
      http.post(`${BASE}/v2.0/oa/tag/rmtag`, ({ request }) => {
        capturedToken = request.headers.get("access_token") ?? ""
        return HttpResponse.json({ error: 0, message: "Success", data: {} })
      }),
    )

    await removeTag({ ctx, tagName: "old-tag" })

    expect(capturedToken).toBe(ACCESS_TOKEN)
  })
})
