import ky, { type Options } from "ky"
import type { z } from "zod"
import { DRIP_API_BASE_URL, DRIP_HTTP_TIMEOUT_MS } from "./constants"
import { DripApiError } from "./error"
import {
  type DripAuthValue,
  type DripCredentialValue,
  dripCredentialSchema,
  dripErrorSchema,
} from "./schemas"

const parseRateLimitHeader = (value: string | null): number | undefined => {
  if (!value) {
    return
  }
  const n = Number.parseInt(value, 10)
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined
}

export const getDripClient = (auth: DripCredentialValue) => {
  const basicCredential = Buffer.from(`${auth.apiToken}:`).toString("base64")
  return ky.create({
    baseUrl: DRIP_API_BASE_URL,
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${basicCredential}`,
      "Content-Type": "application/json",
    },
    retry: 0,
    throwHttpErrors: false,
    timeout: DRIP_HTTP_TIMEOUT_MS,
  })
}

export async function dripRequest<T>(
  authValue: DripAuthValue | DripCredentialValue,
  path: string,
  schema: z.ZodType<T>,
  options?: Options,
): Promise<T> {
  const auth = dripCredentialSchema.parse(authValue)
  const client = getDripClient(auth)
  const response = await client(path, options)
  const payload: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)

  if (!response.ok) {
    const parsed = dripErrorSchema.safeParse(payload)
    const firstError =
      parsed.success && parsed.data.errors?.[0]?.message
        ? parsed.data.errors[0].message
        : undefined
    throw new DripApiError({
      message: firstError ?? `Drip API returned ${response.status}`,
      statusCode: response.status,
      rateLimitLimit: parseRateLimitHeader(
        response.headers.get("X-RateLimit-Limit"),
      ),
      rateLimitRemaining: parseRateLimitHeader(
        response.headers.get("X-RateLimit-Remaining"),
      ),
    })
  }

  return schema.parse(payload)
}
