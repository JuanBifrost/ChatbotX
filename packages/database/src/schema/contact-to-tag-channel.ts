import { index, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core"
import { bigintAsString, timestampConfig } from "../partials/shared"
import { contactInboxModel } from "./contact-inbox"
import { tagModel } from "./tag"
import { tagChannelModel } from "./tag-channel"

export const contactToTagChannelModel = pgTable(
  "ContactToTagChannel",
  {
    tagId: bigintAsString()
      .notNull()
      .references(() => tagModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tagChannelId: bigintAsString()
      .notNull()
      .references(() => tagChannelModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    contactInboxId: bigintAsString()
      .notNull()
      .references(() => contactInboxModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp(timestampConfig).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tagChannelId, table.contactInboxId],
    }),
    index("ContactToTagChannel_contactInboxId_idx").using(
      "btree",
      table.contactInboxId.asc().nullsLast(),
    ),
    index("ContactToTagChannel_tagId_idx").using(
      "btree",
      table.tagId.asc().nullsLast(),
    ),
  ],
)
