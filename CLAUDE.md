# HabitaPlan - Project Guidelines

## ⚠️ REGLA DE SEGURIDAD — VERIFICACIÓN DE DIRECTORIO

**AL INICIO DE CADA SESIÓN, antes de escribir cualquier línea de código:**

1. Ejecuta `pwd` y verifica que el resultado sea `C:/Users/denys/Projects/infantia`
2. Si el directorio NO es ese, detente inmediatamente y avisa al usuario:
   > "⛔ Directorio incorrecto: estoy en [directorio actual]. Este proyecto debe abrirse desde C:/Users/denys/Projects/infantia. Abre Claude Code desde esa carpeta."
3. Verifica que `prisma/schema.prisma` exista y contenga `provider = "postgresql"` (no SQLite).
   Si contiene SQLite o le falta `provider`, detente y avisa antes de continuar.

**Este proyecto es HABITAPLAN. Nunca escribas código de habit-challenge aquí.**
**habit-challenge tiene su propio directorio: `C:/Users/denys/Projects/habit-challenge`**

## What is this project?
HabitaPlan is a multi-source activity discovery platform for families. It aggregates activities from websites, social media, and messaging platforms into a single searchable interface.

## Tech Stack
- **Framework:** Next.js 16.2.1 (App Router) + TypeScript (strict)
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma 7 (adapter-pg — DATABASE_URL in `prisma.config.ts`, NOT schema.prisma)
- **Search:** Meilisearch (stub — not yet active)
- **Auth:** Supabase Auth (SSR cookies)
- **Scraping:** Playwright (Instagram) + Cheerio (web) — auto-pagination via CheerioExtractor
- **AI/NLP:** Gemini 2.5 Flash (Google AI Studio) — NOT Claude API
- **Email:** Resend
- **Queue:** BullMQ + Redis (implementado — `src/modules/scraping/queue/`)

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

## ⚠️ REGLA DE DOCUMENTACIÓN OBLIGATORIA — ACERVO COMPLETO

**Antes de cada despliegue (commit de release, tag, o push a producción), revisar y actualizar el acervo documental completo — no solo los documentos principales.**

El número de documentos crece con el proyecto. El inventario real siempre se obtiene ejecutando:

```bash
find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*"
```

**Revisar TODOS los que aparezcan** — no una lista fija. Si el proyecto crece a 20 o 30 documentos, se revisan los 20 o 30.

### Qué revisar por tipo de documento

| Tipo | Ejemplos | Qué actualizar |
|------|----------|---------------|
| Changelog | `CHANGELOG.md` | Nueva sección con los cambios de la sesión |
| Estado técnico | `ARCHITECTURE.md`, `TEST_STATUS.md`, `TEST_PLAN.md` | Versión, métricas, estructura |
| Guías operativas | `README.md`, `CLAUDE.md` | Versión, comandos, convenciones |
| Estrategias | `DEDUPLICATION-STRATEGY.md` | Estado actual, decisiones nuevas |
| Módulos | `docs/modules/*.md` | Flujos, endpoints, scripts del módulo |
| Plantillas y flujos | `.github/pull_request_template.md`, `.agents/workflows/*.md` | Si cambian convenciones o arquitectura de seguridad |
| **Manuales nuevos** | Cualquier `.md` que se agregue | Al ser creado y cuando su tema cambie |

### Acervo externo (HabitaPlan_Claude/)

| Documento | Cuándo actualizar |
|-----------|------------------|
| `HabitaPlan_Documento_Fundacional_V0X.docx` | Siempre que haya cambio de producto, arquitectura, stack o estrategia — generar nueva versión (no sobreescribir) |
| Manuales adicionales (si existen) | Cuando el tema que cubren cambie |

**Nunca desplegar sin haber revisado el acervo completo. El número exacto de documentos es lo que diga `find` — no un número fijo.**

---

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
| v0.6.1 | V12 | Auth SSR, admin, SEO, Web Push, /proveedores |
| v0.7.3 | V15 | BullMQ + Redis, 14 fuentes, 636 tests |
| v0.8.0 | V18 | Geocoding, mapa, autocompletado, ordenamiento, métricas |
| v0.8.1 | V19 | Mini-mapa detalle, venue-dictionary, backfill-geocoding |
| v0.8.1+ | V20 | Monetización A-G, proxy IPRoyal, dashboard proveedor |
| v0.9.0 | V21 | Seguridad (C-01/C-02/npm), observabilidad (logger/Sentry/health), scraping canales |
| v0.9.1 | V21 | Telegram operativo, provider claim flow, onboarding wizard, ratings aggregation |
| v0.9.2 | V21 | Instagram 10 fuentes activas, --validate-only, ratings.test.ts, branches ✅ |
| v0.9.3 | V21 | Instagram 7 cuentas corridas (~23 acts), nueva API key Gemini, fix Vite vuln |
| v0.9.3-S31..44 | V22..V25 | Features iterativas de Pipeline, ranking híbrido y Rebrand Habitaplan completados listados abajo. |
| v0.9.3 | V26 | Consolidación **Data Pipeline v1**, Search Engine v1 (penalización edad), zero-debt absoluto (60 tests files 100%). |
### Regla para Documento Fundacional

