CREATE TABLE "ContactToTagChannel" (
	"tagId" bigint NOT NULL,
	"tagChannelId" bigint NOT NULL,
	"contactInboxId" bigint NOT NULL,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ContactToTagChannel_pkey" PRIMARY KEY("tagChannelId","contactInboxId")
);
--> statement-breakpoint
CREATE TABLE "TagChannel" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"tagId" bigint NOT NULL,
	"channelType" text NOT NULL,
	"integrationId" bigint NOT NULL,
	"externalLabelId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "IntegrationMessenger" ADD COLUMN "syncTagEnabledAt" timestamp(6) with time zone;--> statement-breakpoint
ALTER TABLE "IntegrationZalo" ADD COLUMN "syncTagEnabledAt" timestamp(6) with time zone;--> statement-breakpoint
ALTER TABLE "Tag" DROP COLUMN "syncToMessenger";--> statement-breakpoint
ALTER TABLE "Tag" ADD COLUMN "deletedAt" timestamp(6) with time zone;--> statement-breakpoint
DROP INDEX IF EXISTS "Tag_workspaceId_name_key";--> statement-breakpoint
CREATE UNIQUE INDEX "Tag_workspaceId_name_key" ON "Tag" USING btree ("workspaceId" ASC NULLS LAST, "name" ASC NULLS LAST) WHERE "deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "ContactToTagChannel_contactInboxId_idx" ON "ContactToTagChannel" ("contactInboxId");--> statement-breakpoint
CREATE INDEX "ContactToTagChannel_tagId_idx" ON "ContactToTagChannel" ("tagId");--> statement-breakpoint
CREATE UNIQUE INDEX "TagChannel_tag_integration_key" ON "TagChannel" ("tagId","channelType","integrationId");--> statement-breakpoint
CREATE UNIQUE INDEX "TagChannel_external_key" ON "TagChannel" ("channelType","integrationId","externalLabelId");--> statement-breakpoint
CREATE INDEX "TagChannel_workspace_channel_idx" ON "TagChannel" ("workspaceId","channelType");--> statement-breakpoint
CREATE INDEX "TagChannel_integration_idx" ON "TagChannel" ("channelType","integrationId");--> statement-breakpoint
ALTER TABLE "ContactToTagChannel" ADD CONSTRAINT "ContactToTagChannel_tagId_Tag_id_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContactToTagChannel" ADD CONSTRAINT "ContactToTagChannel_tagChannelId_TagChannel_id_fkey" FOREIGN KEY ("tagChannelId") REFERENCES "TagChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContactToTagChannel" ADD CONSTRAINT "ContactToTagChannel_contactInboxId_ContactInbox_id_fkey" FOREIGN KEY ("contactInboxId") REFERENCES "ContactInbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TagChannel" ADD CONSTRAINT "TagChannel_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TagChannel" ADD CONSTRAINT "TagChannel_tagId_Tag_id_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;