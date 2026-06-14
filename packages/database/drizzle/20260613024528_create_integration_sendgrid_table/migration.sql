CREATE TABLE "IntegrationSendGrid" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"integrationId" bigint NOT NULL,
	"auth" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationSendGrid_integrationId_key" ON "IntegrationSendGrid" ("integrationId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationSendGrid_workspaceId_key" ON "IntegrationSendGrid" ("workspaceId");--> statement-breakpoint
ALTER TABLE "IntegrationSendGrid" ADD CONSTRAINT "IntegrationSendGrid_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "IntegrationSendGrid" ADD CONSTRAINT "IntegrationSendGrid_integrationId_Integration_id_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;