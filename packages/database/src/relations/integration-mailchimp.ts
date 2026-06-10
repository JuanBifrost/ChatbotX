import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationMailchimpRelations = defineRelationsPart(
  schema,
  (r) => ({
    integrationMailchimpModel: {
      integration: r.one.integrationModel({
        from: r.integrationMailchimpModel.integrationId,
        to: r.integrationModel.id,
      }),
      workspace: r.one.workspaceModel({
        from: r.integrationMailchimpModel.workspaceId,
        to: r.workspaceModel.id,
      }),
    },
  }),
)
