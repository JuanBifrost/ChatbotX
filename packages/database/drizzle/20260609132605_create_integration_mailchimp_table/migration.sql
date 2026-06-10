CREATE TABLE "IntegrationMailchimp" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"integrationId" bigint NOT NULL,
	"auth" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationMailchimp_integrationId_key" ON "IntegrationMailchimp" ("integrationId");--> statement-breakpoint
CREATE INDEX "IntegrationMailchimp_workspaceId_idx" ON "IntegrationMailchimp" ("workspaceId");--> statement-breakpoint
ALTER TABLE "IntegrationMailchimp" ADD CONSTRAINT "IntegrationMailchimp_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "IntegrationMailchimp" ADD CONSTRAINT "IntegrationMailchimp_integrationId_Integration_id_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
