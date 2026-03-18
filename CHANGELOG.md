# Changelog — Infantia

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionamiento basado en [Semantic Versioning](https://semver.org/lang/es/).

Relación con Documento Fundacional:
- Cada tag `vX.Y.Z` en git corresponde a una versión del doc (V01, V02...).
- Cambios menores acumulan hasta el siguiente hito → nuevo doc.

---

## [Unreleased]
<!-- Agregar aquí cada cambio antes de hacer el tag de release -->

---

## [v0.5.0] — 2026-03-18
**Documento Fundacional: V10 (pendiente de generar)**

### Added
- Enum `ActivityAudience` en Prisma: KIDS / FAMILY / ADULTS / ALL
- Filtro de audiencia en `/actividades` con facetado completo
- Filtros facetados: cada filtro calcula sus opciones excluyendo su propia dimensión (0 combinaciones vacías garantizado)
- `audience` field en Gemini prompts (SYSTEM_PROMPT + INSTAGRAM_SYSTEM_PROMPT) para inferencia automática
- Script `reclassify-audience.ts`: reclasificó 200 actividades existentes (35 KIDS / 36 FAMILY / 68 ADULTS / 61 ALL)
- `ShareButton` component: Web Share API nativa + fallback dropdown con 9 plataformas (WhatsApp, Facebook, Twitter/X, Telegram, Email, LinkedIn, Instagram, TikTok, Copiar vínculo)
- Tarjetas con h-20 strip visual uniforme (imagen real cuando existe, emoji placeholder cuando no)
- `audience` en `listActivitiesSchema` y `createActivitySchema`

### Fixed
- `ShareButton`: `ageMin=0` tratado como falsy en JS (`&&`) → corregido con `!= null`
- `activities.schemas`: `ageMax: max(18)` → `max(120)` en list y create schemas
- `activities.schemas`: refine `ageMin > ageMax` con mismo falsy-zero bug
- `actividades/page.tsx`: `parseInt(ageMin)` sin guard NaN → `parseAge()` con `Number.isFinite()`
- `actividades/page.tsx`: `?type=INVALID` causaba crash 500 → validación contra enums antes de Prisma
- `actividades/page.tsx`: `?audience=INVALID` silenciosamente ignorado con validación
- `Pagination.tsx`: `disabled={page === totalPages}` → `>=` (Siguiente habilitado en page > total)
- `api/children/route.ts`: cálculo de edad solo por año → comparación por fecha exacta
- `api/admin/scraping/logs/route.ts`: `parseInt()` sin radix ni NaN guard

### Tests
- 294 → 314 tests (+20)
- +5 tests nuevos en `activities/schemas.test.ts` cubriendo audience y ageMax=120

---

## [v0.1.0] — 2026-03-16
**Documento Fundacional: V06**

### Added
- Pipeline de scraping completo end-to-end
- Batch scraping BibloRed: 167 actividades guardadas en Supabase (97% alta confianza)
- Integración Gemini 2.5 Flash para NLP / extracción de datos
- Conexión a Supabase PostgreSQL con Prisma 7
- Seed inicial: 10 ciudades, 1 vertical (Infantia), 47 categorías
- Cache incremental de scraping (`data/scraping-cache.json`)
- Script `verify-db.ts` para validar estado de la base de datos
- API de actividades con CRUD completo
- Arquitectura modular por dominio (scraping, activities, providers, search...)
- Schema de base de datos con 11 entidades
- Scraper genérico con Cheerio + Playwright
- Sistema de testing: Vitest + cobertura dinámica +10%/día
- 120 tests — 31% cobertura statements, 52% functions (supera threshold día 1: 30%)
- TEST_PLAN.md y TEST_STATUS.md propios de Infantia
- Workflow de versionamiento: feature branches + PR template + CHANGELOG + docs de módulos
- Separación completa de habit-challenge (directorio y cuenta GitHub independientes)
- Cuenta GitHub dedicada: Darg9 / denysreyes@gmail.com

### Fixed
- schema.prisma sin `url` (Prisma 7 lo toma de prisma.config.ts)
- node_modules con Prisma 5 → reinstalado Prisma 7
- Regla de directorio en CLAUDE.md para prevenir mezcla de proyectos
- TEST_PLAN.md y TEST_STATUS.md contenían archivos de habit-challenge (reemplazados)

### Decisions
- Stack: Next.js 15 + TypeScript + Supabase + Prisma 7 + Meilisearch
- NLP: Gemini 2.5 Flash (scraping) — Claude API (futuro)
- Hosting: Vercel (frontend) + Railway (workers)
- Multi-vertical por configuración, no por código
- Sin ActivityOccurrence en MVP (over-engineering)

---

## [v0.0.1] — 2026-03-15
**Documento Fundacional: V02**

### Added
- Definición de visión, problema y solución
- Modelo de datos conceptual (11 entidades)
- Arquitectura de alto nivel
- Estrategia geográfica multi-país
- Hipótesis de monetización
- Roadmap inicial
- Decisión de stack tecnológico (Scenario 1: Node.js Full-Stack)
