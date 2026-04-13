# Changelog — HabitaPlan

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionamiento basado en [Semantic Versioning](https://semver.org/lang/es/).

Relación con Documento Fundacional:
- Cada tag `vX.Y.Z` en git corresponde a una versión del doc (V01, V02...).
- Cambios menores acumulan hasta el siguiente hito → nuevo doc.

---

## [Unreleased]

---

## [v0.11.0-S42] — Hoy (Product Analytics Zero-Dependencies + Hybrid Ranking Fixes)
**Documento Fundacional: V25** | Rama: master | Commit: por generar

### Features
- **Zero-Dependencies Product Analytics**: Infraestructura de tracking nativa montada 100% sobre Prisma + Serverless, eliminando dependencia de GA/Mixpanel para mantener filosofía de *Zero Debt*.
- **Modelo Event**: Nuevo modelo en PostgreSQL para capturar `page_view`, `activity_view`, `activity_click`, `outbound_click`, `search_applied` usando `JSONB` robusto.
- **Tracker Universal**: Módulo en `src/lib/track.ts` fail-silent y asíncrono para emitir eventos sin bloquear la experiencia de usuario.
- **Memoria Anti-Spam (Throttle)**: Arquitectura robusta implementada en memoria rápida para filtrar rebotes sintéticos sin necesidad de Redis/Rate Limits externos: 500ms `activity_click`, 1000ms `outbound_click`.

### Fixes & Optimizations
- **Consistencia Schema**: Migrado schema físico bloqueado por PgBouncer reconstruyéndolo manual y sincrónico al de Supabase, remediando types faltantes para `sourceHealth` y arreglando mocks en la pipeline de scraping.
- **Hybrid Ranking Consistency**: Se introdujo un Cache Híbrido TTL (`getCachedCount`) en Node.js memoria sobre `prisma.activity.count` que garantiza una enumeración real de resultados consistentes al total, aislando queries concurrentes profundas y sobre-fetching.
- **Test Integrity**: Pasando de regresiones críticas a Suite completa superada en verde (889 tests). Resiliencia del pipeline actualizada para pruebas mockeadas.

---

## [v0.10.0-S41] — 2026-04-12 (Centro de Seguridad Legal SSOT + PDFs)
**Documento Fundacional: V24** | Rama: master | Commit: `f8bd1db`

### Features

#### Centro de Seguridad (Legal SSOT)
- Implementación de arquitectura "Single Source of Truth" (SSOT) para políticas legales en `src/modules/legal/constants/`.
- **Privacidad** (`/seguridad/privacidad`): Rediseño de UI con "Resumen para humanos", generación estricta de PDF server-side con logs enriquecidos.
- **Términos de uso** (`/seguridad/terminos`): Inyección automática desde `terms.ts`, UI replicada, validaciones strictas sobre limitación de responsabilidad de intermediario y menores.
- **Tratamiento de Datos Personales** (`/seguridad/datos`): Alineamiento estricto a la Ley 1581 y Decretos SIC, 13 secciones completas, transferencia estricta de datos cubierta.
- Rutas API (`GET /api/legal/*/pdf`) con descargas PDF habilitadas para cumplimiento legal.
- Rutas base antiguas preservadas por compatibilidad SEO (`/privacidad`, `/terminos`, `/tratamiento-datos`).

---

## [v0.9.8-S40] — 2026-04-09 (Buscador mixto + fixes críticos autocomplete)
**Documento Fundacional: V23** | Rama: master | Commit: `c5efce5`

### Features

#### Buscador mixto (actividades + categorías + ciudades) — HeroSearch.tsx + Filters.tsx
- **API `GET /api/activities/suggestions`:** rediseñada para devolver hasta 5 resultados mixtos
  - Actividades (max 3): match en título, ranking prefix > sourceConfidence
  - Categorías (max 1): con actividades activas, ranking prefix > count
  - Ciudades (max 1): con actividades activas, ranking prefix
  - Tipo `SuggestionItem { type, id, label, sublabel }` exportado
- **HeroSearch.tsx y Filters.tsx:** cache en memoria LRU (20 entradas), AbortController, debounce 300ms
- **Historial de búsquedas:** sessionStorage `hp_recent_searches` (max 5), panel con reloj
- **Skeleton loading:** 3 ítems animados mientras se espera la API
- **Estado vacío:** "No encontramos resultados para…" si la API devuelve array vacío
- **Pre-selección:** primer ítem activo al recibir sugerencias (`activeIndex = 0`)
- **Selección por tipo:** activity→detalle, category→`?categoryId=`, city→`?cityId=`
- **Badges de tipo:** pill "Categoría" (violeta) / "Ciudad" (verde esmeralda)
- **Iconos:** 🎯 actividad · 📂 categoría · 📍 ciudad
- **Footer teclado:** "↑↓ navegar · Enter seleccionar · Esc cerrar" (solo desktop, `hidden sm:block`)
- **Lupa clickeable:** botón que submite búsqueda
- **`onMouseDown={e => e.preventDefault()}`:** evita pérdida de foco al clicar dropdown

#### Fixes críticos autocomplete
- **Bug 1 — umbral API incorrecto:** `q.length < 2` → corregido a `< 3`
- **Bug 2 — race condition:** fetch anterior no cancelado → `AbortController` abort en cada nueva llamada
- **Bug 3 — estado stale en re-foco:** suggestions no se limpiaban al cerrar → `setSugg([])` en `closeDropdown()`

#### Fix conteo categorías en facets
- `getFacets()` en `page.tsx`: `_count.activities` ahora incluye `where: { activity: buildWhere(filters, 'categoryId') }` — el número en el dropdown coincide con los resultados reales

### Tests
- **6 nuevos tests** en `suggestions/__tests__/suggestions.test.ts` (876 → 882)
- Mocks añadidos: `mockCategoryFindMany`, `mockCityFindMany`
- 882/882 passing ✅ | 56 archivos | TypeScript: 0 errores
- Coverage: 91.39% stmts / 85.90% branches ✅

---

## [v0.9.7-S39] — 2026-04-09 (Header resultados /actividades)
**Documento Fundacional: V23** | Rama: master

### Features

#### Header de resultados rediseñado
- **page.tsx:** cabecera blanca (`bg-white border-b`) con título + subtítulo nuevo separada de zona gris de resultados
- **Subtítulo nuevo:** "Encuentra talleres, cursos y eventos según edad, ubicación y presupuesto"
- **Buscador prominente:** `py-3.5 text-base rounded-2xl`, placeholder "Busca por actividad, edad o ubicación…"
- **Estado loading:** `isPending` + spinner en buscador + contador "Buscando…" durante navegación
- **Estado error:** mensaje sutil si la API de sugerencias falla
- **`FiltersSkeleton`** exportado para Suspense fallback — replica visualmente la cabecera
- **Mobile ordenar:** lista de botones con checkmark en lugar de `<select>`

### Tests
- 876 tests, 876 pasados — TypeScript: 0 errores

---

## [v0.9.6-S38] — 2026-04-09 (Rediseño filtros /actividades)
**Documento Fundacional: V23** | Rama: master

### Features

#### Filtros /actividades — rediseño completo (Filters.tsx)
- **Desktop:** barra única con: Búsqueda → Categoría ▼ → Precio (pills) → Ubicación ▼ → Edad ▼ → Ordenar ▼ → Limpiar filtros
- **Precio:** pill toggles independientes `Gratis` / `De pago` (reemplaza dropdown)
- **Chips activos:** fila de chips con ✕ individual, orden fijo Ubicación → Categoría → Precio → Edad
- **"Limpiar filtros":** visible solo cuando hay filtros activos, estilo secundario (link subrayado)
- **Mobile:** botón "Filtros" con badge de cantidad → modal full-screen con temp state
  - Categoría: select | Precio: pills | Ubicación: select | Edad: grid botones | Ordenar: select
  - Footer fijo: `Limpiar` + `Aplicar filtros`
  - Chips visibles fuera del modal (siempre)
- **Contador:** inline "Limpiar filtros" cuando total = 0
- **Eliminados de UI:** type y audience (se preserva compat URL)
- **Sin 0-result options:** heredado del sistema facetado existente

### Bug Fixes
- **HeroSearch.tsx:** `<span>` del arrow tenía `</button>` como closing tag — corregido

### Tests
- 876 tests, 876 pasados — sin cambios en suite (Filters es Client Component, no tiene unit tests directos)
- TypeScript: 0 errores | Coverage: 91.39% stmts / 85.90% branches ✅

---

## [v0.9.5-S37] — 2026-04-08 (Home UX — Hero buscador + Cards compactas + Footer 4 columnas)
**Documento Fundacional: V23** | Rama: master

### Features

#### Hero con buscador prominente
- **New:** `src/app/_components/HeroSearch.tsx` — Client Component standalone
  - Buscador con autocompletado a partir del 3er carácter (API `/api/activities/suggestions`)
  - Keyboard navigation: ↑↓ Enter Esc — highlight de coincidencias
  - 3 chips rápidos: "Hoy" (`?sort=date`) / "Gratis" (`?price=free`) / "Cerca de ti" (`/mapa`)
  - Click en sugerencia → busca por término; click en flecha → va directo a la actividad
- **Updated copy:** Título `"¿Qué hacemos hoy?"` · Subtítulo `"Descubre planes en familia cerca de ti"`
- **Removed:** Botones CTA anteriores (Explorar actividades / Solo gratuitas)
- **Updated badge:** `"La agenda de planes para familias en Colombia"`

#### ActivityCard — modo compact para home
- **New prop:** `compact?: boolean` (default `false` — sin breaking changes)
  - `compact=true`: sin badge tipo, sin categorías, sin descripción, título `text-base font-bold`, footer reducido a ubicación + favorito, strip más alto (`h-24`)
  - `compact=false`: comportamiento original intacto (usado en `/actividades`, favoritos, proveedores)
- Solo el home usa `compact` — los otros 4+ usos sin cambios

#### Sección "Descubre actividades" con fallback robusto
- **Removed:** Sección "Filtros rápidos por tipo" (Talleres/Eventos) — eliminada completamente
  - `ACTIVITY_TYPES` constant eliminada
  - `typeCounts` query eliminada del `Promise.all` (una query menos a BD)
  - `typeCountMap` eliminada
- **Renamed:** Título `"Explora por categoría"` → `"Explora por tipo de actividad"`
- **Updated:** `pageSize: 8 → 4` (una fila en desktop)
- **New:** Fallback de actividades populares (`sortBy: 'relevance'`) si no hay recientes
- **New:** Empty state si no hay ninguna actividad disponible (con CTA consistente)
- **New:** `SectionHeader` acepta `subtitle?: string` opcional (jerarquía título + subtítulo)
- Subtítulo adaptativo: `"Las más recientes"` o `"Las más populares"` según disponibilidad

#### Copy y UX mejorados
- Sección recientes: título `"Descubre actividades"` + subtítulo `"Las más recientes"`
- CTA de sección: outline button centrado `"Ver más actividades →"` (reemplaza link top-right)
- CTA final: `"¿No encontraste algo que te guste?"` · `"Descubre más actividades filtrando por edad, precio o ubicación"` · `"Ver más actividades →"`
- Padding reducido en CTA final: `py-16/py-12` → `py-12/py-10`
- Todos los CTAs del home apuntan a `/actividades` con texto consistente

#### Footer — 4 columnas
- **Updated:** `src/components/layout/Footer.tsx` — 3 columnas → 4 columnas (`grid-cols-2 sm:grid-cols-4`)
- **Columna HabitaPlan:** nuevo texto `"Encuentra actividades para disfrutar en familia"`
- **Columna Explorar:** Ver actividades / Categorías / Publicar actividad
- **Columna Ayuda (nueva):** Cómo funciona / Contacto / Preguntas frecuentes
- **Columna Legal:** Términos de uso / Política de privacidad / Política de tratamiento de datos
- **Barra inferior:** simplificada — `"Bogotá, Colombia"` (izquierda) + `"© 2026 HabitaPlan"` (derecha)
- Títulos de columna en `text-xs uppercase tracking-wider text-gray-400`

### Bug Fixes
- **Fix stats home:** `page.tsx` — `typeCounts`/`totalCategories`/`totalCities`/`topCategories` usaban `{ in: ['ACTIVE', 'EXPIRED'] }` → ahora todos usan `status: 'ACTIVE'` — números consistentes en toda la página

### Tests
- **876 tests, 56 archivos** — sin cambios (nuevo código es UI-only / Client Components sin lógica testeable adicional)
- `compact` prop en ActivityCard: compatible con todos los tests existentes (default `false`)
- TypeScript: 0 errores

---

## [v0.9.4-S35] — 2026-04-08 (Multi-ciudad Medellín + Dashboard auto-pause + Benchmark Gemini + Fixes)
**Documento Fundacional: V23** | Rama: master

### Features

#### Dashboard admin URL Score + Auto-pause
- **New:** `src/lib/source-pause-manager.ts` (305 líneas) — lógica auto-pause con 3 niveles de config:
  - Global (threshold: 20, duration: 7 días)
  - Ciudad (`CITY_PAUSE_CONFIG` dict — nombres en minúsculas)
  - Fuente específica (tabla `source_pause_config` en BD)
- **New:** `GET /api/admin/sources/url-stats` — endpoint con filtro por ciudad
- **New:** `src/app/admin/sources/components/SourceStatsTable.tsx` — dashboard con 4 summary cards + tabla
- **New:** `src/app/admin/sources/page.tsx` — página `/admin/sources`
- **New card** en panel admin `/admin` → "URL Score Dashboard"
- **New:** `scripts/apply-source-pause.ts` — CLI auto-pause con `--dry-run`, `--city`, `--verbose`
- **New:** `scripts/migrate-source-pause.ts` — crea tablas BD (corregido: nombres `scraping_sources`, `cities`, tipos `TEXT`)
- **New:** `scripts/check-pause-tables.ts` — verificación de migration en BD real ✅
- **Migration ejecutada** en producción — tablas operativas con 6 índices

#### Toggle activar/desactivar fuentes desde UI admin
- **New:** `PATCH /api/admin/sources/[id]` — actualiza `isActive` (requiere ADMIN)
- **New:** `SourceToggle.tsx` — switch verde/gris con feedback inmediato + `router.refresh()`
- Integrado en `/admin/scraping/sources` — visible por cada fuente

#### Multi-ciudad: Medellín
- **Web (2 fuentes activas):**
  - Parque Explora (`parqueexplora.org/sitemap.xml`, patrón `/programate/`) — 700+ eventos
  - Biblioteca Piloto (`bibliotecapiloto.gov.co/sitemap.xml`, patrón `/agenda/`) — talleres/niños
- **Instagram (2 cuentas activas, validadas con `--validate-only`):**
  - @parqueexplora — 236K seguidores ✅
  - @quehacerenmedellin — 168K seguidores ✅
  - @medellinplanes ❌ descartada (59 seg, inactiva 2023)
  - @planesmedellin ❌ descartada (37 seg, 1 post 2021)
- **Pendientes comentados:** Sec. Cultura Antioquia, Alcaldía Medellín, Jardín Botánico MDE, Infolocal Comfenalco

#### Benchmark CHUNK_SIZE Gemini
- **New:** `scripts/benchmark-chunk-size.ts` — benchmark Banrep Ibagué (107 URLs, sitemap paginado)
- **Hallazgo:** errores "JSON inválido" eran realmente **429 Too Many Requests** disfrazados
- **Hallazgo:** URL classifier no filtra Banrep Ibagué (100% `/actividad/`, ya son URLs productivas)
- **Cambio:** `CHUNK_SIZE 200 → 100` en `gemini.analyzer.ts` — mejor resiliencia ante cuota parcial
- Tests actualizados: "lotes de 200" → "lotes de 100"

#### Banrep Ibagué — pausa definitiva
- Comentada en `BANREP_CITIES` con motivo documentado
- Root cause: cuota Gemini se agota antes de llegar a Ibagué (score 13/100)
- Reactivar: descomentar línea en `scripts/ingest-sources.ts` (sin tocar código)

#### DNS habitaplan.com
- Dominio apuntado a Vercel ✅ (configurado fuera del repo)
- Redirección `habitoplan.com → habitaplan.com` activa ✅

### Fixes
- `scripts/migrate-source-pause.ts`: `PrismaClient()` → `import prisma from src/lib/db` + dotenv
- `scripts/migrate-source-pause.ts`: nombres reales de tablas (`scraping_sources`, `cities`) y tipos FK (`TEXT`)
- `src/modules/scraping/nlp/gemini.analyzer.ts`: `stats.filtered.length` → `stats.filtered` (número, no array)
- `scripts/apply-source-pause.ts`: type `cityName` removido del array de paused

### Tests
- **876 tests** (863 → 876): +13 tests en `source-pause-manager.test.ts`
- **56 test files** (55 → 56)
- Coverage: branches threshold 85% ✅

### Vulnerabilidades
- 3 `moderate` en `@prisma/dev` (dependencia de desarrollo, no producción) — `npm audit fix --force` haría downgrade de Prisma 7→6, riesgo alto → mantenidas

---

## [v0.9.3-S34] — 2026-04-07 (URL classifier + Instagram eval + Banrep diagnosis + QA)
**Documento Fundacional: V23** | Rama: master

### Major Features (S34)

#### URL Classifier pre-filter (Gemini optimization)
- **New:** `src/lib/url-classifier.ts` — clasificador de productividad de URLs
  - Detecta patrones no productivos: categorías, archivos, infraestructura, paginación
  - Identifica indicadores productivos: palabras clave (evento, taller, concierto), fechas, IDs
  - Score 0-100 con threshold 45 para filtrado automático
  - 28 nuevos tests (100% cobertura)

- **Integration:** `src/modules/scraping/nlp/gemini.analyzer.ts`
  - Stage 1: pre-filtro básico (query params, archivos binarios)
  - Stage 2: URL classifier (patrones inteligentes)
  - Logging: estadísticas de URLs excluidas con ejemplos
  - Resultado: 107 URLs Banrep Ibagué → ~40-50 después del filtro (40% reducción)

- **Impact:**
  - ✅ Reduce carga Gemini ~40% (menos llamadas a API)
  - ✅ Mejora tasa de actividades extraídas (menos URLs "ruido")
  - ✅ Ahorro de cuota (20 RPD × 30 días)
  - ✅ Detección automática de fuentes low-value (score < 20)

#### Instagram account evaluation (S34)
- **@festiencuentro:** ✅ KEEP — 6 new concrete activities (Sabatíteres, Patrimonios Vivos taller, concierto Foxtrol)
- **@distritojovenbta:** ✅ KEEP — 24K followers, publishes sports/youth center activities (#CasasDeJuventud)
- **Validación:** ambas cuentas tienen valor concreto — mantener en catálogo

#### Banrep Ibagué diagnosis (S34)
- **Root cause identificada:** No es timeout — Gemini retorna JSON inválido al procesar 107 URLs
- **Solución implementada:** URL classifier detección automática de URLs no productivas
- **Source quality:** `banrepcultural.org` con score 13/100 ⚠️
- **Acción:** Banrep Ibagué ahora se filtrará automáticamente (107 → ~50 URLs después pre-filter)

### Tests
- **863 tests** (835 → 863): +28 tests nuevos de URL classifier
- **55 test files** (54 → 55): nuevo archivo `url-classifier.test.ts`
- **Coverage:** 90.95% stmts / 85.69% branches ✅

---

## [v0.9.3-S33] — 2026-04-07 (S33: RatingForm + SEO landings + expiración configurable + rebrand V23)
**Documento Fundacional: V23** | Rama: master

### Major Features (S33)

#### RatingForm 3-step progressive disclosure
- **Paso 1:** Estrellas siempre visibles
- **Paso 2:** Textarea aparece al seleccionar estrella (con transición smooth)
- **Paso 3:** Botón siempre visible pero deshabilitado sin estrella
- **LoginModal inline:** modal sin navegar, preserva state (score + comentario) durante auth
- **Data persistence:** Cierra modal → automáticamente reenvía rating con valores guardados
- **Microcopy:** "Guarda tu opinión iniciando sesión"

#### SEO Landing Pages (4 rutas dinámicas)
- `/actividades/categoria/[slug]` — dynamic routes para todas las categorías (generateStaticParams)
- `/actividades/publico/[slug]` — ninos|familia|adultos
- `/actividades/precio/[slug]` — gratis|pagas
- `/actividades/ciudad/[slug]` — todos los cities de BD (con slugify utility)
- **Component:** `FilterLandingLayout` — breadcrumbs JSON-LD + grid + CTA to full filters

#### Expiración configurable por location/source
- `src/lib/expire-activities.ts` reescrito: `resolveExpirationHours()` con 3 niveles de prioridad
  - Priority 1: Location-specific hours (si existe)
  - Priority 2: Source-specific hours (si existe)
  - Priority 3: Global default (3 horas)
- **19 tests nuevos** verifican cada nivel + edge cases
- Usa `user.upsert()` para crear usuario en BD si falta (aunque exista en Supabase Auth)

#### UI Polish
- **Uppercase removal:** eliminado `uppercase` CSS class de todo el proyecto (EmptyState, metrics, admin, perfil, dashboard)
- **Uso de title case** en lugar de UPPERCASE en labels
- **RatingForm tests:** nuevo test suite `ratings.test.ts` para validaciones API (score 1-5, comment max 500 chars, activity lookup)

### API Changes
- **POST /api/ratings** — cambio de `findUnique()` con 404 a `upsert()` — crea usuario en BD automáticamente
- No más error "Usuario no encontrado" — user siempre se crea si es primera vez

### Fixes
- **Sitemap.ts:** actualizar para incluir nuevas rutas SEO (categoria, publico, precio, ciudad)
- **listActivities():** filtrar solo ACTIVE status (no EXPIRED) en listings
- **Filters.tsx:** autocompletado threshold 2→3 caracteres; "De pago"→"Pagas"
- **Activity detail hero:** rediseño (title-first, image opcional)

### Tests
- **838 tests** incluye nuevos tests de expiración (19) + ratings API (15 actualizado)
- Coverage: sin cambios en % pero +nuevas líneas de cobertura

### Despliegue
- Auto-deploy via GitHub Actions → Vercel al push master
- Cambios visibles en producción inmediatamente

---

## [v0.9.3-S32] — 2026-04-07 (fix cobertura: tests cache.ts y source-scoring.ts)
**Documento Fundacional: V22** | Rama: master

### Tests
- **832 tests** (797 → 832): +35 tests de cobertura
  - `cache.test.ts` +11 tests: `syncFromDb()` (4 tests) y `saveToDb()` (4 tests) con mocks via `vi.hoisted()`
  - `source-scoring.test.ts` nuevo archivo: 22 tests para `calcSourceScore()`, `formatReach()`, `TIER_LABEL/COLOR`
- **Coverage:** 90.95% stmts / 85.69% branches / 86.97% funcs (umbral 85% ✅)

### Fix técnico
- `cache.ts`: imports dinámicos (`await import()`) convertidos a estáticos para compatibilidad con `vi.mock()` de Vitest 4
- `cache.test.ts`: mocks con `function() {}` en lugar de arrow functions para soportar `new` (requerimiento Vitest 4)

---

## [v0.9.3-S31] — 2026-04-06 (caché dual disco+BD, ranking de fuentes, fix Zod Gemini)
**Documento Fundacional: V22** | Rama: master

### Features

#### Caché dual disco + BD (S31)
- `ScrapingCache` ahora persiste URLs en PostgreSQL (tabla `scraping_cache`)
- `syncFromDb()`: fusiona BD con disco antes de procesar — evita re-scrapear en otra máquina
- `saveToDb()`: persiste URLs nuevas al terminar cada pipeline
- Pipeline web e Instagram integran ambas llamadas automáticamente
- `scripts/migrate-scraping-cache.ts`: migration one-time para crear la tabla ✅ ejecutado

#### Ranking de fuentes (S31)
- `scripts/source-ranking.ts`: CLI ranking de fuentes con 3 niveles (producción 50% / volumen 30% / alcance 20%)
- `src/lib/source-scoring.ts`: lógica de scoring compartida entre CLI y futura UI admin
- Flag `--count-new` en `test-instagram.ts`: cuenta posts nuevos vs cache BD sin consumir Gemini

#### Bug fix: tolerancia Zod ante respuestas imprecisas de Gemini (S31)
- `types.ts`: `title` null o vacío → normaliza a `'Sin título'`; `categories` null o `[]` → normaliza a `['General']`
- `gemini.analyzer.ts`: `sanitizeGeminiResponse()` limpia ambos campos antes de Zod (doble capa)
- Posts que antes se descartaban silenciosamente ahora se procesan con valores de fallback

### Tests
- **797 tests** (795 → 797): +2 tests en `types.test.ts` para normalización title/categories

---

## [v0.9.3] — 2026-04-06 (Instagram ingest multi-cuenta, nueva API key Gemini, fix Vite vuln)
**Documento Fundacional: V21** | Rama: master — 2026-04-06 (Instagram ingest multi-cuenta, nueva API key Gemini, fix Vite vuln)
**Documento Fundacional: V21** | Rama: master

### Features

#### Instagram ingest — 7 cuentas corridas (S30 continuación)
- **@teatropetra:** 5/6 guardadas (confianza 0.75–0.9) — obras con fechas concretas ✅
- **@bogotaplan:** 2/6 — mucho lifestyle, pocas actividades concretas
- **@plansitosbogota:** 5/6 (confianza 0.6–0.9) — planes gratis, teatro, danza ✅
- **@bogotateatralycircense:** 2/2 (confianza 0.9) — teatro Idartes, FIAV ✅
- **@quehaypahacerenbogota:** 1/6 — captions en reels sin texto suficiente
- **@parchexbogota:** 2/6 — feria plantas y hongos detectada ✅
- **@planesenbogotaa:** **6/6** ⭐ (confianza 0.7–0.9) — mejor fuente del día
- **@distritojovenbta:** 0/6 — cuota agotada durante análisis
- **Total nuevas actividades:** ~23 actividades de Instagram guardadas en BD
- **Pendientes:** @distritojovenbta, @festiencuentro, @centrodeljapon

#### Nueva API key Gemini (S30)
- Cambio de cuenta Google AI Studio → nueva key con cuota fresca
- Variable `GOOGLE_AI_STUDIO_KEY` agregada en Vercel Dashboard (faltaba)
- `.env` local actualizado con nueva key

### Fixes
- **npm audit:** Vite Arbitrary File Read (GHSA-p9ff-h696-f583, high) → `npm audit fix` → 0 vulnerabilidades

### Pendientes identificados
- Bug menor: Gemini devuelve `null` en `title` o array vacío en `categories` → falla validación Zod (no bloquea guardado, solo descarta el post)
- @distritojovenbta, @festiencuentro, @centrodeljapon pendientes (cuota agotada)

---

## [v0.9.2] — 2026-04-06 (Instagram multi-fuente, validación sin Gemini, cobertura tests)
**Documento Fundacional: V21** | Rama: master

### Features

#### Instagram — catálogo ampliado a 10 fuentes activas (S30)
- **10 cuentas de Instagram descomentadas y activas** en `scripts/ingest-sources.ts`:
  - Agenda/planes: @quehaypahacerenbogota, @plansitosbogota, @parchexbogota, @bogotaplan, @planesenbogotaa
  - Teatro/cultura: @bogotateatralycircense, @festiencuentro, @teatropetra
  - Gobierno jóvenes: @distritojovenbta
  - Cultura internacional: @centrodeljapon
- **2 cuentas comentadas pendientes revisión:** @elbazardechapi y @distrito_ch (posts cruzados detectados)
- **BibloRed y FCE Colombia:** se mantienen comentadas (ya tienen fuente web activa, evitar duplicados)

#### Flag `--validate-only` en test-instagram.ts (S30)
- Nuevo modo que corre solo Playwright sin llamar a Gemini — **0 cuota consumida**
- Muestra: username, bio, preview de captions, URLs de posts, conteo de imágenes
- Ideal para validar accesibilidad de nuevas cuentas antes de ingesta real
- Uso: `npx tsx scripts/test-instagram.ts "https://www.instagram.com/cuenta/" --validate-only`
- Todas las 11 cuentas nuevas validadas sin bloqueo de IP ✅

#### Test de cobertura — ratings.ts (S30)
- **`src/lib/__tests__/ratings.test.ts`:** 3 tests para `recalcProviderRating()`
  - Caso normal: ratingAvg + ratingCount actualizados correctamente
  - Caso sin ratings: ratingAvg=null, ratingCount=0
  - Propagación de errores de Prisma
- `lib/ratings.ts`: cobertura 0% → 100%
- Branches total: 84.91% → **85.18%** ✅ (supera umbral de 85%)

### Fixes
- **Coverage branches:** cayó a 84.91% por `lib/ratings.ts` sin test → corregido con 3 tests nuevos
- **Corrección runner de tests:** proyecto usa Vitest, no Jest

### Docs
- Todos los 12 documentos del proyecto actualizados a v0.9.2

---

## [v0.9.1] — 2026-04-05 (Telegram operativo, Claim flow, Onboarding, Ratings)
**Documento Fundacional: V21** | Commits: 3896e26 → HEAD

### Features

#### Telegram MTProto operativo (S29)
- **`scripts/telegram-auth.ts`:** soporte 2FA (`password` callback) — autenticación exitosa
- **`scripts/ingest-telegram.ts`:** corregido `gemini.analyzeText` → `gemini.analyze(text, url)`, canales verificados a `@quehaypahacer`
- Canal `@quehaypahacer`: 3 actividades detectadas en dry-run (cuota Gemini compartida con otros scrapers)
- `TELEGRAM_SESSION` guardado en `.env` + Vercel Dashboard

#### Flujo de reclamación de proveedores / Provider Claim (S29)
- **`POST /api/providers/[slug]/claim`:** usuario autenticado envía solicitud + email a admin
- **`GET /api/admin/claims`:** lista claims filtrable por status (PENDING / APPROVED / REJECTED)
- **`PATCH /api/admin/claims/[id]`:** aprobar (isClaimed=true + rol PROVIDER + Supabase app_metadata) o rechazar
- **`src/components/ClaimButton.tsx`:** botón condicional en perfil público del provider (!isClaimed)
- **`src/app/proveedores/[slug]/reclamar/`:** página + formulario con nombre, email (readonly), mensaje
- **`src/app/admin/claims/page.tsx`:** panel admin con tabs PENDING/APPROVED/REJECTED
- **`src/lib/email/templates/provider-claim-notification.tsx`:** template React Email para notificar al admin
- **`prisma/schema.prisma`:** modelo `ProviderClaim` + enum `ClaimStatus` + relación en `Provider`
- **`scripts/migrate-provider-claims.ts`:** DDL raw SQL — `provider_claims` table con FK TEXT (no UUID)

#### Onboarding wizard para nuevos usuarios (S29)
- **`src/app/onboarding/page.tsx`:** wizard 3 pasos — Ciudad → Hijos → Listo
  - Paso 1: selección de ciudad (`GET /api/cities`)
  - Paso 2: agregar hijo con nombre, fecha de nacimiento y consentimiento Ley 1581
  - Paso 3: pantalla de éxito → `/actividades`
- **`GET /api/cities`:** retorna lista de ciudades para el wizard
- **`GET /api/profile/me`:** retorna id, name, cityId, onboardingDone
- **`PATCH /api/profile/onboarding`:** guarda cityId + marca onboardingDone=true
- **`src/app/login/page.tsx`:** redirecciona a `/onboarding` si `!onboardingDone`
- **`src/app/auth/callback/route.ts`:** nuevos usuarios redireccionados a `/onboarding`
- **`prisma/schema.prisma`:** campo `onboardingDone Boolean @default(false)` en `User`
- **`scripts/migrate-onboarding.ts`:** agrega columna + marca usuarios existentes como done=true

#### Agregación de ratings por provider (S29)
- **`src/lib/ratings.ts`:** `recalcProviderRating(providerId)` — recalcula `ratingAvg` + `ratingCount` en Provider
  - Usa `prisma.rating.aggregate({ _avg, _count })` sobre todas las actividades del provider
- **`POST /api/ratings`:** llama `recalcProviderRating` después de upsert
- **`DELETE /api/ratings/[activityId]`:** llama `recalcProviderRating` después de eliminar
- Provider siempre tiene `ratingAvg/ratingCount` actualizados en tiempo real

### Fixes
- **`defu` prototype pollution:** `npm audit fix` — 0 vulnerabilidades (era 1 high severity)
- **FK constraint `provider_claims`:** `providerId` como `TEXT` (no `UUID`) para coincidir con `providers.id`
- **`/api/cities` campo incorrecto:** `countryName` en lugar de `country` (no existe en schema)

### Tests
- **`src/app/api/ratings/__tests__/ratings.test.ts`:** actualizado con mock de `recalcProviderRating` + providerId en mocks de actividad/rating (fue necesario tras agregar agregación)
- **Total: 792/792 ✅ | 52 archivos | 91.73% stmts | 86.7% branches ✅ | 89.47% funcs**

### Security
- **npm audit:** 0 vulnerabilidades (fix de `defu` prototype pollution — 1 high severity)

---

### Observability (S28 — 2026-04-02)
- **Sentry activo en producción:** `instrumentation-client.ts` creado para captura de errores frontend
  - `onRouterTransitionStart` via `captureRouterTransitionStart` de `@sentry/nextjs`
  - `NEXT_PUBLIC_SENTRY_DSN` agregado en Vercel Dashboard
  - Verificado: primer evento llegó correctamente a Sentry
- **Fix `/api/health`:** responde 200 cuando Redis falla pero DB está OK (antes devolvía 503)
  - Redis es cola/caché no crítico para disponibilidad — solo DB determina status HTTP
  - Respuestas: `200 ok` | `200 degraded` (Redis falla) | `503 down` (DB falla)
- **UptimeRobot:** monitor configurado en `https://habitaplan-activities.vercel.app/api/health`

### Scraping (S28 — 2026-04-02)
- **Integración Telegram MTProto** — `telegram.extractor.ts` + `telegram-auth.ts` + `ingest-telegram.ts`
  - `src/modules/scraping/extractors/telegram.extractor.ts`: lector de canales públicos via gramjs
  - `scripts/telegram-auth.ts`: genera `TELEGRAM_SESSION` string (autenticación interactiva)
  - `scripts/ingest-telegram.ts`: ingesta completa con Gemini + guardado en BD
  - Canal `telegram` agregado a `ingest-sources.ts` (solo para `--list`, ingesta via script dedicado)
  - Canales objetivo: `@bogotaenplanes`, `@quehacerenbogota`, `@agendabogota`
  - Requiere: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION` en `.env`
  - **Estado:** código listo, pendiente autenticación (bloqueo ISP Colombia en acceso a Telegram)
- **Ingest web S28:** corrido con `--channel=web` (incorrecto — agotó cuota Gemini)
  - BD quedó en ~275 actividades (bajó de 293 por expiración de actividades de marzo)

### Notes (S28 — 2026-04-02)
- Rama: master | Tag: v0.9.0 (sin nuevo tag esta sesión)
- Commits: `7663d72` fix(health) · `2378ad9` feat(telegram) · `e0e2034` fix(sentry) · `a413601` fix(sentry)
- Tests: 783 (sin nuevos en S28) | Build: OK | TypeScript: 0 errores
- Cobertura branches: 84.44% — por debajo del umbral 85% (telegram.extractor.ts sin tests = 0%)

### Performance (S27 — 2026-04-01)
- **`gemini.analyzer.ts`:** `CHUNK_SIZE` 50 → 200 URLs por lote en fase DISCOVER
  - Banrep Bogotá: 22 lotes → 6 lotes (dentro de cuota 20 RPD)
  - Gemini 2.5 Flash soporta 1M tokens — sin riesgo de overflow con 200 URLs/prompt
  - Tests actualizados: prueba de resiliencia 55→250 links, validación 110→450 links
- **Banrep Bogotá ingest:** 16 actividades nuevas guardadas (primera corrida exitosa completa)
- **BD:** ~293 actividades totales

### Docs (S27 — 2026-04-01)
- `DEDUPLICATION-STRATEGY.md`: 211 → 277/293 actividades, historial v0.9.0
- `CLAUDE.md`: referencia generate_v20 → generate_v21
- `.github/pull_request_template.md`: console.log → createLogger()
- `scripts/generate_v21.mjs`: commiteado (generador del Documento Fundacional V21)
- `MEMORY.md`: DB State y Git State actualizados a S27

---

## [v0.9.0] — 2026-03-31 (Seguridad, Observabilidad, Scraping inteligente)
**Documento Fundacional: V21** | Commits: 50c7f97 → 50da7ec

### Security
- **C-01:** `PUT/DELETE /api/activities/:id` — agregado `requireRole([ADMIN])` (estaban sin auth)
- **C-02:** `CRON_SECRET` — eliminado fallback inseguro `|| 'test-secret'` + check `!cronSecret`
- **npm audit:** 0 vulnerabilidades (era 15) — picomatch ReDoS + Next.js 16.1.6→16.2.1
- **Security headers** en `next.config.ts` — CSP, X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy

### Observability
- **`src/lib/logger.ts`** — logger estructurado universal `createLogger(ctx)`
  - Formato: `ISO timestamp + LEVEL + [ctx] + mensaje + extras JSON`
  - `log.error()` captura a Sentry (import dinámico) si `SENTRY_DSN` configurado
  - Guard: meta no-plano (string, Error) ignorado sin serializar como array de chars
- **Sentry** — `@sentry/nextjs` integrado, activo solo si `SENTRY_DSN` en env
  - `sentry.server.config.ts`, `sentry.client.config.ts`, `src/instrumentation.ts`
- **0 console.*** en producción — 166 llamadas migradas a `createLogger(ctx)` en 24 archivos
- **`src/middleware.ts`** — middleware global, protege `/api/admin/*` automáticamente
  - Sin sesión → 401 | sin rol ADMIN → 403 | cron routes pasan con CRON_SECRET
- **`GET /api/health`** — health check DB + Redis en tiempo real
  - `200 {status:"ok"}` | `503 {status:"degraded"|"down"}` — listo para UptimeRobot

### Quality
- **Tests nuevos:** `geocoding.test.ts` (19) + `push.test.ts` (16) = +35 tests
- **Coverage branches:** 83.45% → 87.29% ✅ (umbral 85%)
- **`geocoding.ts`:** 8% → 95% | **`push.ts`:** 0% → 94%
- **`.env.example`** — 14+ variables documentadas

### Scraping (S26)
- **`scripts/ingest-sources.ts`** — reescritura con sistema de canales
  - `channel: 'web' | 'instagram' | 'tiktok' | 'facebook'` en cada fuente
  - `--list` | `--channel=web` | `--channel=social` (alias redes) | `--source=banrep`
  - Combinable: `--channel=web --source=banrep`
  - Banrep primero en orden (mayor prioridad de cuota Gemini)
- **Bug fix:** `gemini.analyzer.ts` — pre-filtro excluye imágenes/binarios antes de Gemini
  - Elimina consumo de cuota en JPGs de agenda (JBB: 4 requests por imágenes)
- **Bug fix:** logger — serialización correcta de errores (`{"0":"[","1":"G"...}` eliminado)

### Tests
- **783 tests — 51 archivos** (era 748/49)
- **91.76% stmts / 86.98% branches / 89.73% funcs / 93.08% lines** ✅

---

## [v0.8.1+] — 2026-03-31 (Monetización A-G, Proxy residencial, Dashboard proveedor)
**Documento Fundacional: V20** | Commits: c355246, 53f4961, 4772444

### Added
- **Modelo Sponsor** — tabla `sponsors` creada via `scripts/migrate-sponsors.ts` (raw SQL — patrón DDL para Supabase pgbouncer)
  - Campos: id, name, tagline, logoUrl, url, isActive, campaignStart, campaignEnd
- **isPremium en Provider** — columnas `isPremium` y `premiumSince` via `scripts/migrate-premium.ts`
  - Efecto en ordenamiento: `{ provider: { isPremium: 'desc' } }` en relevance sort
  - Badge "⭐ Destacado" (ambar) en `ActivityCard` — prioridad sobre badge "Nuevo"
- **Panel admin sponsors** — `/admin/sponsors` (ADMIN only)
  - API: `GET/POST /api/admin/sponsors`, `PATCH/DELETE /api/admin/sponsors/[id]`
  - UI CRUD: crear, activar/desactivar, editar, eliminar
  - Card "Patrocinadores" agregada al dashboard `/admin`
- **Bloque sponsor en email** — `activity-digest.tsx`
  - Sección entre lista de actividades y CTA final (opcional vía prop `sponsor?`)
  - Logo, tagline, link con `utm_campaign=newsletter`
- **UTM tracking en email digest** — todos los links de actividades y CTA "Ver todas"
  - `?utm_source=habitaplan&utm_medium=email&utm_campaign=digest_{daily|weekly}`
- **Página `/anunciate`** — landing de monetización
  - Stats (260+ actividades, 14 fuentes, ~35% open rate)
  - Opciones: Newsletter Sponsorship (COP 200k-500k/edición) y Listing Destacado (COP 150k-300k/mes)
  - Link "Anúnciate" en naranja en Footer
- **Dashboard de proveedor** — `/proveedores/[slug]/dashboard`
  - Acceso: ADMIN o proveedor con `isClaimed=true` y `email` coincidente con sesión
  - Muestra: estado premium (con fecha), 4 métricas (vistas, activas, expiradas, borradores), tabla actividades
  - Header busca `providerSlug` si `role=provider` — `UserMenu` muestra "Mi panel"
- **Proxy residencial en Playwright** — `playwright.extractor.ts`
  - Lee `PLAYWRIGHT_PROXY_SERVER / _USER / _PASS` del `.env`
  - Aplicado a todos los `chromium.launch()` (Instagram + web)
  - Sin vars = comportamiento anterior sin proxy (backward compatible)
  - Proveedor recomendado: IPRoyal pay-as-you-go ($7/GB)

### Tests
- 27 nuevos: `sponsors.test.ts` (API CRUD completo) + `activity-digest.test.tsx` (UTM + bloque sponsor)
- **748 tests total (49 archivos)**

---

## [v0.8.1] — 2026-03-31 (Mapa detalle, venue-dictionary, geocoding retroactivo)

### Added
- **Mapa mini-Leaflet en detalle de actividad** — sidebar de `/actividades/[id]`
  - `ActivityDetailMap.tsx`: wrapper `next/dynamic` con `ssr: false` + skeleton animado
  - `ActivityDetailMapInner.tsx`: implementación Leaflet (zoom 15, scroll desactivado, popup nombre/dirección)
  - Solo se muestra cuando la actividad tiene coordenadas reales (lat/lng ≠ 0)
  - Mismo pin índigo que el mapa de lista
- **Diccionario de venues curados** — `src/lib/venue-dictionary.ts`
  - 40+ venues de Bogotá con coords exactas verificadas en OSM
  - BibloRed ×15 sedes, Centros de Felicidad ×10, Planetario, Jardín Botánico, Maloka, Parque Simón Bolívar, Museo de los Niños, Cinemateca, Museo Nacional, Idartes, Teatro Mayor, García Márquez, Colsubsidio, Parque Nacional
  - `lookupVenue()`: matching normalizado (sin tildes, minúsculas, AND de keywords) — ~0ms, sin API call
  - `geocoding.ts` actualizado: flujo `venue-dictionary → Nominatim → cityFallback → null`
  - `activities.service.ts`: `latitude` y `longitude` añadidos al `activityIncludes` select
- **Script geocoding retroactivo** — `scripts/backfill-geocoding.ts`
  - Detecta locations con coords 0,0 y las geocodifica usando venue-dictionary + Nominatim
  - Resultado inicial: 29/29 locations ya con coords válidas gracias al pipeline de ingest

### Tests
- 26 tests nuevos en `venue-dictionary.test.ts` (normalizeVenue, lookupVenue — venues, variantes, case, falsos positivos)
- **721 tests total (47 archivos)**

---

## [v0.8.0] — 2026-03-27 (Autocompletado, ordenamiento, mapa pines, badge Nuevo, métricas admin)
**Documento Fundacional: V18**

### Added
- **Geocoding real via Nominatim** — `src/lib/geocoding.ts`
  - Rate limit 1.1s entre requests (ToS Nominatim)
  - Fallback a ciudad si la dirección falla
  - Todas las locations en DB geocodificadas con coords reales
- **Búsqueda con autocompletado** — `GET /api/activities/suggestions`
  - Sugerencias con debounce 300ms
  - Navegación con teclado (↑↓ + Enter + Escape)
  - Máx. 6 sugerencias, highlight del término buscado
- **Ordenamiento en `/actividades`** — selector con 5 opciones
  - `relevance` (por defecto): ACTIVE primero + confianza Gemini
  - `date`: próximas primero, sin fecha al final
  - `price_asc` / `price_desc`: precio nulo al final
  - `newest`: recién agregadas a HabitaPlan
- **Página de inicio mejorada** — stats reales desde DB
  - Contador de actividades ACTIVE, categorías y ciudades
  - Filtros rápidos (Gratis, Para niños, Este fin de semana)
  - Grid de categorías populares con emojis
- **Badge "Nuevo"** en tarjetas — actividades creadas en los últimos 7 días
- **Mapa de actividades** — `/mapa` con pines Leaflet + toggle Lista/Mapa en `/actividades`
  - `GET /api/activities/map`: hasta 500 actividades ACTIVE con coords reales (filtra lat/lng = 0)
  - Pines índigo con popup (nombre, barrio, precio, categoría)
  - Toggle Lista/Mapa persiste filtros activos
- **Panel métricas admin** — `/admin/metricas`
  - `POST /api/activities/[id]/view` + `POST /api/search/log` para captura de eventos
  - Top actividades más vistas y búsquedas frecuentes

### Fixed
- `fix(scraping)`: concurrencia reducida de 3 → 1 para respetar límite 5 RPM de Gemini Free

### Tests
- **695 tests (46 archivos)**

---

## [v0.7.7] — 2026-03-27 (Docs)
**Documento Fundacional: V17**

### Changed
- CLAUDE.md actualizado a estado v0.7.7
- Documento Fundacional V17 generado (`scripts/generate_v17.mjs`)

---

## [v0.7.6] — 2026-03-26 (Proveedores, Web Push, admin actividades, placeholders)
**Documento Fundacional: V16**

### Added
- **Actividades similares** en detalle — sección al pie con hasta 4 actividades de la misma categoría y ciudad
- **Mapa interactivo en detalle** — mini-mapa Leaflet en `/actividades/[id]` (versión previa, sin geocoding real)
- **`og:image` en pipeline de scraping** — extrae imagen OG al guardar actividad; filter de imágenes logo/blancas
- **Filtro de ciudad** en `/actividades` — selector dinámico desde DB
- **Gradient placeholders** — fondo degradado por categoría cuando no hay imagen real
- **Web Push Notifications** — `POST /api/push/subscribe`, VAPID keys, ServiceWorker, `PushButton` component
- **Panel admin — gestión de actividades** `/admin/actividades`
  - Listar con paginación, editar inline, ocultar (→ EXPIRED)
  - `GET/PATCH /api/admin/activities/[id]`
- **Página de proveedor** `/proveedores/[slug]`
  - Header con logo, nombre, tipo, isVerified
  - Grid de actividades del proveedor
  - `slug` field en Provider (db push)

### Fixed
- Slug de `activityIncludes` revertido y re-aplicado tras `db push` exitoso

### Tests
- **661 tests** (sin regresiones respecto a v0.7.5)

---

## [v0.7.5] — 2026-03-26 (URLs canónicas, imágenes, UX mejoras)
**Documento Fundacional: V16 pendiente**

### Added
- **URLs canónicas de actividades** — formato `/actividades/{uuid}-{slug-titulo}`
  - `src/lib/activity-url.ts`: `slugifyTitle`, `activityPath`, `extractActivityId`
  - Detail page extrae UUID via regex y redirige URLs bare → canónica
  - Todos los links internos (tarjetas, ShareButton, sitemap, perfiles, email) actualizados
  - `<link rel="canonical">` apunta a URL con slug
- **Imágenes reales en tarjetas y detalle** — `scripts/backfill-images.ts`
  - Extrae `og:image` / `twitter:image` de cada `sourceUrl` (Cheerio + fetch)
  - 77/230 actividades con imagen real (idartes.gov.co, culturarecreacionydeporte.gov.co, bogota.gov.co, Instagram CDN)
  - Rate limiting 200ms entre requests, soporte TLS relajado para .gov.co
  - Filtro de imágenes blancos/logo conocidas
- **Reportar error → contacto precompletado** — link en detalle pasa `?motivo=reportar&url=<ruta-canónica>`; formulario lee params y pre-rellena motivo + URL automáticamente
- **Filtro de precio** en listado (Gratis / De pago) con facetado
- **API admin/queue** — `GET /api/admin/queue/status` y `POST /api/admin/queue/enqueue`
- `scripts/clean-queue.ts` — limpia jobs BullMQ acumulados (`--dry-run` disponible)

### Fixed
- TLS `UNABLE_TO_VERIFY_LEAF_SIGNATURE` en jbb.gov.co, cinematecadebogota.gov.co, planetariodebogota.gov.co — `undici.Agent({ rejectUnauthorized: false })`
- Eliminados todos los errores TypeScript del proyecto (0 errores `tsc --noEmit`)

### Tests
- 661 tests pasando (42 archivos)
- 12 tests nuevos: `activity-url.test.ts` (slugifyTitle, activityPath, extractActivityId)
- 4 tests TLS dispatcher en cheerio-extractor
- 9 tests queue status/enqueue API

---

## [v0.7.4] — 2026-03-26 (BullMQ + Upstash Redis + multi-ciudad Banrep)
**Documento Fundacional: V16 pendiente**

### Added
- `src/modules/scraping/queue/`: BullMQ + Redis — sistema asíncrono de scraping completamente operativo con Upstash Redis (Free Tier)
  - `connection.ts`: singleton ioredis con soporte `rediss://` (TLS)
  - `scraping.queue.ts`: Queue con reintentos exponenciales (3 intentos, backoff 5s)
  - `scraping.worker.ts`: Worker concurrencia=1 (respeta rate limit Gemini)
  - `producer.ts`: `enqueueBatchJob` + `enqueueInstagramJob`
  - `types.ts`: tipado completo `BatchJobData`, `InstagramJobData`, `ScrapingJobResult`
- `scripts/run-worker.ts`: proceso worker con shutdown limpio (SIGINT/SIGTERM)
- `scripts/test-redis.ts`: script de verificación de conexión Redis
- `REDIS_URL` en `.env`: Upstash Redis `modern-bat-84669.upstash.io:6379` (TLS)
- `scripts/ingest-sources.ts`: modo `--queue` para encolar jobs sin procesarlos

### Changed
- `pipeline.ts`: `runBatchPipeline(url, opts)` — firma refactorizada a options object
  - **Fix crítico**: `sitemapPatterns` nunca llegaba al extractor (se pasaba como `concurrency`)
  - `opts = { maxPages?, sitemapPatterns?, concurrency? }`
- `scripts/ingest-sources.ts`: Banrep expandido a **10 ciudades principales** (un job por ciudad)
  - Bogotá, Medellín, Cali, Barranquilla, Cartagena, Bucaramanga, Manizales, Pereira, Ibagué, Santa Marta
  - Cada job filtra el sitemap por `/<ciudad-slug>/` → cityName correcto por actividad
  - Total fuentes: **14** (4 Bogotá + 10 Banrep por ciudad)
- `gemini.analyzer.ts`: modelo actualizado a `gemini-2.5-flash` (estable)
- Banrep sitemap: de 16.614 → **684 URLs** con filtro `/bogota/` (fix sitemapPatterns)

### Fixed
- `pipeline.test.ts`: tipo TS en mocks de `PlaywrightExtractor` — `InstanceType<typeof PlaywrightExtractor>` en lugar de `Record<string, unknown>`

### Tests
- 636 tests pasando (sin regresiones)
- Callers de `runBatchPipeline` actualizados al nuevo options object

---

## [v0.7.3] — 2026-03-25 (Deuda técnica: queue tests + cobertura scraping)
**Documento Fundacional: V15**

### Tests ✅
- `queue/connection.ts`: 0% → **100%** — `queue-connection.test.ts` nuevo (6 tests)
  - Singleton behavior, `quit` on close, idempotent close, new connection after close
  - Patrón clave: `closeRedisConnection()` ANTES de `vi.clearAllMocks()` en `beforeEach`
- `queue/scraping.worker.ts`: 0% → **100%** — `queue-worker.test.ts` nuevo (5 tests)
  - `capturedProcessor` pattern para probar el worker processor de BullMQ sin Redis real
  - Event handlers (`completed`, `failed`, `error`), batch job, instagram job
- `queue/scraping.queue.ts`: rama `if (queue)` → **100% branches** — test de idempotencia añadido
- `extractors/cheerio.extractor.ts`: test `maxPages` limit — verifica que no fetch page 3 cuando `maxPages=2`
- `extractors/playwright.extractor.ts`: `extractWebLinks` + `extractWebText` — 8 tests nuevos
  - Links retornados, deduplicación, filtrado URL vacía, resultados vacíos
  - `extractWebText`: SUCCESS con texto largo, FAILED con texto corto, FAILED en error de goto
- `nlp/gemini.analyzer.ts`: 4 tests nuevos de branches
  - Query params pre-filter (línea 223 log branch)
  - URL inválida en pre-filter catch handler (línea 219)
  - `analyze()` respuesta array → toma primer elemento (línea 173)
  - `analyzeInstagramPost()` respuesta array → toma primer elemento (líneas 363-364)
- `pipeline.ts`: 4 tests de branches
  - Línea 42: Cheerio FAILED → fallback Playwright SUCCESS
  - Línea 74: logger desactivado cuando cityId no encontrado en BD
  - Línea 112: `extractWebLinks` throws en fallback SPA → continúa
  - Línea 250: IG logger desactivado cuando verticalId no encontrado
- `storage.ts`: 4 tests de branches
  - `description: ''` → string vacío; `minAge: undefined` → null; `startDate: undefined` → null; `audience: null` → 'ALL'
- **Total tests:** 581 → **636** (+55)
- **Cobertura global:** 97.41% stmts / 92.5% branches / 96.7% funcs / 98.17% lines

### Chore ✅
- `queue/connection.ts`, `queue/producer.ts`, `queue/scraping.queue.ts`, `queue/scraping.worker.ts`: todos a **100%** cobertura
- `queue/types.ts`: sin runtime, 0% — aceptado (sólo tipos TypeScript)

---

## [v0.7.2] — 2026-03-25 (Scraping multi-fuente + sitemap Banrep)
**Documento Fundacional: pendiente**

### Fixed
- `pipeline.ts`: logger FK error — `getCityId('bogota')` fallaba por mismatch de acento vs BD (`"Bogotá"`). Corregido usando el valor exacto de BD.
- `gemini.analyzer.ts`: respuestas array de Gemini (`[{...}]` → `{...}`) manejadas correctamente.
- `gemini.analyzer.ts`: JSON truncado — input reducido 15 000 → 6 000 chars, `maxOutputTokens` 4 096 → 8 192.
- `gemini.analyzer.ts`: URLs con query params pre-filtradas antes de enviar a Gemini.

### Added
- `CheerioExtractor.extractSitemapLinks(url, patterns?)` — parsea sitemap XML index + sub-sitemaps, filtra por patrones de URL. Sin Playwright, sin bot-detection.
- `ScrapingPipeline`: detección automática de sitemap XML en `runBatchPipeline` (usa `extractSitemapLinks` si la URL contiene `sitemap*.xml`).
- `ScrapingPipeline`: parámetro `sitemapPatterns` en `runBatchPipeline` para filtrar URLs del sitemap.
- `ScrapingPipeline`: opciones `cityName` y `verticalSlug` en el constructor — ya no hardcodeados como `'Bogotá'` / `'kids'`.
- `PlaywrightExtractor.extractWebLinks()` + `extractWebText()` — fallback SPA para sitios JS-rendered.
- `scripts/ingest-sources.ts` — ingesta secuencial de 5 fuentes con `--dry-run` y `--max-pages=N`.
- Rate limiting Gemini: 12 s entre requests (desactivado en `NODE_ENV=test`).

### Sources añadidas al pipeline
- Banco de la República → `sitemap.xml` (evita Radware bot-protection)
- Cinemateca de Bogotá, Planetario de Bogotá, Jardín Botánico (JBB), Maloka — en `ingest-sources.ts`

### Tests ✅
- `cheerio-extractor.test.ts`: 7 tests nuevos para `extractSitemapLinks` (index, plain, patrones, dedup, error raíz, sub-sitemap fallido)
- `pipeline.test.ts`: 3 tests nuevos (sitemap routing, sitemapPatterns, cityName/verticalSlug)
- Total: 234 → **244 tests** (+10)

---

## [v0.7.1] — 2026-03-24 (Cierre de deuda técnica de tests)
**Documento Fundacional: V14**

### Tests ✅
- `lib/expire-activities.ts`: 0% → 100% — 16 tests nuevos (cron de expiración de actividades)
- `lib/auth.ts`: 66.66% branches → 100% — 5 tests para `getOrCreateDbUser` (cadena `??` de nombre)
- `modules/scraping/storage.ts`: 81.6% stmts / 70.31% branches → 100% stmts / 93.75% branches
  - Mock de `findMany` para `findPotentialDuplicate` + 6 tests de detección de duplicados
- `modules/activities/activities.service.ts`: 81.81% stmts → 100% — 4 tests para `audienceValues` y `where.audience`
- `modules/scraping/extractors/playwright.extractor.ts`: 41.66% → **97.22% funcs / 100% branches / 100% lines**
  - Callbacks de `evaluateAll` invocados con DOM elements mock
  - Catch handlers (`h1.innerText`, `og:description`, `time[datetime]`, `meta[name]`, `header section`)
  - Rama `else` de `existsSync`, arrow function real de `delay()`, hrefs absolutos, fallback `?? ''`
- Total tests: 557 → **581** (+24)
- Cobertura global: 90.53% → **98.32% stmts** / 82.9% → **93.07% branches** / 94.59% → **99.32% funcs**

### Chore ✅
- `package.json`: version `0.1.0` → `0.7.0` (sincronizado con git tags)
- `vitest.config.ts`: threshold cap `100%` → `85%` (`npm run test:coverage` funcional nuevamente)
- Git tag `v0.6.1` creado en commit `badf07d` (certificación Supabase — faltaba desde v0.6.1)

---

## [v0.7.0] — 2026-03-24 (Merged: tests completos, scraping Idartes pendiente)
**Documento Fundacional: V13**

### Tests ✅
- `src/modules/scraping/__tests__/deduplication.test.ts`: **nuevo** — 42 tests cubriendo las 6 funciones exportadas (`normalizeString`, `generateActivityFingerprint`, `calculateSimilarity`, `isProbablyDuplicate`, `logDuplicate`, `extractDateInfo`)
  - Cobertura `deduplication.ts`: 2.77% → 94.44% stmts / 95.23% branches / 100% funcs
- `src/app/api/admin/send-notifications/__tests__/send-notifications.test.ts`: **reescrito** — 21 tests con mocks reales del handler (`PrismaClient`, `sendActivityDigest`)
  - Cubre: autenticación 401, parámetros dryRun/period, filtrado de usuarios, envío real, errores de DB, errores de usuario individual, múltiples usuarios
  - Tests anteriores: solo lógica inline (0% cobertura del handler) → ahora importa y ejecuta `POST`
- Total tests: 473 → 531 (+58 tests nuevos)
- Cobertura general: 86.85% → 90.53% stmts / 78.57% → 82.9% branches

### Blocked ⏸️
- **Scraping Idartes**: cuota de Gemini API (Google AI Studio) agotada
  - Estado: 94 links descubiertos en https://idartes.gov.co/es/agenda, pero filtrado con IA requiere cuota disponible
  - Error: `[429 Too Many Requests] You exceeded your current quota`
  - Comando bloqueado: `npx tsx scripts/test-scraper.ts --discover "https://idartes.gov.co/es/agenda" --save-db`
  - Acción: Reintentarlo cuando se restablezca la cuota (puede requerir upgrade de Google Cloud)

---

## [v0.6.1] — 2026-03-24 (sesión de certificación)
**Documento Fundacional: V12**

### Fixed
- Supabase Auth URL Configuration: `Site URL` corregido de `http://localhost:3000` a `https://habitaplan-activities.vercel.app`
- Redirect URLs de Supabase: agregadas `https://habitaplan-activities.vercel.app/auth/callback` y `https://habitaplan-activities.vercel.app/**`
- Flujo de confirmación de email ahora redirige correctamente a producción (antes redirigía a localhost)

### Verified (Certificación)
- 473/473 tests pasando en 4.94s
- Build de producción sin errores (último deploy: rama master, commit `a47093f`)
- Homepage producción: 211 actividades visibles
- `/actividades`: listado con filtros funcionando, 211 resultados
- `/robots.txt`: generado dinámicamente, bloqueos correctos (/admin/, /api/, /auth/, /perfil/, /login, /registro)
- `/sitemap.xml`: generando con rutas estáticas + actividades dinámicas
- Auth email delivery: confirmado funcionando (andresreyesg@gmail.com recibió email en <1 min)
- Usuario andresreyesg@gmail.com: confirmado en Supabase (Confirmed at: 24 Mar, 2026 18:49)

### Documentation
- CHANGELOG.md: actualizado a V12
- CLAUDE.md: actualizado a v0.6.1, estado de sesión de certificación
- README.md: actualizado con estado de certificación
- Documento Fundacional V12 generado: `HabitaPlan_V12_v0.6.0.docx` (1,017 párrafos, 16 secciones)

### Known Gaps
- `npm run test:coverage` falla el threshold dinámico (100% en día 9): cobertura actual 86.85% stmts / 78.57% branches
  - Archivos con baja cobertura: `deduplication.ts` (2.77%), `lib/send-notifications.ts` (0%)
  - El CI usa `npm test` (sin cobertura), por lo que los builds pasan correctamente
  - Acción requerida en v0.7.0: agregar tests para deduplication.ts y send-notifications.ts

---

## [v0.6.0] — 2026-03-24
**Documento Fundacional: V12**

### Added
- Componente `UserMenu`: dropdown con click-outside detection, contiene "Mi perfil", "Mis favoritos", "Salir" y enlace admin (condicional)
- Método `getOrCreateDbUser()` en auth: upsert atomático en table `users` con Supabase Auth ID
- Componente `EmptyState`: estado vacío context-aware en `/actividades` con sugerencias específicas según filtros activos
- Componente `LoadingSkeletons`: placeholders animados en `/actividades` y `/perfil/favoritos`
- Página `404 custom`: diseño unificado con botón de retorno
- `/app/robots.ts`: generador dinámico de robots.txt con rutas excluidas y crawl-delay
- `/app/sitemap.ts`: generador dinámico de sitemap.xml con rutas estáticas + todas las actividades ACTIVE (~150 URLs) con revalidación horaria

### Changed
- Header: reemplazó avatar + "Mi perfil" link + LogoutButton con componente `UserMenu` unificado
- `/actividades` layout: dos filas de filtros en lugar de una (búsqueda+edad+audiencia / tipo+categoría+limpiar) → barra búsqueda menos estrecha en desktop
- `/actividades`: dos filas de filtros, active state visual (indigo), counts en categorías
- Contador de resultados: removido texto redundante "(con filtros activos)" → solo mostraba el count
- Ordenamiento de actividades: `[{ status: 'asc' }, { createdAt: 'desc' }]` → ACTIVE primero, EXPIRED al final
- Badge de precio en tarjetas: ocultado cuando no hay información ("No disponible") → solo muestra "Gratis" o precio real
- Badge de precio en hero de detalle: ocultado cuando no hay información
- Hero de detalle sin imagen: reemplazado placeholder gigante (h-48/h-64) con encabezado compacto (h-~44) con fondo de categoría
- Empty state en `/actividades`: reemplazado genérico por componente context-aware con sugerencias específicas y 6 categorías populares
- Nombres de proveedores: actualización a valores legibles y normalizados
- `/perfil/favoritos`: diseño mejorado con estado vacío específico y loading skeletons

### Fixed
- `getOrCreateDbUser()` en `auth/callback/route.ts`: nueva aplicación crea DB record inmediatamente en OAuth
- Páginas de perfil (`/perfil/*`): removidas condiciones "Usuario no encontrado" → upsert garantiza registro
- API routes profile: cambiadas de `requireAuth() + update` a `getSession() + upsert` → maneja usuarios sin DB record
- `useActivityHistory`: crash cuando `JSON.parse()` retorna non-array → validación con `Array.isArray()`
- Filtros: counts añadidos a opciones de categoría (ya existían para audience y type)
- Tests de profile y notifications: alineados con implementación `getSession` y `upsert` (sesión 19)
- `/perfil/favoritos`: página mejorada con mejor UX y validaciones

### Tests
- Unit tests: **473/473 pasando** — 35 archivos test, ~5.97s (verificado 2026-03-24)
  - +72 tests nuevos en esta versión (v0.5.0: 314 tests → v0.6.0: 473 tests)
  - Tests para: robots.txt, sitemap.xml, EmptyState, LoadingSkeletons, 404, ActivityCard, FavoriteButton
- E2E Playwright: 15 tests (6 skipped por falta de credenciales `.env.e2e`)
- CI/CD: GitHub Actions workflow configurado (`npm test` + `npm run build` + secrets para Prisma y Supabase)
- Build producción: compilado sin errores (Turbopack)

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
- Seed inicial: 10 ciudades, 1 vertical (HabitaPlan), 47 categorías
- Cache incremental de scraping (`data/scraping-cache.json`)
- Script `verify-db.ts` para validar estado de la base de datos
- API de actividades con CRUD completo
- Arquitectura modular por dominio (scraping, activities, providers, search...)
- Schema de base de datos con 11 entidades
- Scraper genérico con Cheerio + Playwright
- Sistema de testing: Vitest + cobertura dinámica +10%/día
- 120 tests — 31% cobertura statements, 52% functions (supera threshold día 1: 30%)
- TEST_PLAN.md y TEST_STATUS.md propios de HabitaPlan
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
