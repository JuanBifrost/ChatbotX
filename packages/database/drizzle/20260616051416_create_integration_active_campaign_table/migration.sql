CREATE TABLE "IntegrationActiveCampaign" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"integrationId" bigint NOT NULL,
	"auth" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationActiveCampaign_integrationId_key" ON "IntegrationActiveCampaign" ("integrationId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationActiveCampaign_workspaceId_key" ON "IntegrationActiveCampaign" ("workspaceId");--> statement-breakpoint
ALTER TABLE "IntegrationActiveCampaign" ADD CONSTRAINT "IntegrationActiveCampaign_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "IntegrationActiveCampaign" ADD CONSTRAINT "IntegrationActiveCampaign_integrationId_Integration_id_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;