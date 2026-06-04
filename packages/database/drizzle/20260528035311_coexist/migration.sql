CREATE TYPE "coexistChannel" AS ENUM('whatsapp', 'messenger');--> statement-breakpoint
CREATE TYPE "coexistMessengerSyncPhase" AS ENUM('contacts', 'messages');--> statement-breakpoint
CREATE TYPE "coexistRunStatus" AS ENUM('init', 'running', 'succeeded', 'failed', 'partial');--> statement-breakpoint
CREATE TABLE "CoexistSyncRun" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"integrationId" bigint NOT NULL,
	"channel" "coexistChannel" NOT NULL,
	"status" "coexistRunStatus" DEFAULT 'init'::"coexistRunStatus" NOT NULL,
	"triggerSource" text NOT NULL,
	"startedAt" timestamp(6) with time zone,
	"finishedAt" timestamp(6) with time zone,
	"lastHeartbeatAt" timestamp(6) with time zone,
	"totalScan" integer DEFAULT 0 NOT NULL,
	"currentScan" integer DEFAULT 0 NOT NULL,
	"currentStep" text,
	"lastSyncedAt" timestamp(6) with time zone,
	"currentPageNumber" integer DEFAULT 0 NOT NULL,
	"importedContactCount" integer DEFAULT 0 NOT NULL,
	"importedMessageCount" integer DEFAULT 0 NOT NULL,
	"skippedCount" integer DEFAULT 0 NOT NULL,
	"failedCount" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"currentError" text,
	"lastPhase" integer,
	"lastChunkOrder" integer,
	"syncProgress" integer DEFAULT 0 NOT NULL,
	"messengerSyncPhase" "coexistMessengerSyncPhase" DEFAULT 'contacts'::"coexistMessengerSyncPhase" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "WhatsappCoexistStaging" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"phoneNumberId" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payloadHash" text,
	"processedAt" timestamp(6) with time zone
);
--> statement-breakpoint
ALTER TABLE "IntegrationMessenger" ADD COLUMN "coexistEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "IntegrationWhatsapp" ADD COLUMN "coexistEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "IntegrationWhatsapp" ADD COLUMN "isCoexist" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "IntegrationWhatsapp" ADD COLUMN "platformType" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "IntegrationWhatsapp" ADD COLUMN "historyDeclined" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "CoexistSyncRun_workspace_idx" ON "CoexistSyncRun" ("workspaceId");--> statement-breakpoint
CREATE INDEX "CoexistSyncRun_integration_idx" ON "CoexistSyncRun" ("integrationId");--> statement-breakpoint
CREATE INDEX "CoexistSyncRun_active_idx" ON "CoexistSyncRun" ("status","lastHeartbeatAt") WHERE status IN ('init', 'running');--> statement-breakpoint
CREATE INDEX "CoexistSyncRun_integration_resume_idx" ON "CoexistSyncRun" ("integrationId","channel","startedAt" DESC) WHERE status IN ('succeeded', 'partial');--> statement-breakpoint
CREATE UNIQUE INDEX "CoexistSyncRun_integration_init_uq" ON "CoexistSyncRun" ("integrationId","channel") WHERE status = 'init';--> statement-breakpoint
CREATE INDEX "WhatsappCoexistStaging_phoneNumberId_idx" ON "WhatsappCoexistStaging" ("phoneNumberId");--> statement-breakpoint
CREATE UNIQUE INDEX "WhatsappCoexistStaging_phone_hash_uq" ON "WhatsappCoexistStaging" ("phoneNumberId","payloadHash");--> statement-breakpoint
CREATE INDEX "WhatsappCoexistStaging_processedAt_idx" ON "WhatsappCoexistStaging" ("processedAt") WHERE "processedAt" IS NOT NULL;