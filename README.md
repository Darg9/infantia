# Infantia — Activity Discovery Platform for Families

A multi-source activity discovery platform for families in Bogotá, Colombia. Aggregates activities from websites, Instagram, and other sources into a single searchable interface.

**Version:** v0.7.3 | **Status:** Production — 2026-03-25 | **Tests:** 636 passing / 40 files | **Coverage:** 97.41% statements

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (via Supabase)
- `.env` file configured with required secrets

### Setup

```bash
# Install dependencies
npm install

# Set up database
npx prisma migrate dev

# Seed initial data
npx tsx prisma/seed.ts
npx tsx scripts/seed-scraping-sources.ts

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Supabase Auth (SSR)
- **AI/NLP:** Google Gemini 2.5 Flash (Activity extraction)
- **Scraping:** Playwright (Instagram) + Cheerio (web)
- **Testing:** Vitest 1.0 + React Testing Library
- **CI/CD:** GitHub Actions

## Core Features

- 🔍 **Search & Filter:** Full-text search + faceted filters (category, age, price, audience type)
- 👥 **User Profiles:** Signup/login via Supabase Auth, manage children, favorite activities
- ⭐ **Favorites:** Bookmark activities with timestamps, view history
- 🤖 **AI-Powered:** Automatic activity extraction and classification with Gemini NLP
- 📱 **Responsive:** Mobile-first design with Tailwind CSS
- ♿ **Accessible:** WCAG-compliant components
- 🧪 **Well-tested:** 636 unit tests (97.41% coverage), E2E tests, component tests
- 🚀 **Production-ready:** CI/CD pipeline, automated testing, static generation (robots.txt, sitemap.xml)

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## Project Structure

```
src/
├── app/              # Next.js App Router (pages, layouts, API)
├── modules/          # Domain modules (activities, scraping, users, etc.)
├── components/       # Reusable React components
├── lib/              # Shared utilities and helpers
├── types/            # TypeScript type definitions
├── config/           # App configuration
└── hooks/            # Custom React hooks
```

## Testing

- **Unit tests:** 636 tests / 40 files
- **Coverage threshold:** 85% (cap — all thresholds met)
- **Test frameworks:** Vitest 4.1.0, React Testing Library, Playwright (E2E)

Run tests:
```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Scraping

### Test a scraper

```bash
# Single page (extract activity from URL)
npx tsx scripts/test-scraper.ts "https://example.com/activity"

# Discovery mode (find all activities on a listing page)
npx tsx scripts/test-scraper.ts --discover "https://example.com/events" --max-pages=5

# Save to database
npx tsx scripts/test-scraper.ts --discover "https://example.com/events" --save-db
```

### Scraping sources

Currently configured sources:
1. **BibloRed** (Bogotá public library events)
2. **Bogotá.gov.co** (City culture & recreation)
3. **Centro Felicidad Chapinero** (Municipal center)
4. **Idartes** (Bogotá Institute of Culture)
5. **Instagram:** fcecolombia
6. **Instagram:** quehaypahacerenbogota

## Deployment

### Prerequisites
- Vercel account
- Environment variables configured in GitHub secrets:
  - `DATABASE_URL` (PostgreSQL connection)
  - `NEXT_PUBLIC_SUPABASE_URL` (Supabase project URL)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase anon key)
  - `GOOGLE_AI_STUDIO_KEY` (Gemini API key)
  - `RESEND_API_KEY` (Email API key)
  - `RESEND_FROM_EMAIL` (Sender email)

### Deploy to Vercel

```bash
# Connect to Vercel and push to master branch
git push origin master
```

The CI/CD pipeline will:
1. Run all 473 tests
2. Build production bundle
3. Deploy to Vercel (if all checks pass)

### Cron Jobs (Vercel)

- **5:00 AM UTC**: Expire past activities (`/api/admin/expire-activities`)
- **9:00 AM UTC**: Send daily notifications (`/api/admin/send-notifications`)

## Documentation

- **CLAUDE.md** — Project guidelines, conventions, and tech decisions
- **ARCHITECTURE.md** — System design and module documentation
- **CHANGELOG.md** — Version history and release notes
- **TEST_PLAN.md** — Testing strategy and coverage goals
- **DEDUPLICATION-STRATEGY.md** — 3-level activity deduplication algorithm

## Contributing

See `CLAUDE.md` for:
- Code conventions (TypeScript strict, Spanish for UI)
- Git workflow (branches, commits, versioning)
- Testing requirements (mandatory for `src/modules/` and `src/lib/`)
- Documentation standards

## License

MIT — See LICENSE file for details

## Status

**v0.6.1** — certified 2026-03-24
- ✅ 473/473 tests passing (4.94s)
- ✅ CI/CD pipeline live (GitHub Actions → Vercel auto-deploy)
- ✅ Production: https://infantia-activities.vercel.app — 211 activities
- ✅ Supabase Auth email delivery verified (confirmation email working)
- ✅ robots.txt + sitemap.xml generating correctly in production
- ✅ Empty states, custom 404, loading skeletons
- ✅ Documento Fundacional V12 generated (Infantia_V12_v0.6.0.docx)
- ⚠️ Coverage gap: 86.85% stmts (threshold 100%) — deduplication.ts + send-notifications.ts need tests
- 🔄 Awaiting Gemini API quota reset for Idartes/CEFE scraping (~95 activities)

## Contact

Built with ❤️ for families in Bogotá exploring activities and events with their children.
