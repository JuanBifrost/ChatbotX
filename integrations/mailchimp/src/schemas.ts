import {
  AuthType,
  type BaseConfig,
  type Context,
  customAuthSchema,
  type Handler,
} from "@chatbotx.io/sdk"
import { z } from "zod"

export type MailchimpConfig = BaseConfig

export const mailchimpAuthSchema = customAuthSchema.extend({
  authType: z.literal(AuthType.custom),
  apiKey: z.string().trim().min(1),
  dataCenter: z.string().trim().min(1),
})
export type MailchimpAuthValue = z.infer<typeof mailchimpAuthSchema>

export const mailchimpAudienceSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type MailchimpAudience = z.infer<typeof mailchimpAudienceSchema>

export const mailchimpTagSchema = z.object({
  id: z.number(),
  name: z.string(),
})
export type MailchimpTag = z.infer<typeof mailchimpTagSchema>

export const mailchimpMergeFieldSchema = z.object({
  tag: z.string(),
  name: z.string(),
  type: z.string(),
  required: z.boolean().optional(),
})
export type MailchimpMergeField = z.infer<typeof mailchimpMergeFieldSchema>

// Mailchimp addresses require addr1, city, state, and zip; flow mappings provide one scalar field.
export const isSupportedMailchimpMergeFieldType = (
  type: string | undefined,
): boolean => type?.toLowerCase() !== "address"

export const mailchimpMemberSchema = z.object({
  id: z.string(),
  email_address: z.string(),
  status: z.string().optional(),
  merge_fields: z.record(z.string(), z.unknown()).optional(),
})
export type MailchimpMember = z.infer<typeof mailchimpMemberSchema>

export const mailchimpPingResponseSchema = z.object({
  health_status: z.string(),
})
export const mailchimpAudiencesResponseSchema = z.object({
  lists: z.array(mailchimpAudienceSchema).default([]),
})
export const mailchimpTagsResponseSchema = z.object({
  tags: z.array(mailchimpTagSchema).default([]),
})
export const mailchimpMergeFieldsResponseSchema = z.object({
  merge_fields: z.array(mailchimpMergeFieldSchema).default([]),
})

export type MailchimpActions = {
  validateApiKey: Handler<{ props: { apiKey: string } }, { dataCenter: string }>
  listAudiences: Handler<
    { ctx: Context<MailchimpAuthValue>; props: Record<string, never> },
    MailchimpAudience[]
  >
  listTags: Handler<
    { ctx: Context<MailchimpAuthValue>; props: { listId: string } },
    MailchimpTag[]
  >
  listMergeFields: Handler<
    { ctx: Context<MailchimpAuthValue>; props: { listId: string } },
    MailchimpMergeField[]
  >
  addMember: Handler<
    {
      ctx: Context<MailchimpAuthValue>
      props: {
        listId: string
        email: string
        doubleOptIn: boolean
        tags: string[]
        mergeFields: Record<string, unknown>
      }
    },
    MailchimpMember
  >
}
