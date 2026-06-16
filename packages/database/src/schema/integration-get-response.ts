import { jsonb, pgTable, uniqueIndex } from "drizzle-orm/pg-core"
import { bigintAsString, sharedColumns } from "../partials/shared"
import { integrationModel } from "./integration-base"
import { workspaceModel } from "./workspace"

export const integrationGetResponseModel = pgTable(
  "IntegrationGetResponse",
  {
    ...sharedColumns,
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    integrationId: bigintAsString()
      .notNull()
      .references(() => integrationModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    auth: jsonb().notNull(),
  },
  (table) => [
    uniqueIndex("IntegrationGetResponse_integrationId_key").on(
      table.integrationId,
    ),
    uniqueIndex("IntegrationGetResponse_workspaceId_key").on(table.workspaceId),
  ],
)
