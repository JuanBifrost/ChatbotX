import { broadcastModel, createSelectSchema } from "@aha.chat/database/schema"
import type { BroadcastModel, FlowModel } from "@aha.chat/database/types"

export const broadcastResource = createSelectSchema(broadcastModel)
export type BroadcastResource = BroadcastModel

export type BroadcastResourceWithRelations = BroadcastResource & {
  flow?: FlowModel
  contactsCount?: number
}

export const publicBroadcastResource = createSelectSchema(broadcastModel).pick({
  id: true,
  name: true,
  status: true,
  schedulesType: true,
  schedulesAt: true,
  flowId: true,
})
