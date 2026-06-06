import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { bigintAsString, sharedColumns } from "../partials/shared"
import { tagModel } from "./tag"
import { workspaceModel } from "./workspace"

export const tagChannelModel = pgTable(
  "TagChannel",
  {
    ...sharedColumns,
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tagId: bigintAsString()
      .notNull()
      .references(() => tagModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    channelType: text().notNull(),
    integrationId: bigintAsString().notNull(),
    externalLabelId: text().notNull(),
  },
  (table) => [
    uniqueIndex("TagChannel_tag_integration_key").using(
      "btree",
      table.tagId.asc().nullsLast(),
      table.channelType.asc().nullsLast(),
      table.integrationId.asc().nullsLast(),
    ),
    uniqueIndex("TagChannel_external_key").using(
      "btree",
      table.channelType.asc().nullsLast(),
      table.integrationId.asc().nullsLast(),
      table.externalLabelId.asc().nullsLast(),
    ),
    index("TagChannel_workspace_channel_idx").using(
      "btree",
      table.workspaceId.asc().nullsLast(),
      table.channelType.asc().nullsLast(),
    ),
    index("TagChannel_integration_idx").using(
      "btree",
      table.channelType.asc().nullsLast(),
      table.integrationId.asc().nullsLast(),
    ),
  ],
)
