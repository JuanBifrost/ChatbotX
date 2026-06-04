import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const coexistSyncRunRelations = defineRelationsPart(schema, (r) => ({
  coexistSyncRunModel: {
    workspace: r.one.workspaceModel({
      from: r.coexistSyncRunModel.workspaceId,
      to: r.workspaceModel.id,
      optional: false,
    }),
  },
}))