Generar nueva versión del doc cuando:
- Se agrega un módulo nuevo completo
- Cambia la arquitectura o el stack
- Se completa un milestone del roadmap

Comando: `node scripts/generate_v23.mjs` (V23 es la versión actual — cambios S38-S40 son UX, no requieren nuevo doc fundacional)

## Notas de arquitectura críticas

- **Prisma config:** `DATABASE_URL` va en `prisma.config.ts` (no en `schema.prisma`). Usar `PrismaClient` con `PrismaPg` adapter.
- **DDL en Supabase:** pgbouncer (transaction mode) es incompatible con `prisma migrate dev`. Usar `scripts/migrate-*.ts` con `$executeRawUnsafe()` para ALTER TABLE / CREATE TABLE.
- **Scraping pagination:** `CheerioExtractor.extractLinksAllPages()` sigue paginación automáticamente buscando texto "Siguiente/Next/›/»" o parámetro `?page=N+1`.
- **Instagram:** `PlaywrightExtractor` usa desktop UA, evento `domcontentloaded`, sesión persistente en `data/ig-session.json`. Proxy: `PLAYWRIGHT_PROXY_SERVER/USER/PASS` en `.env`.
- **NLP:** `GeminiNLPService` — 20 RPD free tier. Quota se renueva medianoche UTC (19:00 COL). Si falla con 429, esperar reset antes de debuggear código.
- **Geocoding:** venue-dictionary.ts (~0ms) → Nominatim (rate limit 1.1s) → cityFallback → null.
- **Deduplicación:** 3 niveles — (1) real-time Jaccard >75% en saveActivity, (2) cron diario, (3) manual review.
- **Zod schema ActivityNLPResult:** `schedules[].notes` (string), NO `frequency` ni `timeSlot`. `location` es `{address, city}`, NO string. `title` null/'' → 'Sin título'; `categories` null/[] → ['General'] (S31).
- **ScrapingCache:** caché dual disco + BD. Tabla `scraping_cache` en Supabase. `syncFromDb()` antes de pipeline; `saveToDb()` al terminar. `migrate-scraping-cache.ts` ya ejecutado.
- **Sponsor en email:** se pasa como prop opcional `sponsor?` a `ActivityDigestEmail` — si no se pasa, el bloque no aparece.
- **isPremium ordering:** `{ provider: { isPremium: 'desc' } }` en relevance sort — actividades de providers premium aparecen primero sin queries extra.
- **Provider dashboard access:** `getSessionWithRole()` → si ADMIN permite; si role=provider, verifica `provider.email === session.user.email && provider.isClaimed`.
- **tsconfig target ES2017:** No usar flag `/s` en regex — usar `[\s\S]` en su lugar.
- **ESLint freeze (S45):** `@typescript-eslint/no-explicit-any: "error"` global en `eslint.config.mjs`. Archivos legacy en `LEGACY_ANY_FILES[]` → `"warn"`. `src/generated/**` ignorado. 0 nuevos `any` sin CI rojo.
- **Email auth (SPF+DKIM+DMARC):** `v=spf1 include:zoho.com include:resend.com -all` — Zoho=usuario, Resend=transaccional. DKIM firmado vía subdominio técnico `send.habitaplan.com` (rebotes + aislamiento de reputación). DMARC `p=reject` activo. FROM unificado: `notificaciones@habitaplan.com`. Validado Gmail PASS. Cualquier nuevo proveedor de correo debe añadirse al SPF antes de enviar.
- **Privacy SSOT (S45):** `privacy.ts` cubre explícitamente datos de interacción + IP/UA + propósito + "no para identificación personal directa" — cubre el CTR Feedback Loop bajo Ley 1581.
- **Logger:** `createLogger(ctx)` en `src/lib/logger.ts`. NO usar console.* en producción. `log.error(msg, { error })` — nunca `log.error(msg, errorObject)` directo (serializa como array de chars).
- **Middleware global:** `src/middleware.ts` protege automáticamente toda ruta `/api/admin/*`. Rutas cron (`cron/scrape`, `expire-activities`, `send-notifications`) usan CRON_SECRET y están en la lista de excepciones.
- **Health check:** `GET /api/health` con `export const dynamic = 'force-dynamic'` — nunca cachear. Timeouts explícitos DB/Redis (2000ms). Semántica: `ok | degraded | down`. Business signal incluye `by_city` (JOIN SQL Activity → Location → City, slug normalizado sin tildes).
- **Sentry:** condicional via `SENTRY_DSN`. `withSentryConfig` en `next.config.ts` solo si está definida. Sin la var = zero overhead. `instrumentation-client.ts` inicializa Sentry en browser (S28).
- **ingest-sources.ts:** usar `--channel=banrep` o `--source=banrep` para ahorrar cuota Gemini. Banrep está primero en orden de ejecución. Pre-filtro de Gemini ya excluye .jpg/.png/.pdf/etc.
- **CHUNK_SIZE = 100** en `gemini.analyzer.ts` (era 200 en S31, reducido en S35 por resiliencia ante cuota parcial). Banrep Bogotá: 1.083 URLs → ~11 lotes. No cambiar sin medir impacto.
- **npm audit:** 3 moderate en `@hono/node-server` (dependencia dev de Prisma). No en producción — esperar fix de Prisma. No correr `npm audit fix --force` (breaking change Prisma 6→7).
- **Buscador mixto (S40):** `GET /api/activities/suggestions?q=` devuelve `SuggestionItem[]` max 5 (3 acts + 1 cat + 1 ciudad). Min 3 chars. Cache en memoria LRU (20 entries) en HeroSearch y Filters. AbortController cancela fetch previo. Historial en sessionStorage (`hp_recent_searches`, max 5). Pre-selección automática del primer ítem.
- **Facets count (S40):** `getFacets()` en `page.tsx` usa `_count: { select: { activities: { where: { activity: buildWhere(filters, 'categoryId') } } } }` — el conteo refleja los filtros activos, no el total global.
- **Telegram MTProto:** `telegram.extractor.ts` (gramjs) + `scripts/ingest-telegram.ts`. Requiere `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`. Pendiente auth por bloqueo ISP Colombia.
- **Health check (S28+S48):** `/api/health` devuelve 200 cuando Redis falla pero DB está OK. Solo DB down → 503. Redis degradado → 200 con status 'degraded'. `by_city` vía `$queryRaw` JOIN — slug normalizado NFD. GitHub Actions smoke `*/15 * * * *` con retry 3/3 + Slack.
- **Testing Edge Cases (S42):** Cuando utilices `countCache` en Node.js o el `lastEventMap` en `track.ts`, los tests concurrentes de Vitest retendrán la memoria Map(). Asegurar `mockCount.clear()` o exponer un método `clearCountCacheForTests` para tests de unidad.
- **Resilient Pipeline (S42):** Si fallan métodos del Pipeline por undefined de dependencias (ej. `this.playwrightExtractor`), revisar si tus proxies mockeados pasaron bien por `fetchWithFallback`. Siempre usar `vi.hoisted` antes del wrap.
- **Adaptive Quality Filter (S43):** `saveActivity()` acepta `ctx: AdaptiveContext` opcional (default vacío). `saveBatchResults()` carga `ContentQualityMetric` + `SourceHealth` UNA sola vez antes del loop. `Math.max(adaptive, source)` define `minDescriptionLength` por actividad. Log `activity_discarded_adaptive`.
- **CTR Feedback Loop (S44):** `src/modules/analytics/metrics.ts` — `getCTRByDomain()` agrega `outbound_click/activity_view` via join `Event→Activity.sourceUrl`. Cache TTL 5min. `ctrToBoost()` tiers: `>0.3→0.15 / >0.15→0.08 / >0.05→0.03`. `computeActivityScore()` acepta `ctrBoost=0` opcional. `ingest-sources.ts` combina CTR priority con health priority via `Math.min()`. **Cold start safe**: sin datos = boost 0, comportamiento original.

