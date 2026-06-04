CREATE TABLE IF NOT EXISTS "MessengerMessageTemplate" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"integrationMessengerId" bigint NOT NULL,
	"sourceId" text NOT NULL,
	"language" text NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"parameterFormat" text DEFAULT 'POSITIONAL' NOT NULL,
	"components" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "MessengerMessageTemplate_integrationMessengerId_sourceId_key" ON "MessengerMessageTemplate" ("integrationMessengerId","sourceId");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "MessengerMessageTemplate" ADD CONSTRAINT "MessengerMessageTemplate_x0Vv1d8cvLYN_fkey" FOREIGN KEY ("integrationMessengerId") REFERENCES "IntegrationMessenger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;