-- Migration: add_city_default_coords
-- Adds defaultLat, defaultLng, defaultZoom to cities table
-- Step 1: Add as nullable

ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "defaultLat"  DECIMAL(10,8);
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "defaultLng"  DECIMAL(11,8);
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "defaultZoom" INTEGER;

-- Step 2: Backfill all known cities
UPDATE "cities" SET "defaultLat" = 4.71099000, "defaultLng" = -74.07210000, "defaultZoom" = 12 WHERE "name" = 'Bogotá';
UPDATE "cities" SET "defaultLat" = 6.24420000, "defaultLng" = -75.58120000, "defaultZoom" = 12 WHERE "name" = 'Medellín';
UPDATE "cities" SET "defaultLat" = 3.43722000, "defaultLng" = -76.52250000, "defaultZoom" = 12 WHERE "name" = 'Cali';
UPDATE "cities" SET "defaultLat" = 10.96540000, "defaultLng" = -74.78190000, "defaultZoom" = 12 WHERE "name" = 'Barranquilla';
UPDATE "cities" SET "defaultLat" = 10.39100000, "defaultLng" = -75.47970000, "defaultZoom" = 12 WHERE "name" = 'Cartagena';
UPDATE "cities" SET "defaultLat" = 7.11980000,  "defaultLng" = -73.11270000, "defaultZoom" = 12 WHERE "name" = 'Bucaramanga';
UPDATE "cities" SET "defaultLat" = 4.81330000,  "defaultLng" = -75.69420000, "defaultZoom" = 12 WHERE "name" = 'Pereira';
UPDATE "cities" SET "defaultLat" = 5.06890000,  "defaultLng" = -75.51740000, "defaultZoom" = 12 WHERE "name" = 'Manizales';
UPDATE "cities" SET "defaultLat" = 11.24080000, "defaultLng" = -74.20100000, "defaultZoom" = 12 WHERE "name" = 'Santa Marta';
UPDATE "cities" SET "defaultLat" = 4.43890000,  "defaultLng" = -75.23220000, "defaultZoom" = 12 WHERE "name" = 'Ibagué';
UPDATE "cities" SET "defaultLat" = 1.21361000,  "defaultLng" = -77.28110000, "defaultZoom" = 12 WHERE "name" = 'Pasto';

-- Step 3: Set NOT NULL (all 11 cities backfilled above)
ALTER TABLE "cities" ALTER COLUMN "defaultLat"  SET NOT NULL;
ALTER TABLE "cities" ALTER COLUMN "defaultLng"  SET NOT NULL;
ALTER TABLE "cities" ALTER COLUMN "defaultZoom" SET NOT NULL;

-- Step 4: Index for fast map queries
CREATE INDEX IF NOT EXISTS "idx_location_city_coords"
  ON "locations" ("cityId", "latitude", "longitude");
