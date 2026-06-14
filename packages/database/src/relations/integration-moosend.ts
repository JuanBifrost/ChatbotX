import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationMoosendRelations = defineRelationsPart(schema, (r) => ({
  integrationMoosendModel: {
    integration: r.one.integrationModel({
      from: r.integrationMoosendModel.integrationId,
      to: r.integrationModel.id,
    }),
    workspace: r.one.workspaceModel({
      from: r.integrationMoosendModel.workspaceId,
      to: r.workspaceModel.id,
    }),
  },
}))
