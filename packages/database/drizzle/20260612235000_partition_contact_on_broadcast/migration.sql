CREATE TABLE "ContactOnBroadcast_new" (
  "broadcastId" bigint NOT NULL,
  "contactId" bigint NOT NULL,
  "contactInboxId" bigint NOT NULL,
  "conversationId" bigint NOT NULL,
  "sent" boolean DEFAULT false NOT NULL,
  "seenAt" timestamp(6) with time zone,
  "deliveredAt" timestamp(6) with time zone,
  "clickedAt" timestamp(6) with time zone,
  "failedAt" timestamp(6) with time zone,
  "errorContent" text,
  "isRead" boolean GENERATED ALWAYS AS (
    CASE WHEN "seenAt" IS NULL THEN false
         WHEN "deliveredAt" IS NULL THEN false
         ELSE "seenAt" >= "deliveredAt" END
  ) STORED,
  CONSTRAINT "ContactsOnBroadcast_new_pkey" PRIMARY KEY ("broadcastId", "contactId")
) PARTITION BY HASH ("broadcastId");
--> statement-breakpoint
DO $$
BEGIN
  FOR i IN 0..63 LOOP
    EXECUTE format(
      'CREATE TABLE "ContactOnBroadcast_p%s" PARTITION OF "ContactOnBroadcast_new"
       FOR VALUES WITH (MODULUS 64, REMAINDER %s)', i, i);
  END LOOP;
END $$;
--> statement-breakpoint
INSERT INTO "ContactOnBroadcast_new" (
  "broadcastId",
  "contactId",
  "contactInboxId",
  "conversationId",
  "sent",
  "seenAt",
  "deliveredAt",
  "clickedAt",
  "failedAt",
  "errorContent"
)
SELECT
  "broadcastId",
  "contactId",
  "contactInboxId",
  "conversationId",
  "sent",
  "seenAt",
  "deliveredAt",
  "clickedAt",
  "failedAt",
  "errorContent"
FROM "ContactOnBroadcast";
--> statement-breakpoint
CREATE INDEX "idx_contact_on_broadcast_contact_id_new"
  ON "ContactOnBroadcast_new" ("contactId");
--> statement-breakpoint
CREATE INDEX "idx_contact_on_broadcast_is_read_new"
  ON "ContactOnBroadcast_new" ("isRead");
--> statement-breakpoint
DO $$
DECLARE old_count bigint; new_count bigint; bad_is_read bigint; partition_count bigint;
BEGIN
  SELECT COUNT(*) INTO old_count FROM "ContactOnBroadcast";
  SELECT COUNT(*) INTO new_count FROM "ContactOnBroadcast_new";

  IF old_count <> new_count THEN
    RAISE EXCEPTION 'ContactOnBroadcast count mismatch old=% new=%', old_count, new_count;
  END IF;

  SELECT COUNT(*) INTO bad_is_read
  FROM "ContactOnBroadcast_new"
  WHERE "isRead" IS DISTINCT FROM (
    "seenAt" IS NOT NULL AND "deliveredAt" IS NOT NULL AND "seenAt" >= "deliveredAt"
  );

  IF bad_is_read > 0 THEN
    RAISE EXCEPTION 'ContactOnBroadcast_new isRead mismatch: % rows', bad_is_read;
  END IF;

  SELECT COUNT(*) INTO partition_count
  FROM pg_inherits
  WHERE inhparent = '"ContactOnBroadcast_new"'::regclass;

  IF partition_count <> 64 THEN
    RAISE EXCEPTION 'ContactOnBroadcast_new expected 64 partitions, got %', partition_count;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast" RENAME TO "ContactOnBroadcast_old";
--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast_new" RENAME TO "ContactOnBroadcast";
--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast"
  ADD CONSTRAINT "ContactOnBroadcast_broadcastId_Broadcast_id_fkey"
    FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast"
  ADD CONSTRAINT "ContactOnBroadcast_contactId_Contact_id_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast"
  ADD CONSTRAINT "ContactOnBroadcast_contactInboxId_ContactInbox_id_fkey"
    FOREIGN KEY ("contactInboxId") REFERENCES "ContactInbox"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast"
  ADD CONSTRAINT "ContactOnBroadcast_conversationId_Conversation_id_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
DROP TABLE "ContactOnBroadcast_old";
--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast"
  RENAME CONSTRAINT "ContactsOnBroadcast_new_pkey" TO "ContactsOnBroadcast_pkey";
--> statement-breakpoint
ALTER INDEX "idx_contact_on_broadcast_contact_id_new"
  RENAME TO "idx_contact_on_broadcast_contact_id";
--> statement-breakpoint
ALTER INDEX "idx_contact_on_broadcast_is_read_new"
  RENAME TO "idx_contact_on_broadcast_is_read";
--> statement-breakpoint
ANALYZE "ContactOnBroadcast";