## Estado actual (v0.11.0 — Actualizado Hoy)
- **~275 actividades** en BD (Bogotá + Medellín fuentes activas)
- **1070 tests** en 69 archivos — `npm test` pasa — 0 errores TypeScript
- Cobertura: **>85% branches** ✅ (umbral alcanzado consistentemente)
- GitHub Actions CI/CD: tests + build automático en cada push a master
- Vercel deployment: ACTIVO (Despliegue automático de master) — proyecto **habitaplan-prod**, cuenta **Darg9** — https://www.habitaplan.com (Vercel team: dargs-projects-564b09ef)
- BullMQ + Upstash Redis: OPERATIVO
- **20 fuentes web** (18 Bogotá + 2 Medellín) + **12 Instagram** + canal Telegram
- Gemini: `gemini-2.5-flash`, 20 RPD — quota renueva medianoche UTC (19:00 COL). CHUNK_SIZE=100
- Documento Fundacional: **V25** generado (`scripts/generate_v25.mjs`)
- **3 vulnerabilidades moderate npm** en `@prisma/dev` (dev-only, no producción — mantener hasta Prisma fix)
- **0 console.*** en producción (migrado a logger estructurado)
- Tablas BD operativas: `scraping_cache`, `source_pause_config`, `source_url_stats` ✅
- **Sentry activo** en producción (SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN configurados en Vercel)
- **UptimeRobot** monitoreando `/api/health`
- **GitHub Actions smoke** `*/15 * * * *` — retry 3/3 + backoff 5s + Slack alert — `.github/workflows/production-smoke.yml`
- **Date preflight filter** activo en pipeline.ts — `isPastEventContent()` omite Gemini para eventos pasados (conserva 20 RPD)
- **URL classifier** activo en gemini.analyzer.ts — pre-filtra ~40% URLs antes de Gemini
- **Auto-pause dashboard** en `/admin/sources` — score monitoring + toggle por fuente
- **Adaptive Quality Filter** activo en storage.ts — `minDescriptionLength` dinámico por métricas + SourceHealth
- **CTR Feedback Loop** activo — events → ranking (ctrBoost) → crawler (CTR priority en BullMQ)
- **SEO landings:** 4 nuevas rutas dinámicas (categoria, publico, precio, ciudad) + breadcrumbs JSON-LD (S33)
- **Expiración configurable:** por location/source con fallback default 3h (S33)
- **Data Pipeline v1:** Eliminación de `validation.ts` legacy a favor de `data-pipeline.ts` Atómico (Filtrado de Spam + 10 Categorías Estrictas).
- **Search Engine v1:** Motor de Relevancia que penaliza falta de metadatos críticos como edad (`*= 0.85`).

