import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationActiveCampaignRelations = defineRelationsPart(
  schema,
  (r) => ({
    integrationActiveCampaignModel: {
      integration: r.one.integrationModel({
        from: r.integrationActiveCampaignModel.integrationId,
        to: r.integrationModel.id,
      }),
      workspace: r.one.workspaceModel({
        from: r.integrationActiveCampaignModel.workspaceId,
        to: r.workspaceModel.id,
      }),
    },
  }),
)
