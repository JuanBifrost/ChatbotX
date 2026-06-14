import { beforeEach, describe, expect, test, vi } from "vitest"

const state = vi.hoisted(() => ({
  count: 0,
  eval: vi.fn(),
}))

const RATE_LIMIT_KEY_PATTERN = /^moosend:subscribe-quota:[a-f0-9]{64}$/u

vi.mock("@chatbotx.io/redis", () => ({
  cacheConnections: {
    useExisting: vi.fn(async () => ({ eval: state.eval })),
  },
}))

const {
  acquireMoosendSubscribePermit,
  buildMoosendRateLimitKey,
  MoosendRateLimitError,
} = await import("../src/integration/handlers/moosend-rate-limit")

beforeEach(() => {
  vi.clearAllMocks()
  state.count = 0
  state.eval.mockImplementation(() => {
    state.count += 1
    return [state.count <= 10 ? 1 : 0, 10_000]
  })
})

describe("Moosend subscribe quota", () => {
  test("permits ten parallel calls and blocks the eleventh", async () => {
    await expect(
      Promise.all(
        Array.from({ length: 10 }, () =>
          acquireMoosendSubscribePermit("secret-api-key"),
        ),
      ),
    ).resolves.toHaveLength(10)
    await expect(
      acquireMoosendSubscribePermit("secret-api-key"),
    ).rejects.toMatchObject({
      retryAfterSeconds: 10,
    })
  })

  test("uses only a SHA-256 API-key fingerprint in Redis", async () => {
    const key = buildMoosendRateLimitKey("secret-api-key")
    expect(key).toMatch(RATE_LIMIT_KEY_PATTERN)
    expect(key).not.toContain("secret-api-key")
    await acquireMoosendSubscribePermit("secret-api-key")
    expect(state.eval.mock.calls[0]).not.toContain("secret-api-key")
  })

  test("fails closed when Redis is unavailable", async () => {
    state.eval.mockRejectedValueOnce(new Error("Redis unavailable"))
    await expect(
      acquireMoosendSubscribePermit("secret-api-key"),
    ).rejects.toThrow("Redis unavailable")
  })

  test("returns a safe local rate-limit error", () => {
    const error = new MoosendRateLimitError(3)
    expect(error.message).not.toContain("secret")
    expect(error).toMatchObject({
      kind: "local_rate_limited",
      retryAfterSeconds: 3,
    })
  })
})
