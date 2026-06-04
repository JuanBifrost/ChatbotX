import { sql } from "drizzle-orm"
import { jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { bigintAsString, sharedColumns } from "../partials/shared"
import { integrationMessengerModel } from "./integration-messenger"

export const messengerMessageTemplateModel = pgTable(
  "MessengerMessageTemplate",
  {
    ...sharedColumns,
    name: text().notNull(),
    integrationMessengerId: bigintAsString()
      .notNull()
      .references(() => integrationMessengerModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sourceId: text().notNull(),
    language: text().notNull(),
    category: text().notNull(),
    status: text().notNull(),
    parameterFormat: text().notNull().default("POSITIONAL"),
    components: jsonb().notNull().default(sql`'[]'::jsonb`),
  },
  (table) => [
    uniqueIndex(
      "MessengerMessageTemplate_integrationMessengerId_sourceId_key",
    ).using(
      "btree",
      table.integrationMessengerId.asc().nullsLast(),
      table.sourceId.asc().nullsLast(),
    ),
  ],
)
