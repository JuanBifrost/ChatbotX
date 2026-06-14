import { afterEach, describe, expect, test, vi } from "vitest"
import { sendGridRequest } from "../src/client"
import { SendGridApiError } from "../src/error"
import {
  createSendGridAuth,
  sendGridAcceptedResponseSchema,
} from "../src/schemas"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("SendGrid HTTP client", () => {
  test("uses bearer auth and parses an accepted response", async () => {
    const fetchMock = vi.fn(
      async (_request: Request) =>
        new Response(JSON.stringify({ job_id: "job-1" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      sendGridRequest(
        createSendGridAuth(" secret "),
        "marketing/contacts",
        sendGridAcceptedResponseSchema,
        { method: "put", json: { contacts: [{ email: "a@example.com" }] } },
      ),
    ).resolves.toEqual({ job_id: "job-1" })

    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(request.url).toBe("https://api.sendgrid.com/v3/marketing/contacts")
    expect(request.headers.get("Authorization")).toBe("Bearer secret")
  })

  test("parses rate-limit metadata and does not retry", async () => {
    const fetchMock = vi.fn(
      async (_request: Request) =>
        new Response(JSON.stringify({ errors: [{ message: "Slow down" }] }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "1234",
            "Retry-After": "5",
          },
        }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const error = await sendGridRequest(
      createSendGridAuth("secret"),
      "marketing/contacts",
      sendGridAcceptedResponseSchema,
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(SendGridApiError)
    expect(error).toMatchObject({
      message: "Slow down",
      statusCode: 429,
      rateLimitLimit: 100,
      rateLimitRemaining: 0,
      rateLimitReset: 1234,
      retryAfterSeconds: 5,
    })
    expect(String(error)).not.toContain("secret")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("uses fallback API errors when SendGrid returns no metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(undefined, {
            status: 500,
          }),
      ),
    )

    await expect(
      sendGridRequest(
        createSendGridAuth("secret"),
        "marketing/contacts",
        sendGridAcceptedResponseSchema,
      ),
    ).rejects.toMatchObject({
      message: "SendGrid API returned 500",
      statusCode: 500,
      rateLimitLimit: undefined,
      retryAfterSeconds: undefined,
    })
  })

  test("parses Retry-After HTTP dates", async () => {
    const now = Date.now()
    vi.spyOn(Date, "now").mockReturnValue(now)
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(undefined, {
            status: 429,
            headers: {
              "Retry-After": new Date(now + 5000).toUTCString(),
            },
          }),
        )
        .mockResolvedValueOnce(
          new Response(undefined, {
            status: 429,
            headers: { "Retry-After": "not-a-date" },
          }),
        ),
    )

    const request = () =>
      sendGridRequest(
        createSendGridAuth("secret"),
        "marketing/contacts",
        sendGridAcceptedResponseSchema,
      ).catch((caught: unknown) => caught)

    await expect(request()).resolves.toMatchObject({ retryAfterSeconds: 5 })
    await expect(request()).resolves.toMatchObject({
      retryAfterSeconds: undefined,
    })
  })

  test("rejects malformed accepted responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ job_id: "" }), {
            status: 202,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    )

    await expect(
      sendGridRequest(
        createSendGridAuth("secret"),
        "marketing/contacts",
        sendGridAcceptedResponseSchema,
      ),
    ).rejects.toThrow()
  })
})
