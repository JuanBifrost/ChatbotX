import { afterEach, describe, expect, test, vi } from "vitest"
import { moosendRequest } from "../src/client"
import { moosendListsPagePath, moosendSubscribePath } from "../src/constants"
import { MoosendApiError } from "../src/error"
import {
  createMoosendAuth,
  moosendMailingListsResponseSchema,
  moosendSubscriberResponseSchema,
} from "../src/schemas"

const secret = "secret-api-key"
const email = "person@example.com"
const name = "Private Person"

const listsResponse = {
  Code: 0,
  Error: null,
  Context: {
    Paging: {
      PageSize: 20,
      CurrentPage: 2,
      TotalResults: 21,
      TotalPageCount: 2,
    },
    MailingLists: [{ ID: "list-1", Name: "Customers" }],
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Moosend HTTP client", () => {
  test("adds API key through query auth and preserves caller search params", async () => {
    const fetchMock = vi.fn(async (_request: Request) =>
      Response.json(listsResponse, { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await moosendRequest(
      createMoosendAuth(secret),
      moosendListsPagePath(2, 20),
      moosendMailingListsResponseSchema,
      { searchParams: { apikey: "override", trace: "safe" } },
    )

    const request = fetchMock.mock.calls[0]?.[0] as Request
    const url = new URL(request.url)
    expect(url.pathname).toBe("/v3/lists/2/20.json")
    expect(url.searchParams.get("apikey")).toBe(secret)
    expect(url.searchParams.get("trace")).toBe("safe")
    expect(request.headers.get("Accept")).toBe("application/json")
  })

  test("encodes list IDs and sends exact PascalCase JSON once", async () => {
    let body: unknown
    const fetchMock = vi.fn(async (request: Request) => {
      body = await request.clone().json()
      return Response.json({
        Code: 0,
        Error: null,
        Context: {
          ID: "subscriber-1",
          Email: email,
          Name: name,
          SubscribeType: 1,
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await moosendRequest(
      createMoosendAuth(secret),
      moosendSubscribePath("list/one"),
      moosendSubscriberResponseSchema,
      { method: "post", json: { Email: email, Name: name } },
    )

    expect(
      new URL((fetchMock.mock.calls[0]?.[0] as Request).url).pathname,
    ).toBe("/v3/subscribers/list%2Fone/subscribe.json")
    expect(body).toEqual({ Email: email, Name: name })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("maps provider and HTTP failures to sanitized typed errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            Code: 1001,
            Error: "USER_NOT_ENABLED",
            ErrorMessage: `${secret} ${email} ${name}`,
            Context: null,
          },
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { Code: 429, Error: "quota", Context: null },
          { status: 429, headers: { "Retry-After": "5" } },
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    const providerError = await moosendRequest(
      createMoosendAuth(secret),
      moosendListsPagePath(1, 1),
      moosendMailingListsResponseSchema,
    ).catch((caught: unknown) => caught)
    const rateError = await moosendRequest(
      createMoosendAuth(secret),
      moosendListsPagePath(1, 1),
      moosendMailingListsResponseSchema,
    ).catch((caught: unknown) => caught)

    expect(providerError).toMatchObject({
      kind: "user_not_enabled",
      providerCode: 1001,
      statusCode: 200,
    })
    expect(rateError).toMatchObject({
      kind: "rate_limited",
      providerCode: 429,
      retryAfterSeconds: 5,
      statusCode: 429,
    })
    for (const error of [providerError, rateError]) {
      expect(error).toBeInstanceOf(MoosendApiError)
      const observable = `${String(error)} ${JSON.stringify(error)}`
      expect(observable).not.toContain(secret)
      expect(observable).not.toContain(email)
      expect(observable).not.toContain(name)
      expect(observable).not.toContain("https://")
    }
  })

  test("sanitizes transport and malformed response errors without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error(`${secret} https://api.moosend.com`))
      .mockResolvedValueOnce(Response.json({ Code: 0 }, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const request = () =>
      moosendRequest(
        createMoosendAuth(secret),
        moosendListsPagePath(1, 1),
        moosendMailingListsResponseSchema,
      )

    await expect(request()).rejects.toMatchObject({ kind: "transport" })
    await expect(request()).rejects.toMatchObject({ kind: "invalid_response" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
