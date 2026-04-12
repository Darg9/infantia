# HabitaPlan — Activity Discovery Platform for Families

A multi-source activity discovery platform for families in Bogotá, Colombia. Aggregates activities from websites, Instagram, and other sources into a single searchable interface.

**Version:** v0.10.0-S41 | **Status:** Production — 2026-04-12 | **Tests:** 882 passing / 56 files | **Coverage:** 91.39% stmts / 85.90% branches | **URL Classifier:** ✅ Active

## Quick Start

### Prerequisites
- Node.js 24+
- PostgreSQL database (via Supabase)
- `.env` file configured with required secrets

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run DB migrations (raw SQL via scripts — Supabase pgbouncer incompatible with prisma migrate dev)
npx tsx scripts/migrate-premium.ts            # isPremium/premiumSince on Provider
npx tsx scripts/migrate-sponsors.ts           # Sponsor table
npx tsx scripts/migrate-provider-claims.ts    # ProviderClaim table + ClaimStatus enum
npx tsx scripts/migrate-onboarding.ts         # onboardingDone column in User

# Seed initial data
npx tsx prisma/seed.ts
npx tsx scripts/seed-scraping-sources.ts

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.1 (App Router) + TypeScript strict |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase + Prisma 7 (adapter-pg) |
| Auth | Supabase Auth (SSR cookies) |
| AI/NLP | Google Gemini 2.5 Flash (20 RPD free tier) |
| Scraping | Playwright (Instagram) + Cheerio (web) + optional proxy (IPRoyal) |
| Queue | BullMQ + Upstash Redis |
| Email | Resend + react-email |
| Maps | Leaflet + OpenStreetMap |
| Geocoding | venue-dictionary.ts (~0ms) + Nominatim fallback |
| Search | Meilisearch Cloud (activate at +1,000 active activities) |
| Testing | Vitest + @vitest/coverage-v8 |
| CI/CD | GitHub Actions → Vercel |

## Core Features

