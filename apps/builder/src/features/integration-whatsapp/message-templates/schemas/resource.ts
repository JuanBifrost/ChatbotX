import {
  createSelectSchema,
  whatsappMessageTemplateModel,
} from "@aha.chat/database/schema"
import type { z } from "zod"

export const whatsappMessageTemplateResouce = createSelectSchema(
  whatsappMessageTemplateModel,
).pick({
  id: true,
  name: true,
  language: true,
  category: true,
  status: true,
  components: true,
})

export type WhatsappMessageTemplateResource = z.infer<
  typeof whatsappMessageTemplateResouce
>
