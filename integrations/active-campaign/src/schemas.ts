import {
  AuthType,
  type BaseConfig,
  type Context,
  customAuthSchema,
  type Handler,
} from "@chatbotx.io/sdk"
import { z } from "zod"
import { normalizeActiveCampaignApiUrl } from "./constants"

export type ActiveCampaignConfig = BaseConfig

const activeCampaignIdSchema = z
  .union([z.string().trim().min(1), z.number().int().nonnegative().safe()])
  .transform(String)

export const activeCampaignCredentialSchema = z.object({
  apiUrl: z.string().trim().url().transform(normalizeActiveCampaignApiUrl),
  apiKey: z.string().trim().min(1),
})
export type ActiveCampaignCredentialValue = z.infer<
  typeof activeCampaignCredentialSchema
>

export const activeCampaignAuthSchema = customAuthSchema.extend({
  authType: z.literal(AuthType.custom),
  apiUrl: z.string().trim().url().transform(normalizeActiveCampaignApiUrl),
  apiKey: z.string().trim().min(1),
})
export type ActiveCampaignAuthValue = z.infer<typeof activeCampaignAuthSchema>

export const createActiveCampaignAuth = (
  credential: ActiveCampaignCredentialValue,
): ActiveCampaignAuthValue =>
  activeCampaignAuthSchema.parse({
    authType: AuthType.custom,
    apiUrl: credential.apiUrl,
    apiKey: credential.apiKey,
  })

export const activeCampaignAccountSchema = z
  .object({
    id: activeCampaignIdSchema.optional(),
    name: z.string().optional(),
    account: z.string().optional(),
  })
  .passthrough()
export type ActiveCampaignAccount = z.infer<typeof activeCampaignAccountSchema>

export const activeCampaignAccountsResponseSchema = z.object({
  accounts: z.array(activeCampaignAccountSchema).default([]),
})

export const activeCampaignListSchema = z
  .object({
    id: activeCampaignIdSchema,
    name: z.string().optional(),
  })
  .passthrough()
export type ActiveCampaignList = z.infer<typeof activeCampaignListSchema>

export const activeCampaignListsResponseSchema = z.object({
  lists: z.array(activeCampaignListSchema).default([]),
})

export const activeCampaignAutomationSchema = z
  .object({
    id: activeCampaignIdSchema,
    name: z.string().optional(),
  })
  .passthrough()
export type ActiveCampaignAutomation = z.infer<
  typeof activeCampaignAutomationSchema
>

export const activeCampaignAutomationsResponseSchema = z.object({
  automations: z.array(activeCampaignAutomationSchema).default([]),
})

export const activeCampaignTagSchema = z
  .object({
    id: activeCampaignIdSchema,
    tag: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough()
export type ActiveCampaignTag = z.infer<typeof activeCampaignTagSchema>

export const activeCampaignTagsResponseSchema = z.object({
  tags: z.array(activeCampaignTagSchema).default([]),
})

export const activeCampaignCustomFieldSchema = z
  .object({
    id: activeCampaignIdSchema,
    label: z.string().optional(),
    title: z.string().optional(),
    perstag: z.string().optional(),
  })
  .transform((field) => ({
    id: field.id,
    label: field.label || field.title || field.perstag || field.id,
  }))
export type ActiveCampaignCustomField = z.infer<
  typeof activeCampaignCustomFieldSchema
>

export const activeCampaignFieldsResponseSchema = z.object({
  fields: z.array(activeCampaignCustomFieldSchema).default([]),
})

export const activeCampaignContactPayloadSchema = z.object({
  email: z.string().trim().min(1),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  fieldValues: z
    .array(
      z.object({
        fieldId: z.string().trim().min(1),
        value: z.string().trim().min(1),
      }),
    )
    .default([]),
})
export type ActiveCampaignContactPayload = z.infer<
  typeof activeCampaignContactPayloadSchema
>

export const activeCampaignContactSchema = z
  .object({
    id: activeCampaignIdSchema,
    email: z.string().optional(),
  })
  .passthrough()
export type ActiveCampaignContact = z.infer<typeof activeCampaignContactSchema>

export const activeCampaignContactSyncResponseSchema = z.object({
  contact: activeCampaignContactSchema,
})

export const activeCampaignEmptyResponseSchema = z.unknown()

export const activeCampaignContactAutomationSchema = z
  .object({
    id: activeCampaignIdSchema.optional(),
    contact: activeCampaignIdSchema.optional(),
    seriesid: activeCampaignIdSchema.optional(),
    automation: activeCampaignIdSchema.optional(),
  })
  .passthrough()
export type ActiveCampaignContactAutomation = z.infer<
  typeof activeCampaignContactAutomationSchema
>

export const activeCampaignContactAutomationsResponseSchema = z.object({
  contactAutomations: z
    .array(activeCampaignContactAutomationSchema)
    .default([]),
})

export const activeCampaignContactListPayloadSchema = z.object({
  contactId: z.string().trim().min(1),
  listId: z.string().trim().min(1),
  status: z.enum(["1", "2"]).default("1"),
})
export type ActiveCampaignContactListPayload = z.infer<
  typeof activeCampaignContactListPayloadSchema
>

export const activeCampaignContactAutomationPayloadSchema = z.object({
  contactId: z.string().trim().min(1),
  automationId: z.string().trim().min(1),
})
export type ActiveCampaignContactAutomationPayload = z.infer<
  typeof activeCampaignContactAutomationPayloadSchema
>

export const activeCampaignContactTagPayloadSchema = z.object({
  contactId: z.string().trim().min(1),
  tagId: z.string().trim().min(1),
})
export type ActiveCampaignContactTagPayload = z.infer<
  typeof activeCampaignContactTagPayloadSchema
>

export const activeCampaignErrorSchema = z
  .object({
    message: z.string().optional(),
    errors: z.unknown().optional(),
  })
  .passthrough()

export type ActiveCampaignActions = {
  validateCredentials: Handler<
    { props: ActiveCampaignCredentialValue },
    ActiveCampaignAuthValue
  >
  listLists: Handler<
    { ctx: Context<ActiveCampaignAuthValue>; props: Record<string, never> },
    ActiveCampaignList[]
  >
  listAutomations: Handler<
    { ctx: Context<ActiveCampaignAuthValue>; props: Record<string, never> },
    ActiveCampaignAutomation[]
  >
  listTags: Handler<
    { ctx: Context<ActiveCampaignAuthValue>; props: Record<string, never> },
    ActiveCampaignTag[]
  >
  listCustomFields: Handler<
    { ctx: Context<ActiveCampaignAuthValue>; props: Record<string, never> },
    ActiveCampaignCustomField[]
  >
  syncContact: Handler<
    {
      ctx: Context<ActiveCampaignAuthValue>
      props: ActiveCampaignContactPayload
    },
    ActiveCampaignContact
  >
  addContactToList: Handler<
    {
      ctx: Context<ActiveCampaignAuthValue>
      props: ActiveCampaignContactListPayload
    },
    void
  >
  addContactToAutomation: Handler<
    {
      ctx: Context<ActiveCampaignAuthValue>
      props: ActiveCampaignContactAutomationPayload
    },
    void
  >
  addTagToContact: Handler<
    {
      ctx: Context<ActiveCampaignAuthValue>
      props: ActiveCampaignContactTagPayload
    },
    void
  >
}