- 🔍 **Search & Filter:** Full-text search + faceted filters (category, age, price, audience, city) + sorting (5 options)
- 🗺️ **Interactive Map:** Leaflet map with category pins + mini-map in activity detail
- 👥 **User Profiles:** Signup/login via Supabase Auth, manage children (Ley 1581 compliance), favorites, history
- ⭐ **Ratings:** 1–5 star ratings with comments per activity
- 🤖 **AI-Powered:** Automatic activity extraction and classification with Gemini NLP
- 📧 **Email Digest:** Daily/weekly digests with UTM tracking + optional sponsor block
- 🔔 **Web Push:** Real push notifications via VAPID + Service Worker
- 💰 **Monetization:** isPremium providers (badge + priority ordering), sponsor newsletter blocks, /anunciate landing
- 🏢 **Provider Dashboard:** `/proveedores/[slug]/dashboard` — views, premium status, activity table (ADMIN or owner)
- 📋 **Provider Claim Flow:** Providers can claim their profiles via `/proveedores/[slug]/reclamar` — admin approves → PROVIDER role assigned
- 🧭 **Onboarding Wizard:** 3-step setup for new users (city → children → done) — auto-redirects on first login
- 🔒 **Admin Panel:** Sponsors CRUD, activity management, metrics, scraping queue, claims management
- 📱 **Responsive:** Mobile-first design
- 🛡️ **Secure:** middleware global protege /api/admin/*, 0 vulns npm, security headers (CSP/HSTS)
- 📊 **Observable:** logger estructurado `createLogger(ctx)`, Sentry ready, `/api/health` para monitoreo
- 🧪 **Well-tested:** 882 unit tests (91.39% stmts / 85.90% branches), E2E tests

## Commands

```bash
npm run dev                    # Start development server
npm run build                  # Build for production
npm test                       # Run all tests (882 tests)
npm run test:coverage          # Tests + coverage report (threshold: 85%)

# Scraping
npx tsx scripts/ingest-sources.ts --list                       # Ver fuentes por canal
npx tsx scripts/ingest-sources.ts --save-db                    # Ingest completo
npx tsx scripts/ingest-sources.ts --channel=web --save-db      # Solo fuentes web
npx tsx scripts/ingest-sources.ts --source=banrep --save-db    # Solo Banrep
npx tsx scripts/ingest-sources.ts --queue                      # Queue via BullMQ
npx tsx scripts/run-worker.ts                                  # Start BullMQ worker

# Maintenance
npx tsx scripts/promote-admin.ts <email>         # Grant ADMIN role
npx tsx scripts/verify-db.ts                     # Verify DB state
npx tsx scripts/backfill-geocoding.ts [--dry-run] # Geocode 0,0 locations
npx tsx scripts/backfill-images.ts               # Backfill og:image from sourceUrl
npx tsx scripts/expire-activities.ts             # Manually expire activities

# Telegram
npx tsx scripts/telegram-auth.ts                 # One-time MTProto auth → TELEGRAM_SESSION
npx tsx scripts/ingest-telegram.ts [--dry-run]   # Ingest Telegram channels

# Source ranking & analytics
npx tsx scripts/source-ranking.ts [--weeks=4] [--platform=INSTAGRAM]  # Ranking de fuentes
npx tsx scripts/test-instagram.ts <URL> --count-new  # Cuenta posts nuevos sin Gemini
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# AI
GEMINI_API_KEY=...

# Email
RESEND_API_KEY=...

# Queue
REDIS_URL=rediss://...

# Site
NEXT_PUBLIC_SITE_URL=https://habitaplan-activities.vercel.app

# Proxy (optional — IPRoyal residential, pay-as-you-go $7/GB)
PLAYWRIGHT_PROXY_SERVER=http://geo.iproyal.com:12321
PLAYWRIGHT_PROXY_USER=...
PLAYWRIGHT_PROXY_PASS=...

# Cron auth
CRON_SECRET=...
```

## Architecture

```
src/
  app/                    # Next.js App Router
    actividades/          # Activity listing + detail
    admin/                # Admin panel (sponsors, activities, metrics, scraping)
    anunciate/            # Monetization landing
    perfil/               # User zone (profile, favorites, children, notifications)
    proveedores/[slug]/   # Public provider page + dashboard
    api/                  # REST endpoints
  modules/
    activities/           # Activity domain (service, schemas)
    scraping/             # Scraping pipeline (Cheerio, Playwright, Gemini, BullMQ)
  components/
    layout/               # Header (with providerSlug logic), Footer, UserMenu
  lib/
    auth.ts               # Supabase Auth helpers (getSession, requireRole)
    db.ts                 # Prisma singleton
    logger.ts             # createLogger(ctx) — structured logger + Sentry integration
    ratings.ts            # recalcProviderRating() — aggregates ratingAvg/Count on Provider
    activity-url.ts       # Canonical URL helpers
    venue-dictionary.ts   # 40+ Bogotá venues with exact coords (~0ms lookup)
    geocoding.ts          # venue-dictionary → Nominatim → cityFallback → null
    push.ts               # Web Push VAPID notifications
    email/templates/      # react-email templates with UTM tracking
  middleware.ts           # Global admin route protection (/api/admin/*)
  app/api/health/         # DB + Redis health check endpoint
```

## Monetization

| Phase | Feature | Status |
|-------|---------|--------|
| Mes 1-5 | Audience building | In progress |
| Mes 6 | Newsletter sponsorships (COP 200k-500k/edition) | Infrastructure ready |
| Mes 9 | Premium listings (COP 150k-300k/month) | Infrastructure ready |
| Pending | Wompi payment gateway | Awaiting first client + bank account |

## Deployment

- **Production:** https://habitaplan.com (Vercel, dominio activo)
- **Repo:** https://github.com/Darg9/infantia (private)
- **Branch:** master — auto-deploy on push via GitHub Actions → Vercel
- **DB:** Supabase PostgreSQL (Free Tier)
- **Queue:** Upstash Redis (Free Tier)
