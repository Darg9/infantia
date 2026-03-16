-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RECURRING', 'ONE_TIME', 'CAMP', 'WORKSHOP');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED', 'DRAFT');

-- CreateEnum
CREATE TYPE "PricePeriod" AS ENUM ('PER_SESSION', 'MONTHLY', 'TOTAL', 'FREE');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('MANUAL', 'PROVIDER', 'SCRAPING');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('ACADEMY', 'INDEPENDENT', 'INSTITUTION', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'PROVIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ScrapingPlatform" AS ENUM ('WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'TELEGRAM', 'TIKTOK', 'X', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ScrapingStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL DEFAULT 'ONE_TIME',
    "status" "ActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "schedule" JSONB,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "price" DECIMAL(12,2),
    "priceCurrency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "pricePeriod" "PricePeriod",
    "capacity" INTEGER,
    "imageUrl" TEXT,
    "providerId" TEXT NOT NULL,
    "locationId" TEXT,
    "verticalId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceUrl" TEXT,
    "sourcePlatform" VARCHAR(50),
    "sourceConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceCapturedAt" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "ProviderType" NOT NULL DEFAULT 'ACADEMY',
    "description" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "website" TEXT,
    "instagram" VARCHAR(100),
    "facebook" TEXT,
    "logoUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isClaimed" BOOLEAN NOT NULL DEFAULT false,
    "verificationDate" TIMESTAMP(3),
    "ratingAvg" DOUBLE PRECISION,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "avatarUrl" TEXT,
    "cityId" TEXT,
    "neighborhood" VARCHAR(100),
    "notificationPrefs" JSONB NOT NULL DEFAULT '{"email":true,"push":true,"frequency":"daily"}',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "birthDate" DATE NOT NULL,
    "interests" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "countryName" VARCHAR(100) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "neighborhood" VARCHAR(100),
    "cityId" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_locations" (
    "providerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "provider_locations_pkey" PRIMARY KEY ("providerId","locationId")
);

-- CreateTable
CREATE TABLE "verticals" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "targetAudience" VARCHAR(255) NOT NULL,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "verticals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "verticalId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_categories" (
    "activityId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "activity_categories_pkey" PRIMARY KEY ("activityId","categoryId")
);

-- CreateTable
CREATE TABLE "favorites" (
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("userId","activityId")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "providerReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_sources" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "platform" "ScrapingPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "verticalId" TEXT NOT NULL,
    "scraperType" VARCHAR(50) NOT NULL,
    "scheduleCron" VARCHAR(50) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" "ScrapingStatus",
    "lastRunItems" INTEGER,
    "config" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraping_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_logs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "ScrapingStatus" NOT NULL DEFAULT 'RUNNING',
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsDuplicated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "scraping_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_verticalId_status_idx" ON "activities"("verticalId", "status");

-- CreateIndex
CREATE INDEX "activities_providerId_idx" ON "activities"("providerId");

-- CreateIndex
CREATE INDEX "activities_locationId_idx" ON "activities"("locationId");

-- CreateIndex
CREATE INDEX "activities_startDate_idx" ON "activities"("startDate");

-- CreateIndex
CREATE INDEX "activities_status_verticalId_startDate_idx" ON "activities"("status", "verticalId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_countryCode_key" ON "cities"("name", "countryCode");

-- CreateIndex
CREATE INDEX "locations_cityId_idx" ON "locations"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "verticals_slug_key" ON "verticals"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_verticalId_slug_key" ON "categories"("verticalId", "slug");

-- CreateIndex
CREATE INDEX "ratings_activityId_idx" ON "ratings"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_userId_activityId_key" ON "ratings"("userId", "activityId");

-- CreateIndex
CREATE INDEX "scraping_sources_platform_isActive_idx" ON "scraping_sources"("platform", "isActive");

-- CreateIndex
CREATE INDEX "scraping_logs_sourceId_startedAt_idx" ON "scraping_logs"("sourceId", "startedAt");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "verticals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_locations" ADD CONSTRAINT "provider_locations_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_locations" ADD CONSTRAINT "provider_locations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "verticals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_categories" ADD CONSTRAINT "activity_categories_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_categories" ADD CONSTRAINT "activity_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_sources" ADD CONSTRAINT "scraping_sources_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_sources" ADD CONSTRAINT "scraping_sources_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "verticals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_logs" ADD CONSTRAINT "scraping_logs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "scraping_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
