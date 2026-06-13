DO $$
DECLARE null_status_count bigint;
BEGIN
  SELECT COUNT(*) INTO null_status_count
  FROM "SequenceDispatch"
  WHERE "status" IS NULL;

  IF null_status_count > 0 THEN
    RAISE EXCEPTION 'SequenceDispatch has % rows with NULL status', null_status_count;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE mismatch_count bigint;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM "SequenceDispatch" sd
  JOIN "ContactOnSequence" cos ON cos."id" = sd."enrollmentId"
  WHERE sd."workspaceId" <> cos."workspaceId";

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'SequenceDispatch enrollment workspace mismatch: % rows', mismatch_count;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE orphan_count bigint;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "SequenceDispatch" sd
  LEFT JOIN "ContactOnSequence" cos ON cos."id" = sd."enrollmentId"
  WHERE cos."id" IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Orphaned SequenceDispatch rows: % rows', orphan_count;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE duplicate_count bigint;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "idempotencyKey", "workspaceId"
    FROM "SequenceDispatch"
    GROUP BY "idempotencyKey", "workspaceId"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate SequenceDispatch idempotency keys: % groups', duplicate_count;
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "ContactOnSequence_new" (
  "id" bigint NOT NULL,
  "createdAt" timestamp(6) with time zone NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp(6) with time zone NOT NULL DEFAULT NOW(),
  "enrolledAt" timestamp(6) with time zone NOT NULL DEFAULT NOW(),
  "completedAt" timestamp(6) with time zone,
  "currentStep" integer NOT NULL DEFAULT 0,
  "status" text,
  "nextRunAt" timestamp(6) with time zone,
  "lastStepId" bigint,
  "nextStepId" bigint,
  "lockedAt" timestamp(6) with time zone,
  "lockOwner" text,
  "lastError" text,
  "contactId" bigint NOT NULL,
  "sequenceId" bigint NOT NULL,
  "workspaceId" bigint NOT NULL,
  CONSTRAINT "ContactOnSequence_new_pkey" PRIMARY KEY ("id", "workspaceId")
) PARTITION BY HASH ("workspaceId");
--> statement-breakpoint
DO $$
BEGIN
  FOR i IN 0..63 LOOP
    EXECUTE format(
      'CREATE TABLE "ContactOnSequence_p%s" PARTITION OF "ContactOnSequence_new"
       FOR VALUES WITH (MODULUS 64, REMAINDER %s)', i, i);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TABLE "SequenceDispatch_new" (
  "id" bigint NOT NULL,
  "createdAt" timestamp(6) with time zone NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp(6) with time zone NOT NULL DEFAULT NOW(),
  "runAtMs" bigint NOT NULL,
  "bucket" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending',
  "idempotencyKey" text NOT NULL,
  "attempt" integer NOT NULL DEFAULT 0,
  "lastError" text,
  "lockedAt" timestamp(6) with time zone,
  "lockOwner" text,
  "completedAt" timestamp(6) with time zone,
  "deliveredAt" timestamp(6) with time zone,
  "seenAt" timestamp(6) with time zone,
  "clickedAt" timestamp(6) with time zone,
  "failedAt" timestamp(6) with time zone,
  "errorContent" text,
  "workspaceId" bigint NOT NULL,
  "sequenceId" bigint NOT NULL,
  "contactId" bigint NOT NULL,
  "contactInboxId" bigint NOT NULL,
  "stepId" bigint NOT NULL,
  "enrollmentId" bigint NOT NULL,
  "isRead" boolean GENERATED ALWAYS AS (
    CASE WHEN "seenAt" IS NULL THEN false
         WHEN "deliveredAt" IS NULL THEN false
         ELSE "seenAt" >= "deliveredAt" END
  ) STORED,
  CONSTRAINT "SequenceDispatch_new_pkey" PRIMARY KEY ("id", "workspaceId")
) PARTITION BY HASH ("workspaceId");
--> statement-breakpoint
DO $$
BEGIN
  FOR i IN 0..63 LOOP
    EXECUTE format(
      'CREATE TABLE "SequenceDispatch_p%s" PARTITION OF "SequenceDispatch_new"
       FOR VALUES WITH (MODULUS 64, REMAINDER %s)', i, i);
  END LOOP;
END $$;
--> statement-breakpoint
INSERT INTO "ContactOnSequence_new" (
  "id",
  "createdAt",
  "updatedAt",
  "enrolledAt",
  "completedAt",
  "currentStep",
  "status",
  "nextRunAt",
  "lastStepId",
  "nextStepId",
  "lockedAt",
  "lockOwner",
  "lastError",
  "contactId",
  "sequenceId",
  "workspaceId"
)
SELECT
  "id",
  "createdAt",
  "updatedAt",
  "enrolledAt",
  "completedAt",
  "currentStep",
  "status",
  "nextRunAt",
  "lastStepId",
  "nextStepId",
  "lockedAt",
  "lockOwner",
  "lastError",
  "contactId",
  "sequenceId",
  "workspaceId"
FROM "ContactOnSequence";
--> statement-breakpoint
INSERT INTO "SequenceDispatch_new" (
  "id",
  "createdAt",
  "updatedAt",
  "runAtMs",
  "bucket",
  "status",
  "idempotencyKey",
  "attempt",
  "lastError",
  "lockedAt",
  "lockOwner",
  "completedAt",
  "deliveredAt",
  "seenAt",
  "clickedAt",
  "failedAt",
  "errorContent",
  "workspaceId",
  "sequenceId",
  "contactId",
  "contactInboxId",
  "stepId",
  "enrollmentId"
)
SELECT
  "id",
  "createdAt",
  "updatedAt",
  "runAtMs",
  "bucket",
  "status",
  "idempotencyKey",
  "attempt",
  "lastError",
  "lockedAt",
  "lockOwner",
  "completedAt",
  "deliveredAt",
  "seenAt",
  "clickedAt",
  "failedAt",
  "errorContent",
  "workspaceId",
  "sequenceId",
  "contactId",
  "contactInboxId",
  "stepId",
  "enrollmentId"
FROM "SequenceDispatch";
--> statement-breakpoint
CREATE INDEX "ContactsOnSequence_sequenceId_idx_new"
  ON "ContactOnSequence_new" ("sequenceId");
--> statement-breakpoint
CREATE INDEX "ContactsOnSequence_contactId_idx_new"
  ON "ContactOnSequence_new" ("contactId");
--> statement-breakpoint
CREATE INDEX "ContactsOnSequence_workspaceId_idx_new"
  ON "ContactOnSequence_new" ("workspaceId");
--> statement-breakpoint
CREATE INDEX "ContactsOnSequence_status_nextRunAt_idx_new"
  ON "ContactOnSequence_new" ("status", "nextRunAt");
--> statement-breakpoint
CREATE INDEX "ContactsOnSequence_workspaceId_status_nextRunAt_idx_new"
  ON "ContactOnSequence_new" ("workspaceId", "status", "nextRunAt");
--> statement-breakpoint
CREATE UNIQUE INDEX "ContactsOnSequence_contactId_sequenceId_workspaceId_key_new"
  ON "ContactOnSequence_new" ("contactId", "sequenceId", "workspaceId");
--> statement-breakpoint
CREATE UNIQUE INDEX "SequenceDispatch_idempotencyKey_key_new"
  ON "SequenceDispatch_new" ("idempotencyKey", "workspaceId");
--> statement-breakpoint
CREATE INDEX "SequenceDispatch_pending_runAtMs_idx_new"
  ON "SequenceDispatch_new" ("runAtMs")
  WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX "SequenceDispatch_pending_bucket_runAtMs_idx_new"
  ON "SequenceDispatch_new" ("bucket", "runAtMs")
  WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX "SequenceDispatch_id_idx_new"
  ON "SequenceDispatch_new" ("id");
--> statement-breakpoint
CREATE INDEX "SequenceDispatch_status_runAtMs_idx_new"
  ON "SequenceDispatch_new" ("status", "runAtMs");
--> statement-breakpoint
CREATE INDEX "SequenceDispatch_workspaceId_status_runAtMs_idx_new"
  ON "SequenceDispatch_new" ("workspaceId", "status", "runAtMs");
--> statement-breakpoint
CREATE INDEX "SequenceDispatch_enrollmentId_workspaceId_idx_new"
  ON "SequenceDispatch_new" ("enrollmentId", "workspaceId");
--> statement-breakpoint
CREATE INDEX "SequenceDispatch_bucket_status_runAtMs_idx_new"
  ON "SequenceDispatch_new" ("bucket", "status", "runAtMs");
--> statement-breakpoint
CREATE INDEX "SequenceDispatch_terminal_updatedAt_idx_new"
  ON "SequenceDispatch_new" ("updatedAt")
  WHERE "status" IN ('completed', 'failed', 'canceled');
--> statement-breakpoint
ALTER TABLE "ContactOnSequence_new"
  ADD CONSTRAINT "ContactOnSequence_contactId_Contact_id_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "ContactOnSequence_new"
  ADD CONSTRAINT "ContactOnSequence_sequenceId_Sequence_id_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "ContactOnSequence_new"
  ADD CONSTRAINT "ContactOnSequence_workspaceId_Workspace_id_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "SequenceDispatch_new"
  ADD CONSTRAINT "SequenceDispatch_workspaceId_Workspace_id_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "SequenceDispatch_new"
  ADD CONSTRAINT "SequenceDispatch_sequenceId_Sequence_id_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "SequenceDispatch_new"
  ADD CONSTRAINT "SequenceDispatch_contactId_Contact_id_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "SequenceDispatch_new"
  ADD CONSTRAINT "SequenceDispatch_contactInboxId_ContactInbox_id_fkey"
    FOREIGN KEY ("contactInboxId") REFERENCES "ContactInbox"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "SequenceDispatch_new"
  ADD CONSTRAINT "SequenceDispatch_stepId_SequenceStep_id_fkey"
    FOREIGN KEY ("stepId") REFERENCES "SequenceStep"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE "SequenceDispatch_new"
  ADD CONSTRAINT "SequenceDispatch_enrollment_workspace_fkey"
    FOREIGN KEY ("enrollmentId", "workspaceId")
    REFERENCES "ContactOnSequence_new"("id", "workspaceId")
    ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
DO $$
DECLARE old_cos bigint; new_cos bigint; old_sd bigint; new_sd bigint;
BEGIN
  SELECT COUNT(*) INTO old_cos FROM "ContactOnSequence";
  SELECT COUNT(*) INTO new_cos FROM "ContactOnSequence_new";
  SELECT COUNT(*) INTO old_sd FROM "SequenceDispatch";
  SELECT COUNT(*) INTO new_sd FROM "SequenceDispatch_new";

  IF old_cos <> new_cos THEN
    RAISE EXCEPTION 'CoS count mismatch old=% new=%', old_cos, new_cos;
  END IF;

  IF old_sd <> new_sd THEN
    RAISE EXCEPTION 'SD count mismatch old=% new=%', old_sd, new_sd;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE bad bigint;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM "SequenceDispatch_new"
  WHERE "isRead" IS DISTINCT FROM (
    "seenAt" IS NOT NULL AND "deliveredAt" IS NOT NULL AND "seenAt" >= "deliveredAt"
  );

  IF bad > 0 THEN
    RAISE EXCEPTION 'SequenceDispatch_new isRead mismatch: % rows', bad;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  SELECT COUNT(*) INTO n
  FROM pg_inherits
  WHERE inhparent = '"ContactOnSequence_new"'::regclass;

  IF n <> 64 THEN
    RAISE EXCEPTION 'ContactOnSequence_new expected 64 partitions, got %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM pg_inherits
  WHERE inhparent = '"SequenceDispatch_new"'::regclass;

  IF n <> 64 THEN
    RAISE EXCEPTION 'SequenceDispatch_new expected 64 partitions, got %', n;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "ContactOnSequence" RENAME TO "ContactOnSequence_old";
--> statement-breakpoint
ALTER TABLE "ContactOnSequence_new" RENAME TO "ContactOnSequence";
--> statement-breakpoint
ALTER TABLE "SequenceDispatch" RENAME TO "SequenceDispatch_old";
--> statement-breakpoint
ALTER TABLE "SequenceDispatch_new" RENAME TO "SequenceDispatch";
--> statement-breakpoint
ALTER TABLE "SequenceDispatch_old"
  DROP CONSTRAINT IF EXISTS "SequenceDispatch_enrollment_workspace_fkey";
--> statement-breakpoint
ALTER TABLE "SequenceDispatch_old"
  DROP CONSTRAINT IF EXISTS "SequenceDispatch_enrollmentId_ContactOnSequence_id_fkey";
--> statement-breakpoint
DROP TABLE "SequenceDispatch_old";
--> statement-breakpoint
DROP TABLE "ContactOnSequence_old";
--> statement-breakpoint
ALTER TABLE "ContactOnSequence"
  RENAME CONSTRAINT "ContactOnSequence_new_pkey" TO "ContactOnSequence_pkey";
--> statement-breakpoint
ALTER TABLE "SequenceDispatch"
  RENAME CONSTRAINT "SequenceDispatch_new_pkey" TO "SequenceDispatch_pkey";
--> statement-breakpoint
ALTER INDEX "ContactsOnSequence_sequenceId_idx_new"
  RENAME TO "ContactsOnSequence_sequenceId_idx";
--> statement-breakpoint
ALTER INDEX "ContactsOnSequence_contactId_idx_new"
  RENAME TO "ContactsOnSequence_contactId_idx";
--> statement-breakpoint
ALTER INDEX "ContactsOnSequence_workspaceId_idx_new"
  RENAME TO "ContactsOnSequence_workspaceId_idx";
--> statement-breakpoint
ALTER INDEX "ContactsOnSequence_status_nextRunAt_idx_new"
  RENAME TO "ContactsOnSequence_status_nextRunAt_idx";
--> statement-breakpoint
ALTER INDEX "ContactsOnSequence_workspaceId_status_nextRunAt_idx_new"
  RENAME TO "ContactsOnSequence_workspaceId_status_nextRunAt_idx";
--> statement-breakpoint
ALTER INDEX "ContactsOnSequence_contactId_sequenceId_workspaceId_key_new"
  RENAME TO "ContactsOnSequence_contactId_sequenceId_workspaceId_key";
--> statement-breakpoint
ALTER INDEX "SequenceDispatch_idempotencyKey_key_new"
  RENAME TO "SequenceDispatch_idempotencyKey_key";
--> statement-breakpoint
ALTER INDEX "SequenceDispatch_pending_runAtMs_idx_new"
  RENAME TO "SequenceDispatch_pending_runAtMs_idx";
--> statement-breakpoint
ALTER INDEX "SequenceDispatch_pending_bucket_runAtMs_idx_new"
  RENAME TO "SequenceDispatch_pending_bucket_runAtMs_idx";
--> statement-breakpoint
ALTER INDEX "SequenceDispatch_id_idx_new"
  RENAME TO "SequenceDispatch_id_idx";
--> statement-breakpoint
ALTER INDEX "SequenceDispatch_status_runAtMs_idx_new"
  RENAME TO "SequenceDispatch_status_runAtMs_idx";
--> statement-breakpoint
ALTER INDEX "SequenceDispatch_workspaceId_status_runAtMs_idx_new"
  RENAME TO "SequenceDispatch_workspaceId_status_runAtMs_idx";
--> statement-breakpoint
ALTER INDEX "SequenceDispatch_enrollmentId_workspaceId_idx_new"
  RENAME TO "SequenceDispatch_enrollmentId_workspaceId_idx";
--> statement-breakpoint
ALTER INDEX "SequenceDispatch_bucket_status_runAtMs_idx_new"
  RENAME TO "SequenceDispatch_bucket_status_runAtMs_idx";
--> statement-breakpoint
ALTER INDEX "SequenceDispatch_terminal_updatedAt_idx_new"
  RENAME TO "SequenceDispatch_terminal_updatedAt_idx";
--> statement-breakpoint
ANALYZE "ContactOnSequence";
--> statement-breakpoint
ANALYZE "SequenceDispatch";
