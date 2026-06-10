import { createHash } from "node:crypto"
import { AuthType } from "@chatbotx.io/sdk"
import ky, { type Options } from "ky"
import { z } from "zod"
import { MAILCHIMP_API_BASE_URL_PATTERN } from "./constants"
import { MailchimpApiError } from "./error"
import { type MailchimpAuthValue, mailchimpAuthSchema } from "./schemas"

const mailchimpErrorSchema = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.number().optional(),
  errors: z
    .array(z.object({ field: z.string(), message: z.string() }))
    .optional(),
})
const MAILCHIMP_DATA_CENTER_PATTERN = /^us\d+$/i

export const extractDataCenter = (apiKey: string): string => {
  const dataCenter = apiKey.trim().split("-").at(-1)
  if (!(dataCenter && MAILCHIMP_DATA_CENTER_PATTERN.test(dataCenter))) {
    throw new MailchimpApiError({
      message: "Invalid Mailchimp API key format",
      statusCode: 400,
    })
  }
  return dataCenter.toLowerCase()
}

export const createMailchimpAuth = (apiKey: string): MailchimpAuthValue =>
  mailchimpAuthSchema.parse({
    authType: AuthType.custom,
    apiKey: apiKey.trim(),
    dataCenter: extractDataCenter(apiKey),
  })

export const getSubscriberHash = (email: string): string =>
  createHash("md5").update(email.trim().toLowerCase()).digest("hex")

export const getMailchimpClient = (auth: MailchimpAuthValue) =>
  ky.create({
    baseUrl: MAILCHIMP_API_BASE_URL_PATTERN.replace(
      "{dataCenter}",
      auth.dataCenter,
    ),
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${auth.apiKey}`).toString("base64")}`,
    },
    retry: 0,
    throwHttpErrors: false,
  })

export async function mailchimpRequest<T>(
  auth: MailchimpAuthValue,
  endpoint: string,
  schema: z.ZodType<T>,
  options?: Options,
): Promise<T> {
  const response = await getMailchimpClient(auth)(endpoint, options)
  const payload: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined)

  if (!response.ok) {
    const parsed = mailchimpErrorSchema.safeParse(payload)
    const detail = parsed.success ? parsed.data.detail : undefined
    const errors = parsed.success ? parsed.data.errors : undefined
    const retryAfterHeader = response.headers.get("retry-after")
    const retryAfter = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10)
      : undefined
    throw new MailchimpApiError({
      message:
        (errors?.length
          ? errors.map((item) => `${item.field}: ${item.message}`).join(", ")
          : parsed.success && (parsed.data.detail || parsed.data.title)) ||
        `Mailchimp API returned ${response.status}`,
      statusCode: response.status,
      detail,
      errors,
      retryAfter: Number.isNaN(retryAfter) ? undefined : retryAfter,
    })
  }

  return schema.parse(payload)
}
