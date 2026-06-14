CREATE TABLE "IntegrationMoosend" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"integrationId" bigint NOT NULL,
	"auth" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationMoosend_workspaceId_key" ON "IntegrationMoosend" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationMoosend_integrationId_key" ON "IntegrationMoosend" ("integrationId");--> statement-breakpoint
ALTER TABLE "IntegrationMoosend" ADD CONSTRAINT "IntegrationMoosend_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "IntegrationMoosend" ADD CONSTRAINT "IntegrationMoosend_integrationId_Integration_id_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;