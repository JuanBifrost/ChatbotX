import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const tagChannelRelations = defineRelationsPart(schema, (r) => ({
  tagChannelModel: {
    workspace: r.one.workspaceModel({
      from: r.tagChannelModel.workspaceId,
      to: r.workspaceModel.id,
      optional: false,
    }),
    tag: r.one.tagModel({
      from: r.tagChannelModel.tagId,
      to: r.tagModel.id,
      optional: false,
    }),
    contactToTagChannels: r.many.contactToTagChannelModel({
      from: r.tagChannelModel.id,
      to: r.contactToTagChannelModel.tagChannelId,
    }),
  },
}))
