import { afterEach, describe, expect, test, vi } from "vitest"
import { klaviyoRequest } from "../src/client"
import { KLAVIYO_API_REVISION } from "../src/constants"
import { KlaviyoApiError } from "../src/error"
import {
  createKlaviyoAuth,
  klaviyoProfileImportResponseSchema,
} from "../src/schemas"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Klaviyo HTTP client", () => {
  test("uses Klaviyo API key auth with the pinned revision header", async () => {
    const fetchMock = vi.fn(
      async (_request: Request) =>
        new Response(
          JSON.stringify({
            data: {
              type: "profile",
              id: "profile-1",
              attributes: { email: "a@example.com" },
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await klaviyoRequest(
      createKlaviyoAuth(" secret "),
      "profile-import",
      klaviyoProfileImportResponseSchema,
      { method: "post", json: {} },
      [200, 201],
    )

    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(request.url).toBe("https://a.klaviyo.com/api/profile-import")
    expect(request.headers.get("Authorization")).toBe("Klaviyo-API-Key secret")
    expect(request.headers.get("revision")).toBe(KLAVIYO_API_REVISION)
  })

  test("parses Retry-After, redacts email, and does not retry", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            errors: [{ detail: "Rejected person@example.com" }],
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "5",
            },
          },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const error = await klaviyoRequest(
      createKlaviyoAuth("secret"),
      "profile-import",
      klaviyoProfileImportResponseSchema,
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(KlaviyoApiError)
    expect(error).toMatchObject({
      message: "Rejected [redacted]",
      statusCode: 429,
      retryAfterSeconds: 5,
    })
    expect(String(error)).not.toContain("secret")
    expect(String(error)).not.toContain("person@example.com")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("rejects malformed successes and unexpected success statuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response("not-json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                type: "profile",
                id: "profile-1",
                attributes: { email: "a@example.com" },
              },
            }),
            { status: 202, headers: { "Content-Type": "application/json" } },
          ),
        ),
    )
    const request = () =>
      klaviyoRequest(
        createKlaviyoAuth("secret"),
        "profile-import",
        klaviyoProfileImportResponseSchema,
        undefined,
        [200, 201],
      )

    await expect(request()).rejects.toThrow()
    await expect(request()).rejects.toMatchObject({ statusCode: 202 })
  })
})
