import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationSendGridRelations = defineRelationsPart(
  schema,
  (r) => ({
    integrationSendGridModel: {
      integration: r.one.integrationModel({
        from: r.integrationSendGridModel.integrationId,
        to: r.integrationModel.id,
      }),
      workspace: r.one.workspaceModel({
        from: r.integrationSendGridModel.workspaceId,
        to: r.workspaceModel.id,
      }),
    },
  }),
)
