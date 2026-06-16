import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationGetResponseRelations = defineRelationsPart(
  schema,
  (r) => ({
    integrationGetResponseModel: {
      integration: r.one.integrationModel({
        from: r.integrationGetResponseModel.integrationId,
        to: r.integrationModel.id,
      }),
      workspace: r.one.workspaceModel({
        from: r.integrationGetResponseModel.workspaceId,
        to: r.workspaceModel.id,
      }),
    },
  }),
)
