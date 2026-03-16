# Infantia - Project Guidelines

## What is this project?
Infantia is a multi-source activity discovery platform for families. It aggregates activities from websites, social media, and messaging platforms into a single searchable interface.

## Tech Stack
- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma
- **Search:** Meilisearch
- **Auth:** Supabase Auth
- **Scraping:** Playwright + Cheerio
- **AI/NLP:** Claude API (Anthropic)
- **Queue:** BullMQ + Redis

## Project Structure
```
src/
  app/           → Next.js App Router (pages, layouts, API routes)
  modules/       → Domain modules (activities, providers, scraping, etc.)
  components/    → Reusable UI components
  lib/           → Shared utilities
  types/         → TypeScript type definitions
  config/        → App configuration and constants
  hooks/         → Custom React hooks
```

## Conventions
- Use TypeScript strict mode
- Module-based organization: each domain has its own folder under `src/modules/`
- API routes go in `src/app/api/`
- Use Prisma for all database access
- All dates stored in UTC, displayed in local timezone
- Spanish for user-facing content, English for code (variable names, comments)
- No hardcoded cities, countries, or currencies — always dynamic from database

## Commands
- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run lint` — Run ESLint
