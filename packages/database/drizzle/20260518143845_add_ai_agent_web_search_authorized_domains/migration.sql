ALTER TABLE "AIAgent" ADD COLUMN "webSearchAuthorizedDomains" text[] DEFAULT '{}'::text[] NOT NULL;
