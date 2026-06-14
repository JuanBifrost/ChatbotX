import { createHash } from "node:crypto"
import { cacheConnections } from "@chatbotx.io/redis"
import { z } from "zod"

export const MOOSEND_SUBSCRIBE_LIMIT = 10
export const MOOSEND_SUBSCRIBE_WINDOW_MS = 10_000

const RATE_LIMIT_LUA = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if count > tonumber(ARGV[2]) then
  return {0, ttl}
end
return {1, ttl}
`

const rateLimitResultSchema = z.tuple([z.number().int(), z.number().int()])

const hash = (value: string) => createHash("sha256").update(value).digest("hex")

export const buildMoosendRateLimitKey = (apiKey: string) =>
  `moosend:subscribe-quota:${hash(apiKey)}`

export class MoosendRateLimitError extends Error {
  readonly kind = "local_rate_limited"
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super("Moosend local rate limit exceeded")
    this.name = "MoosendRateLimitError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export const acquireMoosendSubscribePermit = async (apiKey: string) => {
  const redis = await cacheConnections.useExisting()
  const result = rateLimitResultSchema.parse(
    await redis.eval(
      RATE_LIMIT_LUA,
      1,
      buildMoosendRateLimitKey(apiKey),
      MOOSEND_SUBSCRIBE_WINDOW_MS,
      MOOSEND_SUBSCRIBE_LIMIT,
    ),
  )
  if (result[0] !== 1) {
    throw new MoosendRateLimitError(Math.max(1, Math.ceil(result[1] / 1000)))
  }
}