### Known Technical Debt

| ID | Área | Descripción | Mitigación | Plan |
|---|---|---|---|---|
| DEBT-01 | Legal / Copyright | Las descripciones ingestadas antes de S41 podían exponer liability por copyright y falsa confianza. | **Fase 1 y 2 COMPLETADAS (S43):** Descripciones reescritas con `rule-based` y NLP limitando la IA. UI con atribución exacta para asumir rol de "Agregador". Content Quality Dashboard midiendo degradación. | - |
| DEBT-02 | TypeScript | 235 usos de `any` pre-existentes en pipeline.ts, storage.ts, gemini.analyzer.ts | **CONGELADO (S45):** `eslint.config.mjs` bloquea nuevos `any` con `error`; archivos legacy → `warn`. Boy Scout Rule activa. `src/lib/track.ts` ya corregido. | Reducir progresivamente al tocar cada archivo |
| DEBT-03 | npm audit | 3 vulnerabilidades `moderate` en `@prisma/dev` (dependencia de desarrollo) | No están en producción (dev-only) | Esperar fix oficial de Prisma — no aplicar `--force` (breaking change 6→7) |
| DEBT-04 | Estabilidad DB | Schema drift y parseo inseguro de Prisma Decimal a string en UI causando Error 500s | **Mitigado (S42):** Implementación de `decimal.ts` globalizado y linting estricto (no .toNumber()), sumado a pre-validador `schema:check`. | - |
| DEBT-05 | ESLint legacy | 25 errores pre-existentes no relacionados con `any`: `prefer-const` (1), `@ts-ignore` (2), `no-require-imports` (1), `react/no-unescaped-entities` (6), `@next/next/no-html-link-for-pages` (5), `setState-in-effect` (4), `no-restricted-syntax/.toNumber()` (1), otros (5). Ninguno es `no-explicit-any`. | No bloquean CI — son warnings en archivos legacy. Boy Scout Rule activa. | Corregir al tocar cada archivo afectado |

