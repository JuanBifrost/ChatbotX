import {
  AuthType,
  type BaseConfig,
  type Context,
  customAuthSchema,
  type Handler,
} from "@chatbotx.io/sdk"
import { z } from "zod"

export type DripConfig = BaseConfig

const positiveNumericStringSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "Account ID must be a positive numeric string")

export const dripCredentialSchema = z.object({
  apiToken: z.string().trim().min(1),
})
export type DripCredentialValue = z.infer<typeof dripCredentialSchema>

export const dripAuthSchema = customAuthSchema.extend({
  authType: z.literal(AuthType.custom),
  apiToken: z.string().trim().min(1),
})
export type DripAuthValue = z.infer<typeof dripAuthSchema>

export const createDripAuth = (apiToken: string): DripAuthValue =>
  dripAuthSchema.parse({
    authType: AuthType.custom,
    apiToken: apiToken.trim(),
  })

export const dripAccountSchema = z.object({
  id: z
    .union([positiveNumericStringSchema, z.number().int().positive().safe()])
    .transform(String),
  name: z.string().optional(),
})
export type DripAccount = z.infer<typeof dripAccountSchema>

export const dripAccountsResponseSchema = z.object({
  accounts: z.array(dripAccountSchema).default([]),
})

export const dripTagsResponseSchema = z.object({
  tags: z.array(z.string()).default([]),
})

export const dripCustomFieldSchema = z.object({
  identifier: z.string(),
  label: z.string(),
})
export type DripCustomField = z.infer<typeof dripCustomFieldSchema>

export const dripCustomFieldIdentifiersResponseSchema = z.object({
  custom_field_identifiers: z.array(z.string().trim().min(1)).default([]),
})

export const dripSubscriberPayloadSchema = z.object({
  email: z.string().min(1),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  tags: z.array(z.string()).min(1).optional(),
  custom_fields: z.record(z.string(), z.string()).optional(),
})
export type DripSubscriberPayload = z.infer<typeof dripSubscriberPayloadSchema>

export const dripSubscriberResponseSchema = z.object({
  subscribers: z
    .array(
      z.object({
        id: z.string().optional(),
        email: z.string().optional(),
      }),
    )
    .optional(),
})

export const dripErrorSchema = z.object({
  errors: z
    .array(
      z.object({
        code: z.string().optional(),
        message: z.string().optional(),
      }),
    )
    .optional(),
})

export type DripActions = {
  validateCredentials: Handler<{ props: DripCredentialValue }, DripAuthValue>
  listAccounts: Handler<
    { ctx: Context<DripAuthValue>; props: Record<string, never> },
    DripAccount[]
  >
  listTags: Handler<
    { ctx: Context<DripAuthValue>; props: { accountId: string } },
    string[]
  >
  listCustomFields: Handler<
    { ctx: Context<DripAuthValue>; props: { accountId: string } },
    DripCustomField[]
  >
  syncSubscriber: Handler<
    {
      ctx: Context<DripAuthValue>
      props: DripSubscriberPayload & { accountId: string }
    },
    void
  >
}
