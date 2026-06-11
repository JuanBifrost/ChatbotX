DROP INDEX IF EXISTS "MagicLinkStat_workspaceId_linkId_occurredAt_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "RefLinkStat_workspaceId_linkId_occurredAt_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "MagicLinkStat_workspaceId_linkId_occurredAt_contactInboxId_key" ON "MagicLinkStat" ("workspaceId","linkId","occurredAt","contactInboxId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "RefLinkStat_workspaceId_linkId_occurredAt_contactInboxId_key" ON "RefLinkStat" ("workspaceId","linkId","occurredAt","contactInboxId");
