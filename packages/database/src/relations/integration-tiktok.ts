import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationTiktokRelations = defineRelationsPart(schema, (r) => ({
  integrationTiktokModel: {
    workspace: r.one.workspaceModel({
      from: r.integrationTiktokModel.workspaceId,
      to: r.workspaceModel.id,
      optional: false,
    }),
    inbox: r.one.inboxModel({
      from: r.integrationTiktokModel.inboxId,
      to: r.inboxModel.id,
      optional: false,
    }),
  },
}))
