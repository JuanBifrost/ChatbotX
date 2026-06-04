import { zodBigintAsString } from "@chatbotx.io/utils"
import z from "zod"

export const createEmailTopicRequest = z.object({
  name: z.string().trim().min(1).max(255),
  folderId: zodBigintAsString().nullish(),
})
export type CreateEmailTopicRequest = z.infer<typeof createEmailTopicRequest>

export const updateEmailTopicRequest = z.object({
  name: z.string().trim().min(1).max(255),
})
export type UpdateEmailTopicRequest = z.infer<typeof updateEmailTopicRequest>
