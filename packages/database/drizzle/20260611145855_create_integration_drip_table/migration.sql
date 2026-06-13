CREATE TABLE "IntegrationDrip" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"integrationId" bigint NOT NULL,
	"auth" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationDrip_integrationId_key" ON "IntegrationDrip" ("integrationId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationDrip_workspaceId_key" ON "IntegrationDrip" ("workspaceId");--> statement-breakpoint
ALTER TABLE "IntegrationDrip" ADD CONSTRAINT "IntegrationDrip_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "IntegrationDrip" ADD CONSTRAINT "IntegrationDrip_integrationId_Integration_id_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;