CREATE TABLE "IntegrationMailerLite" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"integrationId" bigint NOT NULL,
	"auth" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationMailerLite_workspaceId_key" ON "IntegrationMailerLite" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationMailerLite_integrationId_key" ON "IntegrationMailerLite" ("integrationId");--> statement-breakpoint
ALTER TABLE "IntegrationMailerLite" ADD CONSTRAINT "IntegrationMailerLite_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "IntegrationMailerLite" ADD CONSTRAINT "IntegrationMailerLite_integrationId_Integration_id_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
