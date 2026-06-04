import {
  createSelectSchema,
  emailTopicModel,
} from "@chatbotx.io/database/schema"
import z from "zod"

export const emailTopicResource = createSelectSchema(emailTopicModel, {
  id: z.string(),
  workspaceId: z.string(),
  folderId: z.string().nullable(),
})
export type EmailTopicResource = z.infer<typeof emailTopicResource>
