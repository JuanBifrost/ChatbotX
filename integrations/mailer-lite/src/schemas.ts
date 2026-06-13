import {
  AuthType,
  type BaseConfig,
  type Context,
  customAuthSchema,
  type Handler,
} from "@chatbotx.io/sdk"
import { z } from "zod"

export type MailerLiteConfig = BaseConfig

export const mailerLiteCredentialSchema = z.object({
  apiKey: z.string().trim().min(1),
})
export type MailerLiteCredentialValue = z.infer<
  typeof mailerLiteCredentialSchema
>

export const mailerLiteAuthSchema = customAuthSchema.extend({
  authType: z.literal(AuthType.custom),
  apiKey: z.string().trim().min(1),
})
export type MailerLiteAuthValue = z.infer<typeof mailerLiteAuthSchema>

export const createMailerLiteAuth = (apiKey: string): MailerLiteAuthValue =>
  mailerLiteAuthSchema.parse({
    authType: AuthType.custom,
    apiKey: apiKey.trim(),
  })

export const mailerLiteGroupSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
})
export type MailerLiteGroup = z.infer<typeof mailerLiteGroupSchema>

export const mailerLiteFieldSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  key: z.string().trim().min(1),
  type: z.enum(["text", "number", "date"]),
})
export type MailerLiteField = z.infer<typeof mailerLiteFieldSchema>

const mailerLiteProviderPageMetaSchema = z.object({
  current_page: z.number().int().positive(),
  last_page: z.number().int().positive(),
  per_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

const mailerLitePageLinksSchema = z
  .object({
    first: z.string().nullable().optional(),
    last: z.string().nullable().optional(),
    prev: z.string().nullable().optional(),
    next: z.string().nullable().optional(),
  })
  .optional()

const createMailerLiteProviderPageSchema = <T extends z.ZodType>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
    links: mailerLitePageLinksSchema,
    meta: mailerLiteProviderPageMetaSchema,
  })

export const mailerLiteGroupsResponseSchema =
  createMailerLiteProviderPageSchema(mailerLiteGroupSchema)
export const mailerLiteFieldsResponseSchema =
  createMailerLiteProviderPageSchema(mailerLiteFieldSchema)

export const mailerLitePageMetaSchema = z.object({
  currentPage: z.number().int().positive(),
  lastPage: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export type MailerLitePageMeta = z.infer<typeof mailerLitePageMetaSchema>

export const mailerLiteGroupPageSchema = z.object({
  data: z.array(mailerLiteGroupSchema),
  meta: mailerLitePageMetaSchema,
})
export type MailerLiteGroupPage = z.infer<typeof mailerLiteGroupPageSchema>

export const mailerLiteFieldPageSchema = z.object({
  data: z.array(mailerLiteFieldSchema),
  meta: mailerLitePageMetaSchema,
})
export type MailerLiteFieldPage = z.infer<typeof mailerLiteFieldPageSchema>

const nonEmptyStringRecordSchema = z
  .record(z.string().trim().min(1), z.string().trim().min(1))
  .refine((value) => Object.keys(value).length > 0)

export const mailerLiteSubscriberPayloadSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fields: nonEmptyStringRecordSchema.optional(),
  groups: z.array(z.string().trim().min(1)).min(1).optional(),
  status: z.enum(["active", "unconfirmed"]),
})
export type MailerLiteSubscriberPayload = z.infer<
  typeof mailerLiteSubscriberPayloadSchema
>

export const mailerLiteSubscriberSchema = z.object({
  id: z.string().trim().min(1),
  email: z.string().trim().min(1),
  status: z.string().trim().min(1),
  fields: z.record(z.string(), z.unknown()),
  groups: z.array(z.unknown()).optional(),
})
export const mailerLiteSubscriberResponseSchema = z.object({
  data: mailerLiteSubscriberSchema,
})
export type MailerLiteSubscriberResponse = z.infer<
  typeof mailerLiteSubscriberResponseSchema
>

export const mailerLiteErrorSchema = z.object({
  message: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
})

export type MailerLiteActions = {
  validateCredentials: Handler<
    { props: MailerLiteCredentialValue },
    MailerLiteAuthValue
  >
  listGroups: Handler<
    {
      ctx: Context<MailerLiteAuthValue>
      props: { page: number; limit: number }
    },
    MailerLiteGroupPage
  >
  listFields: Handler<
    {
      ctx: Context<MailerLiteAuthValue>
      props: { page: number; limit: number }
    },
    MailerLiteFieldPage
  >
  createOrUpdateSubscriber: Handler<
    {
      ctx: Context<MailerLiteAuthValue>
      props: MailerLiteSubscriberPayload
    },
    MailerLiteSubscriberResponse
  >
}
