ALTER TABLE "Sequence" DROP COLUMN "openRate";--> statement-breakpoint
ALTER TABLE "Sequence" DROP COLUMN "ctr";--> statement-breakpoint
ALTER TABLE "ContactOnSequence" DROP COLUMN "errorCount";--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast" DROP COLUMN "delivered";--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast" DROP COLUMN "seen";--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast" DROP COLUMN "clicked";--> statement-breakpoint
ALTER TABLE "ContactOnBroadcast" DROP COLUMN "failed";
