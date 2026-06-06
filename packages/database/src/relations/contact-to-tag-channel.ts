import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const contactToTagChannelRelations = defineRelationsPart(
  schema,
  (r) => ({
    contactToTagChannelModel: {
      tag: r.one.tagModel({
        from: r.contactToTagChannelModel.tagId,
        to: r.tagModel.id,
        optional: false,
      }),
      tagChannel: r.one.tagChannelModel({
        from: r.contactToTagChannelModel.tagChannelId,
        to: r.tagChannelModel.id,
        optional: false,
      }),
      contactInbox: r.one.contactInboxModel({
        from: r.contactToTagChannelModel.contactInboxId,
        to: r.contactInboxModel.id,
        optional: false,
      }),
    },
  }),
)
