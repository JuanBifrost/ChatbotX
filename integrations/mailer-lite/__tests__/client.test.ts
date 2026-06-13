import { afterEach, describe, expect, test, vi } from "vitest"
import { mailerLiteRequest } from "../src/client"
import { MailerLiteApiError } from "../src/error"
import {
  createMailerLiteAuth,
  mailerLiteSubscriberResponseSchema,
} from "../src/schemas"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("MailerLite HTTP client", () => {
  test("uses bearer auth without an unverified version header", async () => {
    const fetchMock = vi.fn(
      async (_request: Request) =>
        new Response(
          JSON.stringify({
            data: {
              id: "subscriber-1",
              email: "a@example.com",
              status: "active",
              fields: {},
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      mailerLiteRequest(
        createMailerLiteAuth(" secret "),
        "subscribers",
        mailerLiteSubscriberResponseSchema,
        { method: "post", json: { email: "a@example.com" } },
        [200, 201],
      ),
    ).resolves.toMatchObject({ data: { id: "subscriber-1" } })

    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(request.url).toBe("https://connect.mailerlite.com/api/subscribers")
    expect(request.headers.get("Authorization")).toBe("Bearer secret")
    expect(request.headers.get("X-Version")).toBeNull()
  })

  test("parses rate metadata, redacts email, and does not retry", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ message: "Rejected person@example.com" }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": "120",
              "X-RateLimit-Remaining": "0",
              "Retry-After": "5",
            },
          },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const error = await mailerLiteRequest(
      createMailerLiteAuth("secret"),
      "subscribers",
      mailerLiteSubscriberResponseSchema,
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(MailerLiteApiError)
    expect(error).toMatchObject({
      message: "Rejected [redacted]",
      statusCode: 429,
      rateLimitLimit: 120,
      rateLimitRemaining: 0,
      retryAfterSeconds: 5,
    })
    expect(String(error)).not.toContain("secret")
    expect(String(error)).not.toContain("person@example.com")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("rejects malformed JSON and unexpected success statuses", async () => {
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
                id: "subscriber-1",
                email: "a@example.com",
                status: "active",
                fields: {},
              },
            }),
            { status: 202, headers: { "Content-Type": "application/json" } },
          ),
        ),
    )

    const request = () =>
      mailerLiteRequest(
        createMailerLiteAuth("secret"),
        "subscribers",
        mailerLiteSubscriberResponseSchema,
        undefined,
        [200, 201],
      )

    await expect(request()).rejects.toThrow()
    await expect(request()).rejects.toMatchObject({ statusCode: 202 })
  })
})
