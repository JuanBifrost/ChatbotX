import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationKlaviyoRelations = defineRelationsPart(schema, (r) => ({
  integrationKlaviyoModel: {
    integration: r.one.integrationModel({
      from: r.integrationKlaviyoModel.integrationId,
      to: r.integrationModel.id,
    }),
    workspace: r.one.workspaceModel({
      from: r.integrationKlaviyoModel.workspaceId,
      to: r.workspaceModel.id,
    }),
  },
}))
