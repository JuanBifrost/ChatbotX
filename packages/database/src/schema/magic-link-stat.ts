import { pgTable, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { bigintAsString, timestampConfig } from "../partials/shared"
import { magicLinkModel } from "./magic-link"
import { workspaceModel } from "./workspace"

export const magicLinkStatModel = pgTable(
  "MagicLinkStat",
  {
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    linkId: bigintAsString()
      .notNull()
      .references(() => magicLinkModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    contactId: bigintAsString().notNull(),
    contactInboxId: bigintAsString().notNull(),
    occurredAt: timestamp(timestampConfig).notNull(),
    createdAt: timestamp(timestampConfig).defaultNow().notNull(),
  },
  (table) => [
    // Unique on the natural event key so worker re-deliveries dedupe via
    // onConflictDoNothing. The (workspaceId, linkId, occurredAt) prefix still
    // serves the date-range and per-contact aggregate queries.
    uniqueIndex(
      "MagicLinkStat_workspaceId_linkId_occurredAt_contactInboxId_key",
    ).on(
      table.workspaceId,
      table.linkId,
      table.occurredAt,
      table.contactInboxId,
    ),
  ],
)
