import ky, { type Options } from "ky"
import type { z } from "zod"
import {
  MAILER_LITE_API_BASE_URL,
  MAILER_LITE_HTTP_TIMEOUT_MS,
} from "./constants"
import { MailerLiteApiError } from "./error"
import {
  type MailerLiteAuthValue,
  mailerLiteAuthSchema,
  mailerLiteErrorSchema,
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

export const getMailerLiteClient = (authValue: MailerLiteAuthValue) => {
  const auth = mailerLiteAuthSchema.parse(authValue)
  return ky.create({
    baseUrl: MAILER_LITE_API_BASE_URL,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${auth.apiKey}`,
      "Content-Type": "application/json",
    },
    retry: 0,
    throwHttpErrors: false,
    timeout: MAILER_LITE_HTTP_TIMEOUT_MS,
  })
}

export async function mailerLiteRequest<T>(
  authValue: MailerLiteAuthValue,
  path: string,
  schema: z.ZodType<T>,
  options?: Options,
  acceptedStatuses?: readonly number[],
): Promise<T> {
  const response = await getMailerLiteClient(authValue)(path, options)
  const payload: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)
  const accepted =
    response.ok &&
    (!acceptedStatuses || acceptedStatuses.includes(response.status))
  if (!accepted) {
    const parsed = mailerLiteErrorSchema.safeParse(payload)
    throw new MailerLiteApiError({
      message:
        parsed.success && parsed.data.message
          ? parsed.data.message.replace(
              /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu,
              "[redacted]",
            )
          : `MailerLite API returned ${response.status}`,
      statusCode: response.status,
      rateLimitLimit: parseIntegerHeader(
        response.headers.get("X-RateLimit-Limit"),
      ),
      rateLimitRemaining: parseIntegerHeader(
        response.headers.get("X-RateLimit-Remaining"),
      ),
      retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
    })
  }
  return schema.parse(payload)
}
