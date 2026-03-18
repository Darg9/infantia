# Infantia — Estado de Pruebas

Actualizado: 2026-03-18 | Version: v0.5.0

## Resumen

| Metrica | Valor |
|---------|-------|
| Archivos de test | 21 |
| Tests totales | 314 |
| Pasados | 314 |
| Fallidos | 0 |
| Threshold hoy (dia 3) | 50% |
| Statements | ~95% OK |
| Branch | ~88% OK |
| Functions | ~84% OK |
| Lines | ~96% OK |

## Estado: PASSED

> Nota: Todos los modulos lib/* y lib/supabase/* ahora tienen 100% de cobertura en lineas. Los gaps restantes (~4%) estan en playwright.extractor.ts (callbacks evaluateAll ejecutan en contexto de browser, no testeable con unit tests) y cheerio.extractor.ts (edge cases de paginacion).

## Detalle por archivo

### lib/__tests__/db.test.ts (4 tests) OK
- exports prisma instance, singleton pattern
- PrismaClient called, PrismaPg called with DATABASE_URL

### lib/__tests__/utils.test.ts (20 tests) OK
- cn(): une clases, ignora falsy, sin args, arg unico
- formatPrice(): COP, precio 0, USD, grandes
- calculateAge(): 10 anos exacto, cumpleanos manana, recien nacido, 5 anos
- slugify(): minusculas, acentos, espacios, guiones, especiales, texto ya slug, nombre Infantia

### lib/__tests__/validation.test.ts (13 tests) OK
- uuidSchema: valido, invalido, vacio, numero
- paginationSchema: defaults, conversion strings, page<1, page negativa, pageSize>100, pageSize=100, pageSize<1
- parsePagination(): page+skip, primera pagina, pagina 5 con size 20, sin params

### lib/__tests__/api-response.test.ts (9 tests) OK
- successResponse(): status 200, data correcta
- paginatedResponse(): incluye pagination meta
- errorResponse(): mensaje, status code, con detalles, sin detalles

### lib/__tests__/auth.test.ts (14 tests) OK
- getSession(): retorna usuario autenticado, retorna null sin sesion
- getSessionWithRole(): lee rol de app_metadata, default "parent", null sin user
- requireAuth(): retorna user si autenticado, redirige a /login si no
- requireRole(): valida ADMIN, rechaza rol insuficiente, redirige sin sesion
- Multiples roles (ADMIN o MODERATOR), rol desconocido tratado como PARENT

### lib/supabase/__tests__/client.test.ts (2 tests) OK
- Crea browser client con env vars (SUPABASE_URL, SUPABASE_ANON_KEY)
- Retorna singleton en segunda llamada

### lib/supabase/__tests__/server.test.ts (4 tests) OK
- Crea server client con createServerClient
- cookies.getAll delega a cookieStore
- cookies.setAll delega a cookieStore.set
- setAll catch silencioso para Server Components

### lib/supabase/__tests__/middleware.test.ts (5 tests) OK
- Crea client con createServerClient
- Retorna user y response
- Retorna null user cuando getUser falla
- cookies.getAll delega a request.cookies
- cookies.setAll actualiza request y response cookies

### scraping/__tests__/cache.test.ts (14 tests) OK
- has(): URL no vista, URL despues de add
- filterNew(): cache vacio, URLs vistas, todas vistas, input vacio
- size: inicio 0, incrementa, no duplica
- add(): sobreescribe titulo
- save(): writeFileSync llamado, JSON valido con URL
- load(): desde archivo existente, JSON invalido

### scraping/__tests__/types.test.ts (tests de tipos) OK
- activityNLPResultSchema, discoveredActivityUrlsSchema

### scraping/__tests__/storage.test.ts (20 tests) OK
- saveBatchResults(): vacio, sin data, confianza<0.2, confianza>=0.2
- Mezcla validos+omitidos, error sin vertical
- Upsert vs create, vinculacion categorias, WORKSHOP mapping
- disconnect(): $disconnect llamado
- saveActivity() casos adicionales: error catch (provider upsert fails), CAMP mapping, ONE_TIME mapping
- Instagram provider existente, Instagram provider nuevo (create)
- activityCategory upsert error silenciado
- Schedules como JSON con data, Prisma.JsonNull sin schedules
- Partial category match

### scraping/__tests__/logger.test.ts (10 tests) OK
- startRun(): crea log RUNNING, retorna id
- completeRun(): SUCCESS sin error, FAILED con error y 0 items, PARTIAL con error e items
- completeRun(): incluye metadata, incluye finishedAt como Date
- updateSourceStatus(): actualiza lastRunAt, lastRunStatus, lastRunItems
- getOrCreateSource(): retorna id existente, crea nuevo si no existe, busca por URL

### scraping/__tests__/cheerio-extractor.test.ts (15 tests) OK
- extract(): HTML exitoso, elimina nav/script/style/footer, extrae JSON-LD tipo Event, ignora JSON-LD no-Event
- Estado FAILED en error de red, en HTTP 4xx
- extractLinks(): filtra mismo dominio, excluye #anchors/mailto/javascript/tel
- Deduplicacion, ignora URL de listing, anchorText vacio: usa pathname
- extractLinksAllPages(): pagina unica (sin paginacion), multi-pagina con paginacion

### scraping/__tests__/playwright-extractor.test.ts (22 tests) OK
- extractProfile(): extrae username, bio, posts de Instagram
- Manejo de sesion con cookies (ig-session.json)
- Delay entre requests para evitar rate limiting
- Mock completo de Playwright browser/page/context
- extractFollowerCount: null sin meta, null sin patron, parsing "5K Followers", error getAttribute
- extractBio fallbacks: meta description, header section
- extractCaption: og:description con patron quotes, article spans fallback
- extractPostUrls: scroll para cargar mas posts
- extractImageUrls: deduplicacion
- extractLikesCount: null sin texto, null en error
- extractPost con URL string: crea y cierra page
- extractUsername: "unknown" para URLs no-Instagram

### scraping/__tests__/claude-analyzer.test.ts (11 tests) OK
- Sin API key: mockAnalysis sin llamar fetch
- Con API key: parsea JSON correctamente, limpia markdown fences
- Error de API, JSON invalido, schema Zod invalido
- Trunca texto a 15000 chars
- mockAnalysis: incluye URL en descripcion, discoverActivityLinks retorna todos los links

### scraping/__tests__/gemini-analyzer.test.ts (26 tests) OK
- Sin API key: mockAnalysis sin llamar a Gemini
- Con API key: parsea JSON, limpia markdown fences, confianza baja (<0.1): "No identificado"
- JSON invalido lanza error, schema invalido lanza error
- discoverActivityLinks: mapeo de indices, indices fuera de rango, lista vacia
- Error en un lote: continua con otros lotes, schema invalido: continua
- Procesa en lotes de 50 (110 links: 3 llamadas)
- callWithRetry: reintenta en 503, agota reintentos en 429 (3x), no reintenta en 400
- analyzeInstagramPost: parsea post IG con prompt especifico, extrae actividades de captions
- Error general catch en discoverActivityLinks (Network error)
- analyzeInstagramPost: Zod validation error, API error re-throw

### scraping/__tests__/pipeline.test.ts (30 tests) OK
- runPipeline(): exito con analisis, estado FAILED si extract falla, texto vacio
- runBatchPipeline(): 0 links, 0 filtrados por Gemini, todos en cache
- Procesamiento exitoso, error por URL (continua), saveToDb true/false
- Concurrencia: respeta CONCURRENCY_LIMIT
- runInstagramPipeline(): extraccion perfil, analisis posts secuencial, guardado en DB con confianza >= 0.3
- disconnect(): con y sin storage/playwright
- Logger integration (batch): startRun/completeRun, init error non-fatal, complete error non-fatal
- 0 links FAILED, 0 filtered SUCCESS, all cached SUCCESS
- Logger integration (Instagram): logger called, init/complete error non-fatal, all cached SUCCESS, errors PARTIAL

### activities/__tests__/schemas.test.ts (24 tests) OK
- listActivitiesSchema: defaults, conversiones, validaciones de rango
- audience: 4 valores válidos (KIDS/FAMILY/ADULTS/ALL), valor inválido falla
- ageMax hasta 120 (actividades para todas las edades)
- ageMin=0 no tratado como falsy en refine de validación
- createActivitySchema: audience con default ALL, ageMin=0/ageMax=100 válido
- updateActivitySchema: parcial, solo status

### activities/__tests__/service.test.ts (tests de servicio) OK
- listActivities(): 8+ escenarios de filtros y paginacion
- getActivityById(): busca por id, null si no existe, retorna actividad
- createActivity(): con/sin categoryIds, incluye sourceType
- updateActivity(): llama update, retorna actualizado, reemplaza categorias
- deleteActivity(): soft delete EXPIRED, no elimina fisicamente
- Filtros adicionales: priceMax only, type, categoryId
- createActivity/updateActivity con startDate/endDate (convierte a Date)

## Cobertura por modulo

| Archivo | Stmts | Branch | Funcs | Lines |
|---------|-------|--------|-------|-------|
| lib/api-response.ts | 100% | 100% | 100% | 100% |
| lib/auth.ts | 100% | 100% | 100% | 100% |
| lib/category-utils.ts | 100% | 100% | 100% | 100% |
| lib/db.ts | 100% | 75% | 100% | 100% |
| lib/utils.ts | 100% | 100% | 100% | 100% |
| lib/validation.ts | 100% | 100% | 100% | 100% |
| lib/supabase/client.ts | 100% | 100% | 100% | 100% |
| lib/supabase/middleware.ts | 100% | 100% | 100% | 100% |
| lib/supabase/server.ts | 100% | 100% | 100% | 100% |
| scraping/cache.ts | 100% | 100% | 100% | 100% |
| scraping/logger.ts | 100% | 100% | 100% | 100% |
| scraping/pipeline.ts | 99% | 87% | 100% | 100% |
| scraping/storage.ts | 100% | 90% | 100% | 100% |
| scraping/types.ts | 100% | 100% | 100% | 100% |
| scraping/cheerio.extractor.ts | 90% | 79% | 100% | 91% |
| scraping/playwright.extractor.ts | 79% | 76% | 42% | 84% |
| scraping/nlp/claude.analyzer.ts | 100% | 100% | 100% | 100% |
| scraping/nlp/gemini.analyzer.ts | 100% | 93% | 100% | 100% |
| activities/schemas.ts | 100% | 100% | 100% | 100% |
| activities/service.ts | 100% | 95% | 100% | 100% |
| **TOTAL** | **~95%** | **~88%** | **~84%** | **~96%** |

## Gaps de cobertura conocidos

### playwright.extractor.ts (~84% lines, 42% funcs)
Las funciones con cobertura baja son callbacks de `page.$$eval()` / `page.evaluate()` que ejecutan en el contexto del browser de Playwright. En unit tests, estos callbacks se mockean completamente (retornan valores predeterminados), por lo que el codigo dentro del callback nunca se ejecuta. Esto es una **limitacion fundamental** de los unit tests con mocks — para cubrir estas lineas se necesitarian integration tests con un browser real.

### cheerio.extractor.ts (~91% lines)
Faltan edge cases de paginacion: limite maxPages, estrategia ?page=N+1, y algunos branches de extractLinks con URLs edge case.

## Cambios respecto a v0.4.0

- **+20 tests** (294 → 314)
- **+1 archivo de test** (20 → 21): children.test.ts (parcial)
- **activities/schemas.ts**: +7 tests cubriendo audience, ageMax=120, ageMin=0 falsy-zero
- **Bug fixes verificados por tests**: audience en API, ageMax limit, refine falsy-zero
- **Bugs críticos corregidos sin tests nuevos**: NaN guard parseInt, Pagination disabled, type enum validation, children age calculation

## Cambios respecto a v0.3.0

- **+58 tests** (236 → 294)
- **+4 archivos de test** (16 → 20): db.test.ts, client.test.ts, server.test.ts, middleware.test.ts
- **lib/db.ts**: 0% → 100% lines (4 tests: singleton, PrismaClient, PrismaPg)
- **lib/supabase/client.ts**: 0% → 100% (2 tests: browser client singleton)
- **lib/supabase/server.ts**: 0% → 100% (4 tests: server client, cookie handlers)
- **lib/supabase/middleware.ts**: 0% → 100% (5 tests: updateSession, cookie delegation)
- **storage.ts**: 88% → 100% lines (+9 tests: error catch, type mappings, Instagram, JsonNull)
- **pipeline.ts**: 87% → 100% lines (+11 tests: logger integration batch + Instagram)
- **gemini.analyzer.ts**: 96% → 100% lines (+3 tests: error catch, Zod validation, API error)
- **playwright.extractor.ts**: 65% → 84% lines (+14 tests: private methods coverage)
- **service.ts**: branch coverage mejorado (+5 tests: filtros adicionales, date conversion)
- **Pattern critico**: `vi.hoisted()` requerido para todas las mock functions usadas en `vi.mock()` factories
