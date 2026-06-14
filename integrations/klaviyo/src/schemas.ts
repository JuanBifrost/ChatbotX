import {
  AuthType,
  type BaseConfig,
  type Context,
  customAuthSchema,
  type Handler,
} from "@chatbotx.io/sdk"
import { z } from "zod"
import { KLAVIYO_LIST_PAGE_SIZE } from "./constants"

export type KlaviyoConfig = BaseConfig

const nonEmptyStringSchema = z.string().trim().min(1)
const e164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/u)

export const klaviyoCredentialSchema = z.object({
  apiKey: nonEmptyStringSchema,
})
export type KlaviyoCredentialValue = z.infer<typeof klaviyoCredentialSchema>

export const klaviyoAuthSchema = customAuthSchema.extend({
  authType: z.literal(AuthType.custom),
  apiKey: nonEmptyStringSchema,
})
export type KlaviyoAuthValue = z.infer<typeof klaviyoAuthSchema>

export const createKlaviyoAuth = (apiKey: string): KlaviyoAuthValue =>
  klaviyoAuthSchema.parse({
    authType: AuthType.custom,
    apiKey: apiKey.trim(),
  })

export const klaviyoListSchema = z.object({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
})
export type KlaviyoList = z.infer<typeof klaviyoListSchema>

const createKlaviyoProviderResourceSchema = <T extends z.ZodType>(
  resourceType: string,
  schema: T,
) =>
  z
    .object({
      type: z.literal(resourceType),
      id: nonEmptyStringSchema,
      attributes: z.object({ name: nonEmptyStringSchema }),
    })
    .transform(({ id, attributes }) =>
      schema.parse({ id, name: attributes.name }),
    )

const klaviyoLinksSchema = z.object({
  next: z.string().nullable().optional(),
})

const createKlaviyoProviderPageSchema = <T extends z.ZodType>(
  resourceType: string,
  itemSchema: T,
) =>
  z.object({
    data: z.array(
      createKlaviyoProviderResourceSchema(resourceType, itemSchema),
    ),
    links: klaviyoLinksSchema,
  })

export const klaviyoListsResponseSchema = createKlaviyoProviderPageSchema(
  "list",
  klaviyoListSchema,
)

const createKlaviyoCursorPageInputSchema = (maxSize: number) =>
  z.object({
    cursor: nonEmptyStringSchema.optional(),
    size: z.number().int().min(1).max(maxSize),
  })

export const klaviyoListPageInputSchema = createKlaviyoCursorPageInputSchema(
  KLAVIYO_LIST_PAGE_SIZE,
)

export const klaviyoCursorPageOutputSchema = <T extends z.ZodType>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  })

export const klaviyoListPageSchema =
  klaviyoCursorPageOutputSchema(klaviyoListSchema)
export type KlaviyoListPage = z.infer<typeof klaviyoListPageSchema>

const nonEmptyStringRecordSchema = z
  .record(nonEmptyStringSchema, nonEmptyStringSchema)
  .refine((value) => Object.keys(value).length > 0)

export const klaviyoProfileImportPayloadSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  first_name: nonEmptyStringSchema.optional(),
  last_name: nonEmptyStringSchema.optional(),
  phone_number: e164Schema.optional(),
  title: nonEmptyStringSchema.optional(),
  organization: nonEmptyStringSchema.optional(),
  properties: nonEmptyStringRecordSchema.optional(),
})

export const klaviyoSyncProfilePropsSchema =
  klaviyoProfileImportPayloadSchema.extend({
    listId: nonEmptyStringSchema.optional(),
  })
export type KlaviyoSyncProfileProps = z.infer<
  typeof klaviyoSyncProfilePropsSchema
>

export const klaviyoProfileImportResponseSchema = z.object({
  data: z.object({
    type: z.literal("profile"),
    id: nonEmptyStringSchema,
    attributes: z.object({
      email: z.string().trim().min(1),
    }),
  }),
})
export const klaviyoErrorSchema = z.object({
  errors: z.array(
    z.object({
      detail: z.string().optional(),
      title: z.string().optional(),
      status: z.string().optional(),
    }),
  ),
})
export type KlaviyoSyncProfileResult = {
  profileId: string
  email: string
}

export type KlaviyoActions = {
  validateCredentials: Handler<
    { props: KlaviyoCredentialValue },
    KlaviyoAuthValue
  >
  listLists: Handler<
    {
      ctx: Context<KlaviyoAuthValue>
      props: z.infer<typeof klaviyoListPageInputSchema>
    },
    KlaviyoListPage
  >
  syncProfile: Handler<
    {
      ctx: Context<KlaviyoAuthValue>
      props: KlaviyoSyncProfileProps
    },
    KlaviyoSyncProfileResult
  >
}
