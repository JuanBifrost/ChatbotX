import ky, { type Options } from "ky"
import type { z } from "zod"
import {
  GET_RESPONSE_API_BASE_URL,
  GET_RESPONSE_HTTP_TIMEOUT_MS,
} from "./constants"
import { GetResponseApiError } from "./error"
import {
  type GetResponseAuthValue,
  getResponseAuthSchema,
  getResponseErrorSchema,
} from "./schemas"

export type GetResponseRequestResult<T> = {
  data: T
  totalCount: number
}

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu

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

const sanitizeProviderMessage = (message: string) =>
  message.replace(EMAIL_PATTERN, "[redacted]")

const dataLength = (data: unknown): number =>
  Array.isArray(data) ? data.length : 1

export const getGetResponseClient = (authValue: GetResponseAuthValue) => {
  const auth = getResponseAuthSchema.parse(authValue)
  return ky.create({
    baseUrl: GET_RESPONSE_API_BASE_URL,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Auth-Token": `api-key ${auth.apiKey}`,
    },
    retry: 0,
    throwHttpErrors: false,
    timeout: GET_RESPONSE_HTTP_TIMEOUT_MS,
  })
}

export async function getResponseRequest<T>(
  authValue: GetResponseAuthValue,
  path: string,
  schema: z.ZodType<T>,
  options?: Options,
  acceptedStatuses?: readonly number[],
): Promise<GetResponseRequestResult<T>> {
  const response = await getGetResponseClient(authValue)(path, options)
  const payload: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)
  const accepted = acceptedStatuses
    ? acceptedStatuses.includes(response.status)
    : response.ok

  if (!accepted) {
    const parsed = getResponseErrorSchema.safeParse(payload)
    throw new GetResponseApiError({
      message:
        parsed.success && parsed.data.message
          ? sanitizeProviderMessage(parsed.data.message)
          : `GetResponse API returned ${response.status}`,
      statusCode: response.status,
      retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
    })
  }

  const data = schema.parse(payload)
  return {
    data,
    totalCount:
      parseIntegerHeader(response.headers.get("X-Total-Count")) ??
      dataLength(data),
  }
}
