import {
  AuthType,
  type BaseConfig,
  type Context,
  customAuthSchema,
  type Handler,
} from "@chatbotx.io/sdk"
import { z } from "zod"

export type SendGridConfig = BaseConfig

export const sendGridCredentialSchema = z.object({
  apiKey: z.string().trim().min(1),
})
export type SendGridCredentialValue = z.infer<typeof sendGridCredentialSchema>

export const sendGridAuthSchema = customAuthSchema.extend({
  authType: z.literal(AuthType.custom),
  apiKey: z.string().trim().min(1),
})
export type SendGridAuthValue = z.infer<typeof sendGridAuthSchema>

export const createSendGridAuth = (apiKey: string): SendGridAuthValue =>
  sendGridAuthSchema.parse({ authType: AuthType.custom, apiKey: apiKey.trim() })

export const sendGridScopesResponseSchema = z.object({
  scopes: z.array(z.string().trim().min(1)),
})

export const sendGridListSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  contactCount: z.number().int().nonnegative().optional(),
})
export type SendGridList = z.infer<typeof sendGridListSchema>

const sendGridProviderListSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  contact_count: z.number().int().nonnegative().optional(),
})

export const sendGridListsResponseSchema = z.object({
  result: z.array(sendGridProviderListSchema).default([]),
  _metadata: z
    .object({
      count: z.number().int().nonnegative().optional(),
      next: z.string().url().optional(),
    })
    .optional(),
})

export const sendGridFieldTypeSchema = z.enum(["Text", "Number", "Date"])
export const sendGridCustomFieldSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  fieldType: sendGridFieldTypeSchema,
})
export type SendGridCustomField = z.infer<typeof sendGridCustomFieldSchema>

const sendGridProviderFieldSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  field_type: sendGridFieldTypeSchema,
})

export const sendGridFieldDefinitionsResponseSchema = z.object({
  custom_fields: z.array(sendGridProviderFieldSchema).default([]),
  reserved_fields: z.array(z.unknown()).default([]),
})

export const sendGridContactSchema = z.object({
  email: z.string().trim().min(1),
  first_name: z.string().trim().min(1).optional(),
  last_name: z.string().trim().min(1).optional(),
  phone_number: z.string().trim().min(1).optional(),
  custom_fields: z.record(z.string().trim().min(1), z.string()).optional(),
})

export const sendGridContactPayloadSchema = z.object({
  list_ids: z.array(z.string().trim().min(1)).min(1).optional(),
  contacts: z.array(sendGridContactSchema).length(1),
})
export type SendGridContactPayload = z.infer<
  typeof sendGridContactPayloadSchema
>

export const sendGridAcceptedResponseSchema = z.object({
  job_id: z.string().trim().min(1),
})
export type SendGridAcceptedResponse = z.infer<
  typeof sendGridAcceptedResponseSchema
>

export const sendGridImportJobSchema = z.object({
  id: z.string(),
  // SendGrid API actually returns "completed"/"failed"; keep legacy values for safety
  status: z.enum(["pending", "completed", "failed", "errored", "done"]),
  results: z
    .object({
      requested_count: z.number().int().nonnegative().optional(),
      created_count: z.number().int().nonnegative().optional(),
      updated_count: z.number().int().nonnegative().optional(),
      deleted_count: z.number().int().nonnegative().optional(),
      errored_count: z.number().int().nonnegative().optional(),
      errors_by_field: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  errors_url: z.string().optional(),
})
export type SendGridImportJob = z.infer<typeof sendGridImportJobSchema>

export const sendGridErrorSchema = z.object({
  id: z.string().optional(),
  errors: z
    .array(
      z.object({
        message: z.string().optional(),
        field: z.string().optional(),
      }),
    )
    .optional(),
})

export const sendGridListPageSchema = z.object({
  data: z.array(sendGridListSchema),
  nextPageToken: z.string().optional(),
  count: z.number().int().nonnegative().optional(),
})
export type SendGridListPage = z.infer<typeof sendGridListPageSchema>

export type SendGridActions = {
  validateCredentials: Handler<
    { props: SendGridCredentialValue },
    SendGridAuthValue
  >
  listLists: Handler<
    {
      ctx: Context<SendGridAuthValue>
      props: { pageSize: number; pageToken?: string }
    },
    SendGridListPage
  >
  listCustomFields: Handler<
    { ctx: Context<SendGridAuthValue>; props: Record<string, never> },
    SendGridCustomField[]
  >
  addOrUpdateContact: Handler<
    { ctx: Context<SendGridAuthValue>; props: SendGridContactPayload },
    SendGridAcceptedResponse
  >
  checkImportJob: Handler<
    { ctx: Context<SendGridAuthValue>; props: { jobId: string } },
    SendGridImportJob
  >
}
