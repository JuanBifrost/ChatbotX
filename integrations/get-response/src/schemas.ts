import {
  AuthType,
  type BaseConfig,
  type Context,
  customAuthSchema,
  type Handler,
} from "@chatbotx.io/sdk"
import { z } from "zod"

export type GetResponseConfig = BaseConfig

export const getResponseCredentialSchema = z.object({
  apiKey: z.string().trim().min(1),
})
export type GetResponseCredentialValue = z.infer<
  typeof getResponseCredentialSchema
>

export const getResponseAuthSchema = customAuthSchema.extend({
  authType: z.literal(AuthType.custom),
  apiKey: z.string().trim().min(1),
})
export type GetResponseAuthValue = z.infer<typeof getResponseAuthSchema>

export const createGetResponseAuth = (apiKey: string): GetResponseAuthValue =>
  getResponseAuthSchema.parse({
    authType: AuthType.custom,
    apiKey: apiKey.trim(),
  })

export const getResponseCampaignSchema = z
  .object({
    campaignId: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })
  .passthrough()
export type GetResponseCampaign = z.infer<typeof getResponseCampaignSchema>

export const getResponseTagSchema = z
  .object({
    tagId: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })
  .passthrough()
export type GetResponseTag = z.infer<typeof getResponseTagSchema>

export const getResponseCampaignsResponseSchema = z.array(
  getResponseCampaignSchema,
)
export const getResponseTagsResponseSchema = z.array(getResponseTagSchema)

export const getResponseAccountSchema = z
  .object({
    accountId: z.string().trim().min(1),
    login: z.string().trim().min(1).optional(),
    email: z.string().trim().email(),
  })
  .passthrough()
export type GetResponseAccount = z.infer<typeof getResponseAccountSchema>

export const getResponseAccountsResponseSchema = getResponseAccountSchema

export const getResponseContactPayloadSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).optional(),
  campaign: z.object({
    campaignId: z.string().trim().min(1),
  }),
  dayOfCycle: z.number().int().min(0).optional(),
  tags: z
    .array(
      z.object({
        tagId: z.string().trim().min(1),
      }),
    )
    .optional(),
})
export type GetResponseContactPayload = z.infer<
  typeof getResponseContactPayloadSchema
>

export const getResponseContactResponseSchema = z.undefined()

export const getResponseErrorSchema = z.object({
  message: z.string().optional(),
  errors: z.unknown().optional(),
})

export const getResponsePageMetaSchema = z.object({
  currentPage: z.number().int().positive(),
  lastPage: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})
export type GetResponsePageMeta = z.infer<typeof getResponsePageMetaSchema>

export const getResponseCampaignPageSchema = z.object({
  data: z.array(getResponseCampaignSchema),
  meta: getResponsePageMetaSchema,
})
export type GetResponseCampaignPage = z.infer<
  typeof getResponseCampaignPageSchema
>

export const getResponseTagPageSchema = z.object({
  data: z.array(getResponseTagSchema),
  meta: getResponsePageMetaSchema,
})
export type GetResponseTagPage = z.infer<typeof getResponseTagPageSchema>

export type GetResponseActions = {
  validateCredentials: Handler<
    { props: GetResponseCredentialValue },
    GetResponseAuthValue
  >
  listCampaigns: Handler<
    {
      ctx: Context<GetResponseAuthValue>
      props: { page: number; perPage: number }
    },
    GetResponseCampaignPage
  >
  listTags: Handler<
    {
      ctx: Context<GetResponseAuthValue>
      props: { page: number; perPage: number }
    },
    GetResponseTagPage
  >
  createOrUpdateContact: Handler<
    {
      ctx: Context<GetResponseAuthValue>
      props: GetResponseContactPayload
    },
    void
  >
}
