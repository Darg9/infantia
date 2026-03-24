# Changelog — Infantia

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionamiento basado en [Semantic Versioning](https://semver.org/lang/es/).

Relación con Documento Fundacional:
- Cada tag `vX.Y.Z` en git corresponde a una versión del doc (V01, V02...).
- Cambios menores acumulan hasta el siguiente hito → nuevo doc.

---

## [Unreleased]
<!-- Agregar aquí cada cambio antes de hacer el tag de release -->

### Added
- Componente `UserMenu`: dropdown con click-outside detection, contiene "Mi perfil", "Mis favoritos", "Salir" y enlace admin (condicional)
- Método `getOrCreateDbUser()` en auth: upsert atomático en table `users` con Supabase Auth ID

### Changed
- Header: reemplazó avatar + "Mi perfil" link + LogoutButton con componente `UserMenu` unificado
- `/actividades` layout: dos filas de filtros en lugar de una (búsqueda+edad+audiencia / tipo+categoría+limpiar) → barra búsqueda menos estrecha en desktop
- Contador de resultados: removido texto redundante "(con filtros activos)" → solo mostraba el count
- Ordenamiento de actividades: `[{ status: 'asc' }, { createdAt: 'desc' }]` → ACTIVE primero, EXPIRED al final
- Badge de precio en tarjetas: ocultado cuando no hay información ("No disponible") → solo muestra "Gratis" o precio real
- Badge de precio en hero de detalle: ocultado cuando no hay información
- Hero de detalle sin imagen: reemplazado placeholder gigante (h-48/h-64) con encabezado compacto (h-~44) con fondo de categoría

### Fixed
- `getOrCreateDbUser()` en `auth/callback/route.ts`: nueva aplicación crea DB record inmediatamente en OAuth
- Páginas de perfil (`/perfil/*`): removidas condiciones "Usuario no encontrado" → upsert garantiza registro
- API routes profile: cambiadas de `requireAuth() + update` a `getSession() + upsert` → maneja usuarios sin DB record
- `useActivityHistory`: crash cuando `JSON.parse()` retorna non-array → validación con `Array.isArray()`
- Filtros: counts añadidos a opciones de categoría (ya existían para audience y type)

### Tests
- Pruebas generales de navegación: home, `/actividades` (filtros, búsqueda, paginación, vacío), detalle, login, registro, páginas legales

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

## [v0.4.0] — 2026-03-17
**Documento Fundacional: V09**

### Added
- Auth completa con Supabase Auth (SSR cookies): login, registro, perfil, callback OAuth
- Panel admin: `/admin`, `/admin/scraping/sources`, `/admin/scraping/logs`
- API protegida por middleware: `GET /api/admin/scraping/sources` y `/logs`
- Perfiles de hijos (Ley 1581 Escenario A): `/perfil/hijos`, `/perfil/hijos/nuevo`
- API `GET/POST/DELETE /api/children` con auth obligatoria
- Child model: `gender`, `consentType`, `consentGivenAt/By`, `consentText`
- User model: `accountType`, `guardianId`
- Cron Vercel 5AM UTC (`/api/admin/expire-activities`) para expirar actividades pasadas
- Páginas legales Ley 1581: `/privacidad`, `/tratamiento-datos`, `/terminos`, `/contacto`
- Header con logout, link a registro, acceso a admin para rol ADMIN
- AuthProvider: refresco automático de sesión
- Script `promote-admin.ts` (asignar rol ADMIN)
- Script `seed-scraping-sources.ts`
- Migración SQL: trigger que sincroniza `auth.users` → `public.users`

### Tests
- 212 → 294 tests (+82)
- Nuevos: db, supabase/client, supabase/server, supabase/middleware, scraping/logger, auth
- Cobertura: 94.5% stmts / 88% branch / 84.4% funcs / 95.9% lines

---

## [v0.3.0] — 2026-03-16
**Documento Fundacional: V08**

### Added
- Instagram scraping con Playwright (`PlaywrightExtractor`)
- Sesión persistente en `data/ig-session.json` (evita re-login)
- Script `ig-login.ts` para autenticación inicial manual
- Scripts `test-instagram.ts` y `debug-instagram.ts`
- `INSTAGRAM_SYSTEM_PROMPT` en GeminiAnalyzer para clasificación de posts
- 12 actividades scrapeadas de 2 cuentas: `@fcecolombia` y `@quehaypahacerenbogota`
- Pipeline `runInstagramPipeline()` en `pipeline.ts`
- 3 estrategias de extracción de captions (`aria-label`, `alt`, `textContent`)

### Tests
- 193 → 212 tests (+19)
- Nuevos: `gemini-analyzer.test.ts` (casos Instagram), `playwright-extractor.test.ts`

---

## [v0.2.0] — 2026-03-16
**Documento Fundacional: V07**

### Added
- Página `/actividades` con listado, filtros y paginación
- Segunda fuente de scraping: `bogota.gov.co` (21 actividades)
- Emojis de categorías en home y tarjetas de actividades
- Refactor `category-utils.ts` con tests propios
- Fix: truncación de Gemini en modo `--discover` (respuestas largas)
- Scripts de diagnóstico: `check-sources.ts`, `check-urls.ts`

### Tests
- 120 → 193 tests (+73)
- Módulos cubiertos: `api-response`, `cheerio-extractor`, `claude-analyzer`, `gemini-analyzer`, `pipeline`
- Cobertura: 95.8% lines

---

## [v0.1.0] — 2026-03-16
**Documento Fundacional: V05**

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
