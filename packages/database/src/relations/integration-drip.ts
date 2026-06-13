import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationDripRelations = defineRelationsPart(schema, (r) => ({
  integrationDripModel: {
    integration: r.one.integrationModel({
      from: r.integrationDripModel.integrationId,
      to: r.integrationModel.id,
    }),
    workspace: r.one.workspaceModel({
      from: r.integrationDripModel.workspaceId,
      to: r.workspaceModel.id,
    }),
  },
}))
