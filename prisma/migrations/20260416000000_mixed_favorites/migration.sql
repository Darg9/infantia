ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "id" TEXT;
UPDATE "favorites" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
ALTER TABLE "favorites" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "favorites" DROP CONSTRAINT IF EXISTS "favorites_pkey";
ALTER TABLE "favorites" ADD PRIMARY KEY ("id");

ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "favorites" ALTER COLUMN "activityId" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "favorites_userId_activityId_key" ON "favorites"("userId", "activityId");
CREATE UNIQUE INDEX IF NOT EXISTS "favorites_userId_locationId_key" ON "favorites"("userId", "locationId");
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
