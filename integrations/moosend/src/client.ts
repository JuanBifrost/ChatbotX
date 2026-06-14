import ky, { type Options } from "ky"
import type { z } from "zod"
import { MOOSEND_API_BASE_URL, MOOSEND_HTTP_TIMEOUT_MS } from "./constants"
import { MoosendApiError, type MoosendApiErrorKind } from "./error"
import {
  type MoosendAuthValue,
  moosendAuthSchema,
  moosendProviderEnvelopeSchema,
} from "./schemas"

const createSearchParams = (searchParams: Options["searchParams"]) => {
  const result = new URLSearchParams()
  if (!searchParams) {
    return result
  }
  if (
    typeof searchParams === "string" ||
    searchParams instanceof URLSearchParams
  ) {
    return new URLSearchParams(searchParams)
  }
  if (Array.isArray(searchParams)) {
    for (const [key, value] of searchParams) {
      result.append(String(key), String(value))
    }
    return result
  }
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) {
      result.append(key, String(value))
    }
  }
  return result
}

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

const errorKind = (
  statusCode: number,
  error?: string | null,
  errorMessage?: string | null,
): MoosendApiErrorKind => {
  if (error === "USER_NOT_ENABLED" || errorMessage === "USER_NOT_ENABLED") {
    return "user_not_enabled"
  }
  if (statusCode === 401 || statusCode === 403) {
    return "invalid_credentials"
  }
  if (statusCode === 429) {
    return "rate_limited"
  }
  return "provider"
}

const moosendClient = ky.create({
  baseUrl: MOOSEND_API_BASE_URL,
  headers: { Accept: "application/json" },
  retry: 0,
  throwHttpErrors: false,
  timeout: MOOSEND_HTTP_TIMEOUT_MS,
})

export async function moosendRequest<T>(
  authValue: MoosendAuthValue,
  path: string,
  schema: z.ZodType<T>,
  options?: Options,
  acceptedStatuses: readonly number[] = [200],
): Promise<T> {
  const auth = moosendAuthSchema.parse(authValue)
  const searchParams = createSearchParams(options?.searchParams)
  searchParams.set("apikey", auth.apiKey)

  let response: Response
  try {
    response = await moosendClient(path, { ...options, searchParams })
  } catch {
    throw new MoosendApiError({ kind: "transport", statusCode: 503 })
  }

  const payload: unknown = await response.json().catch(() => undefined)
  const envelope = moosendProviderEnvelopeSchema.safeParse(payload)
  if (!envelope.success) {
    const kind = response.ok ? "invalid_response" : errorKind(response.status)
    throw new MoosendApiError({
      kind,
      statusCode: response.status,
      retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
    })
  }

  const providerFailed =
    envelope.data.Code !== 0 ||
    Boolean(envelope.data.Error) ||
    Boolean(envelope.data.ErrorMessage)
  if (
    !(response.ok && acceptedStatuses.includes(response.status)) ||
    providerFailed
  ) {
    throw new MoosendApiError({
      kind: errorKind(
        response.status,
        envelope.data.Error,
        envelope.data.ErrorMessage,
      ),
      statusCode: response.status,
      providerCode: envelope.data.Code,
      retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
    })
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new MoosendApiError({
      kind: "invalid_response",
      statusCode: response.status,
      providerCode: envelope.data.Code,
    })
  }
  return parsed.data
}
