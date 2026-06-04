ALTER TYPE "folderType" ADD VALUE 'emailTopic';--> statement-breakpoint
CREATE TABLE "EmailTopic" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"workspaceId" bigint NOT NULL,
	"folderId" bigint,
	"sendsTotal" integer DEFAULT 0 NOT NULL,
	"deliveredsTotal" integer DEFAULT 0 NOT NULL,
	"seensTotal" integer DEFAULT 0 NOT NULL,
	"clicksTotal" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "EmailTopic_workspaceId_name_key" ON "EmailTopic" ("workspaceId","name");--> statement-breakpoint
CREATE INDEX "EmailTopic_folderId_idx" ON "EmailTopic" ("folderId");--> statement-breakpoint
ALTER TABLE "EmailTopic" ADD CONSTRAINT "EmailTopic_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "EmailTopic" ADD CONSTRAINT "EmailTopic_folderId_Folder_id_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
