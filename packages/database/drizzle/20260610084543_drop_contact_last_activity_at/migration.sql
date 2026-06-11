ALTER TABLE "ContactInbox" ADD COLUMN "contactLastReadAt" timestamp(6) with time zone;
--> statement-breakpoint
UPDATE "ContactInbox"
SET "contactLastReadAt" = "Conversation"."contactLastReadAt"
FROM "Conversation"
WHERE "Conversation"."contactId" = "ContactInbox"."contactId";
--> statement-breakpoint
ALTER TABLE "Contact" DROP COLUMN "lastActivityAt";
--> statement-breakpoint
CREATE INDEX "ContactInbox_contactId_lastIncomingMessageAt_idx" ON "ContactInbox" USING btree ("contactId" ASC NULLS LAST, "lastIncomingMessageAt" ASC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "Conversation_workspaceId_lastActivityAt_id_idx" ON "Conversation" USING btree ("workspaceId" ASC NULLS LAST, "lastActivityAt" DESC, "id" DESC);
