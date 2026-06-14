import ky, { type Options } from "ky"
import type { z } from "zod"
import {
  KLAVIYO_API_BASE_URL,
  KLAVIYO_API_REVISION,
  KLAVIYO_HTTP_TIMEOUT_MS,
} from "./constants"
import { KlaviyoApiError } from "./error"
import {
  type KlaviyoAuthValue,
  klaviyoAuthSchema,
  klaviyoErrorSchema,
} from "./schemas"

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) {
    return
  }
  const seconds = Number.parseInt(value, 10)
  if (Number.isSafeInteger(seconds) && seconds >= 0) {
    return seconds
  }
  const date = Date.parse(value)
  return Number.isNaN(date)
    ? undefined
    : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

const getProviderMessage = (payload: unknown): string | undefined => {
  const parsed = klaviyoErrorSchema.safeParse(payload)
  if (!parsed.success) {
    return
  }
  const firstError = parsed.data.errors[0]
  return firstError?.detail ?? firstError?.title
}

const getKlaviyoClient = (authValue: KlaviyoAuthValue) => {
  const auth = klaviyoAuthSchema.parse(authValue)
  return ky.create({
    baseUrl: KLAVIYO_API_BASE_URL,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Klaviyo-API-Key ${auth.apiKey}`,
      revision: KLAVIYO_API_REVISION,
    },
    retry: 0,
    throwHttpErrors: false,
    timeout: KLAVIYO_HTTP_TIMEOUT_MS,
  })
}

export async function klaviyoRequest<T>(
  authValue: KlaviyoAuthValue,
  path: string,
  schema: z.ZodType<T>,
  options?: Options,
  acceptedStatuses?: readonly number[],
): Promise<T> {
  const response = await getKlaviyoClient(authValue)(path, options)
  const payload: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)
  const accepted =
    response.ok &&
    (!acceptedStatuses || acceptedStatuses.includes(response.status))

  if (!accepted) {
    const message = getProviderMessage(payload)
    throw new KlaviyoApiError({
      message: message
        ? message.replace(EMAIL_PATTERN, "[redacted]")
        : `Klaviyo API returned ${response.status}`,
      statusCode: response.status,
      retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
    })
  }

  return schema.parse(payload)
}
