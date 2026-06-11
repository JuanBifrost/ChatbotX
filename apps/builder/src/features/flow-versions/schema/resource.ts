import {
  createSelectSchema,
  flowVersionModel,
} from "@chatbotx.io/database/schema"
import z from "zod"

export const flowVersionResource = createSelectSchema(flowVersionModel, {
  id: z.string(),
  flowId: z.string(),
  workspaceId: z.string(),
  startNodeId: z.string(),
  createdAt: z.coerce.date(),
}).omit({
  updatedAt: true,
})
export type FlowVersionResource = z.infer<typeof flowVersionResource>
