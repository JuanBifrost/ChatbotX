import { afterEach, describe, expect, test, vi } from "vitest"
import { getResponseRequest } from "../src/client"
import { GetResponseApiError } from "../src/error"
import {
  createGetResponseAuth,
  getResponseCampaignsResponseSchema,
  getResponseContactResponseSchema,
} from "../src/schemas"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("GetResponse HTTP client", () => {
  test("uses GetResponse API-key auth header and exact relative path", async () => {
    const fetchMock = vi.fn(
      async (_request: Request) =>
        new Response(
          JSON.stringify([{ campaignId: "campaign-1", name: "Main list" }]),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Total-Count": "1",
            },
          },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getResponseRequest(
        createGetResponseAuth(" secret "),
        "campaigns",
        getResponseCampaignsResponseSchema,
        {
          searchParams: new URLSearchParams({
            page: "2",
            perPage: "100",
          }),
        },
        [200],
      ),
    ).resolves.toEqual({
      data: [{ campaignId: "campaign-1", name: "Main list" }],
      totalCount: 1,
    })

    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(request.url).toBe(
      "https://api.getresponse.com/v3/campaigns?page=2&perPage=100",
    )
    expect(request.headers.get("X-Auth-Token")).toBe("api-key secret")
    expect(request.headers.get("Authorization")).toBeNull()
    expect(request.headers.get("Accept")).toBe("application/json")
  })

  test("accepts 202 for contact creation without a response body", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 202,
        }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getResponseRequest(
        createGetResponseAuth("secret"),
        "contacts",
        getResponseContactResponseSchema,
        { method: "post", json: { email: "person@example.com" } },
        [202],
      ),
    ).resolves.toEqual({ data: undefined, totalCount: 1 })
  })

  test("falls back total count to array length when header is absent or invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { campaignId: "campaign-1", name: "Main list" },
              { campaignId: "campaign-2", name: "VIP" },
            ]),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "X-Total-Count": "not-a-number",
              },
            },
          ),
      ),
    )

    await expect(
      getResponseRequest(
        createGetResponseAuth("secret"),
        "campaigns",
        getResponseCampaignsResponseSchema,
        undefined,
        [200],
      ),
    ).resolves.toMatchObject({ totalCount: 2 })
  })

  test("maps provider errors, retry metadata, redacts PII, and does not retry", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ message: "Rejected person@example.com" }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "7",
            },
          },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const error = await getResponseRequest(
      createGetResponseAuth("secret"),
      "contacts",
      getResponseContactResponseSchema,
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(GetResponseApiError)
    expect(error).toMatchObject({
      message: "Rejected [redacted]",
      statusCode: 429,
      retryAfterSeconds: 7,
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
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    )

    const request = () =>
      getResponseRequest(
        createGetResponseAuth("secret"),
        "contacts",
        getResponseContactResponseSchema,
        undefined,
        [202],
      )

    await expect(request()).rejects.toThrow()
    await expect(request()).rejects.toMatchObject({ statusCode: 200 })
  })
})
