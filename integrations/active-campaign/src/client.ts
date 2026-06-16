import ky, { type Options } from "ky"
import type { z } from "zod"
import { ACTIVE_CAMPAIGN_HTTP_TIMEOUT_MS } from "./constants"
import { ActiveCampaignApiError } from "./error"
import {
  type ActiveCampaignAuthValue,
  type ActiveCampaignCredentialValue,
  activeCampaignCredentialSchema,
  activeCampaignErrorSchema,
} from "./schemas"

const getErrorMessage = (payload: unknown, status: number) => {
  const parsed = activeCampaignErrorSchema.safeParse(payload)
  if (!parsed.success) {
    return `ActiveCampaign API returned ${status}`
  }

  if (parsed.data.message) {
    return parsed.data.message
  }

  if (Array.isArray(parsed.data.errors) && parsed.data.errors.length > 0) {
    const first = parsed.data.errors[0]
    if (
      first &&
      typeof first === "object" &&
      "title" in first &&
      typeof first.title === "string"
    ) {
      return first.title
    }
    if (
      first &&
      typeof first === "object" &&
      "detail" in first &&
      typeof first.detail === "string"
    ) {
      return first.detail
    }
  }

  return `ActiveCampaign API returned ${status}`
}

export const getActiveCampaignClient = (
  authValue: ActiveCampaignAuthValue | ActiveCampaignCredentialValue,
) => {
  const auth = activeCampaignCredentialSchema.parse(authValue)
  return ky.create({
    baseUrl: auth.apiUrl,
    headers: {
      Accept: "application/json",
      "Api-Token": auth.apiKey,
      "Content-Type": "application/json",
    },
    retry: 0,
    throwHttpErrors: false,
    timeout: ACTIVE_CAMPAIGN_HTTP_TIMEOUT_MS,
  })
}

export async function activeCampaignRequest<T>(
  authValue: ActiveCampaignAuthValue | ActiveCampaignCredentialValue,
  path: string,
  schema: z.ZodType<T>,
  options?: Options,
): Promise<T> {
  const client = getActiveCampaignClient(authValue)
  const response = await client(path, options)
  const payload: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)

  if (!response.ok) {
    throw new ActiveCampaignApiError({
      message: getErrorMessage(payload, response.status),
      statusCode: response.status,
      providerErrors: payload,
    })
  }

  return schema.parse(payload)
}
