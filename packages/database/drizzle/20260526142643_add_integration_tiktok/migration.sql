CREATE TABLE "IntegrationTiktok" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"auth" jsonb NOT NULL,
	"openId" text NOT NULL,
	"name" text NOT NULL,
	"workspaceId" bigint NOT NULL,
	"inboxId" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "IntegrationTiktok_workspaceId_idx" ON "IntegrationTiktok" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationTiktok_inboxId_key" ON "IntegrationTiktok" ("inboxId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationTiktok_openId_key" ON "IntegrationTiktok" ("openId");--> statement-breakpoint
ALTER TABLE "IntegrationTiktok" ADD CONSTRAINT "IntegrationTiktok_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "IntegrationTiktok" ADD CONSTRAINT "IntegrationTiktok_inboxId_Inbox_id_fkey" FOREIGN KEY ("inboxId") REFERENCES "Inbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;