import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationMailerLiteRelations = defineRelationsPart(
  schema,
  (r) => ({
    integrationMailerLiteModel: {
      integration: r.one.integrationModel({
        from: r.integrationMailerLiteModel.integrationId,
        to: r.integrationModel.id,
      }),
      workspace: r.one.workspaceModel({
        from: r.integrationMailerLiteModel.workspaceId,
        to: r.workspaceModel.id,
      }),
    },
  }),
)
