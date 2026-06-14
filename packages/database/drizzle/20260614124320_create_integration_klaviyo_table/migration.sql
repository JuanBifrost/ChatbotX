CREATE TABLE "IntegrationKlaviyo" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"integrationId" bigint NOT NULL,
	"auth" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationKlaviyo_workspaceId_key" ON "IntegrationKlaviyo" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationKlaviyo_integrationId_key" ON "IntegrationKlaviyo" ("integrationId");--> statement-breakpoint
ALTER TABLE "IntegrationKlaviyo" ADD CONSTRAINT "IntegrationKlaviyo_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "IntegrationKlaviyo" ADD CONSTRAINT "IntegrationKlaviyo_integrationId_Integration_id_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;