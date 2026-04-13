-- Ensure Prisma schema matches the manually added source_domain column
ALTER TABLE "activities"
ADD COLUMN IF NOT EXISTS "source_domain" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "activities_source_domain_idx"
ON "activities"("source_domain");
