ALTER TABLE "Conversation"
ADD COLUMN IF NOT EXISTS "aiContextLastMessageId" bigint;
