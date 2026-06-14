import ky, { type Options } from "ky"
import type { z } from "zod"
import { SENDGRID_API_BASE_URL, SENDGRID_HTTP_TIMEOUT_MS } from "./constants"
import { SendGridApiError } from "./error"
import {
  type SendGridAuthValue,
  sendGridAuthSchema,
  sendGridErrorSchema,
} from "./schemas"

const parseIntegerHeader = (value: string | null): number | undefined => {
  if (!value) {
    return
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

const parseRetryAfter = (value: string | null): number | undefined => {
  const seconds = parseIntegerHeader(value)
  if (seconds !== undefined) {
    return seconds
  }
  if (!value) {
    return
  }
  const date = Date.parse(value)
  return Number.isNaN(date)
    ? undefined
    : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

export const getSendGridClient = (authValue: SendGridAuthValue) => {
  const auth = sendGridAuthSchema.parse(authValue)
  return ky.create({
    baseUrl: SENDGRID_API_BASE_URL,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${auth.apiKey}`,
      "Content-Type": "application/json",
    },
    retry: 0,
    throwHttpErrors: false,
    timeout: SENDGRID_HTTP_TIMEOUT_MS,
  })
}

export async function sendGridRequest<T>(
  authValue: SendGridAuthValue,
  path: string,
  schema: z.ZodType<T>,
  options?: Options,
): Promise<T> {
  const response = await getSendGridClient(authValue)(path, options)
  const payload: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const parsed = sendGridErrorSchema.safeParse(payload)
    const firstError = parsed.success ? parsed.data.errors?.[0] : undefined
    throw new SendGridApiError({
      message:
        firstError?.message ?? `SendGrid API returned ${response.status}`,
      statusCode: response.status,
      field: firstError?.field,
      errorId: parsed.success ? parsed.data.id : undefined,
      rateLimitLimit: parseIntegerHeader(
        response.headers.get("X-RateLimit-Limit"),
      ),
      rateLimitRemaining: parseIntegerHeader(
        response.headers.get("X-RateLimit-Remaining"),
      ),
      rateLimitReset: parseIntegerHeader(
        response.headers.get("X-RateLimit-Reset"),
      ),
      retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
    })
  }
  return schema.parse(payload)
}
