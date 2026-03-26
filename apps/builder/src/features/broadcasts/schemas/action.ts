import { BroadcastSubaction } from "@aha.chat/database/enums"
import { broadcastSchedulesType } from "@aha.chat/database/schema"
import { channelType } from "@aha.chat/database/types"
import { waTemplateParamsSchema } from "@aha.chat/flow-config"
import { z } from "zod"
import { contactFilterRequest } from "@/features/contacts/schemas/query"

export const createBroadcastRequest = z
  .object({
    channel: z.enum(channelType),
    flowId: z.cuid2().optional(),
    templateId: z.cuid2().optional(),
    integrationWhatsappId: z.cuid2().optional(),
    templateData: waTemplateParamsSchema.optional(),
    subaction: z.enum(BroadcastSubaction),
    schedulesType: z.enum(broadcastSchedulesType.enumValues),
    schedulesAt: z
      .string()
      .refine(
        (value) => {
          const date = new Date(value)
          const currentDate = new Date()

          return !Number.isNaN(date.getTime()) && date > currentDate
        },
        {
          message: "Schedules must be after now.",
        },
      )
      .nullable(),
    contactFilter: contactFilterRequest.shape.contactFilter,
  })
  .refine(
    (data) => {
      return !!(data.flowId || data.templateId)
    },
    {
      message: "Either flow or template must be selected",
      path: ["flowId"],
    },
  )
export type CreateBroadcastRequest = z.infer<typeof createBroadcastRequest>

export const updateBroadcastSchema = z.object({
  name: z.string().trim().min(1).max(255),
})
export type UpdateBroadcastSchema = z.infer<typeof updateBroadcastSchema>
