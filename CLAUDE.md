# Infantia - Project Guidelines

## ⚠️ REGLA DE SEGURIDAD — VERIFICACIÓN DE DIRECTORIO

**AL INICIO DE CADA SESIÓN, antes de escribir cualquier línea de código:**

1. Ejecuta `pwd` y verifica que el resultado sea `C:/Users/denys/Projects/infantia`
2. Si el directorio NO es ese, detente inmediatamente y avisa al usuario:
   > "⛔ Directorio incorrecto: estoy en [directorio actual]. Este proyecto debe abrirse desde C:/Users/denys/Projects/infantia. Abre Claude Code desde esa carpeta."
3. Verifica que `prisma/schema.prisma` exista y contenga `provider = "postgresql"` (no SQLite).
   Si contiene SQLite o le falta `provider`, detente y avisa antes de continuar.

**Este proyecto es INFANTIA. Nunca escribas código de habit-challenge aquí.**
**habit-challenge tiene su propio directorio: `C:/Users/denys/Projects/habit-challenge`**

## What is this project?
Infantia is a multi-source activity discovery platform for families. It aggregates activities from websites, social media, and messaging platforms into a single searchable interface.

## Tech Stack
- **Framework:** Next.js 16.1.6 (App Router) + TypeScript (strict)
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma 7 (adapter-pg — DATABASE_URL in `prisma.config.ts`, NOT schema.prisma)
- **Search:** Meilisearch (stub — not yet active)
- **Auth:** Supabase Auth (SSR cookies)
- **Scraping:** Playwright (Instagram) + Cheerio (web) — auto-pagination via CheerioExtractor
- **AI/NLP:** Gemini 2.5 Flash (Google AI Studio) — NOT Claude API
- **Email:** Resend
- **Queue:** BullMQ + Redis (planned)

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
- `npm test` — Correr tests (una vez)
- `npm run test:watch` — Correr tests en modo watch
- `npm run test:coverage` — Tests + reporte de cobertura con threshold dinámico

## ⚠️ REGLA DE TESTING OBLIGATORIA

**Cada vez que modifiques o crees código en `src/modules/` o `src/lib/`:**

1. Verifica si existe un archivo de test en `__tests__/` junto al módulo
2. Si no existe → créalo con tests básicos del nuevo código
3. Si existe → agrégale tests para la funcionalidad nueva/modificada
4. Corre `npm test` antes de hacer commit — si falla, no hagas commit

**Threshold de cobertura:** sube +10% por día desde el inicio del proyecto (2026-03-16).
El CI rechazará PRs que bajen la cobertura por debajo del threshold del día.

## Workflow de versionamiento

**Cada unidad de trabajo = una rama + código + tests + docs. Nada llega a master sin los tres.**

### Flujo por tarea

```
1. Crear rama:   git checkout -b feat/nombre-descriptivo
2. Escribir código
3. Escribir/actualizar tests → npm test debe pasar
4. Actualizar docs/modules/<módulo>.md
5. Agregar entrada en CHANGELOG.md bajo [Unreleased]
6. Commit y merge a master
7. Si es hito → tag vX.Y.Z + nuevo Documento Fundacional (V0X.docx)
```

### Convención de ramas

| Prefijo | Cuándo usarlo |
|---|---|
| `feat/` | Nueva funcionalidad (scraper nuevo, endpoint nuevo) |
| `fix/` | Corrección de bug |
| `chore/` | Infraestructura, dependencias, limpieza |
| `test/` | Solo agregar/mejorar tests |
| `docs/` | Solo documentación |

### Versiones (Semantic Versioning)

| Versión | Cuándo |
|---|---|
| `vX.Y.Z` patch | Fix sin cambio funcional |
| `vX.Y.Z` minor | Nueva funcionalidad compatible |
| `vX.Y.Z` major | Cambio arquitectural o breaking change |

### Relación git tag ↔ Documento Fundacional

| Git tag | Doc Fundacional | Descripción |
|---|---|---|
| v0.0.1 | V02 | Stack, arquitectura, modelo de datos |
| v0.1.0 | V05 | Pipeline scraping completo, 167 actividades BibloRed |
| v0.2.0 | V07 | /actividades UI, bogota.gov.co (21 acts), 193 tests |
| v0.3.0 | V08 | Instagram scraping (Playwright, ig-session.json) |
| v0.4.0 | V09 | Auth SSR, admin panel, hijos, legal Ley 1581, 294 tests |
| v0.5.0 | V10 | Deduplicación 3 niveles, 211 actividades, 314 tests |

### Regla para Documento Fundacional

Generar nueva versión del doc cuando:
- Se agrega un módulo nuevo completo
- Cambia la arquitectura o el stack
- Se completa un milestone del roadmap

Comando: `node scripts/generate_v05.mjs` (actualizar número de versión primero)

## Notas de arquitectura críticas

- **Prisma config:** `DATABASE_URL` va en `prisma.config.ts` (no en `schema.prisma`). Usar `PrismaClient` con `PrismaPg` adapter.
- **Scraping pagination:** `CheerioExtractor.extractLinksAllPages()` sigue paginación automáticamente buscando texto "Siguiente/Next/›/»" o parámetro `?page=N+1`.
- **Instagram:** `PlaywrightExtractor` usa desktop UA, evento `domcontentloaded`, sesión persistente en `data/ig-session.json`.
- **NLP:** `GeminiNLPService` — cuota de Google AI Studio puede agotarse. Si falla, revisar cuota antes de debuggear código.
- **Deduplicación:** 3 niveles — (1) real-time Jaccard >75% en saveActivity, (2) cron diario auto-clean exactos, (3) manual review 70-90%.
- **Zod schema ActivityNLPResult:** `schedules[].notes` (string), NO `frequency` ni `timeSlot`. `location` es `{address, city}`, NO string.
- **tsconfig target ES2017:** No usar flag `/s` en regex — usar `[\s\S]` en su lugar.
- **@types/jsdom:** Requerido como devDependency para scripts que usan jsdom.

## Estado actual (v0.6.0)
- ~211 actividades en BD (5 fuentes: BibloRed, IDARTES, CEFEs, Centro Felicidad, Eventos Bogotá)
- 473 tests / 35 archivos test / 100% cobertura dinámica (threshold crece +10% por día desde 2026-03-16)
- GitHub Actions CI/CD: tests + build automático en cada push a master
- Vercel deployment: configurado con cron jobs (expire activities 5AM UTC, send notifications 9AM UTC)
- Doc Fundacional: V11 (pendiente generar V12 después de scraped Idartes/CEFEs)
