import {
  AuthType,
  type BaseConfig,
  type Context,
  customAuthSchema,
  type Handler,
} from "@chatbotx.io/sdk"
import { z } from "zod"

export type MoosendConfig = BaseConfig

export const moosendCredentialSchema = z.object({
  apiKey: z.string().trim().min(1),
})
export type MoosendCredentialValue = z.infer<typeof moosendCredentialSchema>

export const moosendAuthSchema = customAuthSchema.extend({
  authType: z.literal(AuthType.custom),
  apiKey: z.string().trim().min(1),
})
export type MoosendAuthValue = z.infer<typeof moosendAuthSchema>

export const createMoosendAuth = (apiKey: string): MoosendAuthValue =>
  moosendAuthSchema.parse({ authType: AuthType.custom, apiKey: apiKey.trim() })

export const moosendProviderEnvelopeSchema = z.object({
  Code: z.number().int(),
  Error: z.string().nullable().optional(),
  ErrorMessage: z.string().nullable().optional(),
  Context: z.unknown().optional(),
})

const moosendProviderMailingListSchema = z.object({
  ID: z.string().trim().min(1),
  Name: z.string().trim().min(1),
})

const moosendProviderPagingSchema = z.object({
  PageSize: z.number().int().positive(),
  CurrentPage: z.number().int().positive(),
  TotalResults: z.number().int().nonnegative(),
  TotalPageCount: z.number().int().nonnegative(),
})

export const moosendMailingListsResponseSchema = z.object({
  Code: z.literal(0),
  Error: z.null().optional(),
  ErrorMessage: z.null().optional(),
  Context: z.object({
    Paging: moosendProviderPagingSchema,
    MailingLists: z.array(moosendProviderMailingListSchema),
  }),
})

export const moosendMailingListSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
})
export type MoosendMailingList = z.infer<typeof moosendMailingListSchema>

export const moosendMailingListPageSchema = z.object({
  data: z.array(moosendMailingListSchema),
  meta: z.object({
    pageSize: z.number().int().positive(),
    currentPage: z.number().int().positive(),
    totalResults: z.number().int().nonnegative(),
    totalPageCount: z.number().int().nonnegative(),
  }),
})
export type MoosendMailingListPage = z.infer<
  typeof moosendMailingListPageSchema
>

export const moosendListPageRequestSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})

export const moosendContactPayloadSchema = z.object({
  listId: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
})
export type MoosendContactPayload = z.infer<typeof moosendContactPayloadSchema>

const moosendProviderSubscriberSchema = z.object({
  ID: z.string().trim().min(1),
  Email: z.string().trim().min(1),
  SubscribeType: z.number().int(),
})

export const moosendSubscriberResponseSchema = z.object({
  Code: z.literal(0),
  Error: z.null().optional(),
  ErrorMessage: z.null().optional(),
  Context: moosendProviderSubscriberSchema,
})

export const moosendSubscriberSchema = z.object({
  id: z.string().trim().min(1),
  email: z.string().trim().min(1),
  subscribeType: z.number().int(),
})
export type MoosendSubscriber = z.infer<typeof moosendSubscriberSchema>

export type MoosendActions = {
  validateCredentials: Handler<
    { props: MoosendCredentialValue },
    MoosendAuthValue
  >
  listMailingLists: Handler<
    {
      ctx: Context<MoosendAuthValue>
      props: z.infer<typeof moosendListPageRequestSchema>
    },
    MoosendMailingListPage
  >
  createOrUpdateContact: Handler<
    {
      ctx: Context<MoosendAuthValue>
      props: MoosendContactPayload
    },
    MoosendSubscriber
  >
}