### Features v0.9.0 (seguridad + observabilidad + scraping)
- **Middleware global:** `src/middleware.ts` protege `/api/admin/*` automáticamente (ADMIN o CRON_SECRET)
- **Health check:** `GET /api/health` — estado DB + Redis en tiempo real (listo para UptimeRobot)
- **Logger estructurado:** `createLogger(ctx)` en `src/lib/logger.ts` — reemplaza todos los console.*
- **Sentry integrado:** `@sentry/nextjs` — activo solo si `SENTRY_DSN` en env (zero overhead sin var)
- **Security headers:** CSP, HSTS, X-Frame-Options, Referrer-Policy en `next.config.ts`
- **Seguridad API:** PUT/DELETE /api/activities/:id requieren ADMIN (fix C-01)
- **Seguridad cron:** CRON_SECRET sin fallback inseguro (fix C-02)
- **ingest-sources.ts:** sistema de canales (`--channel`, `--source`, `--list`) + Banrep primero
- **Bug fix scraping:** pre-filtro excluye imágenes/binarios antes de Gemini (ahorra cuota)

### Features v0.8.1+ (monetización + proxy)
- **isPremium Provider:** badge "⭐ Destacado" en ActivityCard + ordering preferencial en relevance sort
- **Sponsor model:** CRUD en `/admin/sponsors` + bloque en email digest + UTM tracking
- **Página /anunciate:** landing de monetización con stats y precios orientativos
- **Dashboard proveedor:** `/proveedores/[slug]/dashboard` — acceso ADMIN o owner (email + isClaimed)
- **UserMenu:** muestra "Mi panel" si `providerSlug` presente (role=provider + isClaimed)
- **UTM tracking email:** todos los links del digest con `?utm_source=habitaplan&utm_medium=email&utm_campaign=...`
- **Proxy Playwright:** `PLAYWRIGHT_PROXY_SERVER/USER/PASS` — sin vars = sin proxy (backward compatible)

### Features v0.8.0 – v0.8.1
- **Geocoding Nominatim:** coords reales para locations, venue-dictionary 40+ venues Bogotá
- **Mini-mapa Leaflet:** en sidebar de `/actividades/[id]`
- **Autocompletado búsqueda:** sugerencias con debounce 300ms + navegación teclado
- **Ordenamiento:** 5 criterios (relevance, date, price_asc/desc, newest)
- **Mapa `/mapa`:** pines por categoría, popup con CTA
- **Métricas admin:** `/admin/metricas` con vistas + búsquedas frecuentes
- **Gradientes placeholder:** 14 gradientes por categoría para actividades sin imagen
- **Filtro de ciudad:** dropdown en `/actividades` (aparece automático con >1 ciudad)
- **API queue admin:** `GET/POST /api/admin/queue/status` y `/api/admin/queue/enqueue`

## Tabla de versiones git ↔ Documento Fundacional (actualizada)

| Git tag | Doc Fundacional | Descripción |
|---|---|---|
| v0.0.1 | V02 | Stack, arquitectura, modelo de datos |
| v0.1.0 | V05 | Pipeline scraping completo, 167 actividades BibloRed |
| v0.2.0 | V07 | /actividades UI, bogota.gov.co (21 acts), 193 tests |
| v0.3.0 | V08 | Instagram scraping (Playwright, ig-session.json) |
| v0.4.0 | V09 | Auth SSR, admin panel, hijos, legal Ley 1581, 294 tests |
| v0.5.0 | V10 | Deduplicación 3 niveles, 211 actividades, 314 tests |
| v0.6.0 | V12 | robots.txt, sitemap.xml, EmptyState, 404, skeletons, CI/CD, Vercel |
| v0.6.1 | V12 | Certificación: Supabase URLs corregidas, auth email verificado |
| v0.7.0 | V13 | Tests mejorados: 531 tests (90.53% coverage), deduplication.ts + send-notifications |
| v0.7.1 | V14 | Deuda técnica tests: 581 tests, 98.32% stmts, playwright 97.22% funcs |
| v0.7.2 | — | Scraping multi-fuente: sitemap extractor, Banrep, logger FK fix, cityName configurable |
| v0.7.3 | V15 | Deuda técnica queue tests: 636 tests, 97.41% stmts, queue/* 100% cobertura |
| v0.7.4 | V16 | BullMQ + Upstash Redis operativo, Banrep multi-ciudad (10 ciudades), fix sitemapPatterns |
| v0.7.5 | V16 | URLs canónicas, backfill imágenes, reportar error, filtro precio, API queue |
| v0.7.6 | V16 | Mapa Leaflet, actividades similares, og:image pipeline, filtro ciudad, gradientes |
| v0.7.7 | V17 | Web Push, admin actividades, página proveedor /proveedores/[slug] |
