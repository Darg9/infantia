# Infantia — Plan de Pruebas

**Version:** v0.5.0
**Fecha:** 2026-03-18
**Framework:** Vitest + @vitest/coverage-v8
**Threshold:** +10% por dia desde 2026-03-16 (dia 1 = 30%, cap = 100%)

---

## Filosofia

Cada PR incluye codigo + tests + docs. El CI verifica cobertura en cada push.

---

## Thresholds dinamicos

| Dia | Fecha | Threshold |
|-----|-------|-----------|
| 1 | 2026-03-16 | 30% |
| 2 | 2026-03-17 | 40% |
| 3 | 2026-03-18 | 50% |
| 4 | 2026-03-19 | 60% |
| 5 | 2026-03-20 | 70% |
| 6 | 2026-03-21 | 80% |
| 7+ | 2026-03-22+ | 100% |

Calculado automaticamente en vitest.config.ts.

---

## Cobertura actual (v0.4.0)

| Modulo | Test | Stmts | Funcs | Lines | Estado |
|--------|------|-------|-------|-------|--------|
| lib/utils | utils.test.ts | 100% | 100% | 100% | OK |
| lib/validation | validation.test.ts | 100% | 100% | 100% | OK |
| lib/api-response | api-response.test.ts | 100% | 100% | 100% | OK |
| lib/category-utils | (cubierto en otros) | 100% | 100% | 100% | OK |
| lib/auth | auth.test.ts | 100% | 100% | 100% | OK |
| lib/db | db.test.ts | 100% | 100% | 100% | OK |
| lib/supabase/client | client.test.ts | 100% | 100% | 100% | OK |
| lib/supabase/middleware | middleware.test.ts | 100% | 100% | 100% | OK |
| lib/supabase/server | server.test.ts | 100% | 100% | 100% | OK |
| scraping/cache | cache.test.ts | 100% | 100% | 100% | OK |
| scraping/types | types.test.ts | 100% | 100% | 100% | OK |
| scraping/storage | storage.test.ts | 100% | 100% | 100% | OK |
| scraping/logger | logger.test.ts | 100% | 100% | 100% | OK |
| scraping/pipeline | pipeline.test.ts | 99% | 100% | 100% | OK |
| scraping/extractors/cheerio | cheerio-extractor.test.ts | 90% | 100% | 91% | OK |
| scraping/extractors/playwright | playwright-extractor.test.ts | 79% | 42% | 84% | PARCIAL |
| scraping/nlp/claude | claude-analyzer.test.ts | 100% | 100% | 100% | OK |
| scraping/nlp/gemini | gemini-analyzer.test.ts | 100% | 100% | 100% | OK |
| activities/schemas | schemas.test.ts | 100% | 100% | 100% | OK |
| activities/service | service.test.ts | 100% | 100% | 100% | OK |

**Total v0.5.0: ~95% statements / ~84% functions / ~96% lines (314 tests, 21 archivos)**

> Todos los modulos con logica de negocio tienen 100% cobertura en lines/funcs. Las brechas restantes son callbacks de `evaluateAll()` en Playwright (ejecutan en contexto del browser, no testables con mocks unitarios) y branches de paginacion en Cheerio.

---

## Escenarios cubiertos

### lib/utils (20 tests)
- cn(): clases, falsy, sin args
- formatPrice(): COP, 0, USD, grandes
- calculateAge(): exacto, cumpleanos manana, recien nacido
- slugify(): minusculas, acentos, espacios, especiales

### lib/validation (13 tests)
- uuidSchema: valido, invalido, vacio, numero
- paginationSchema: defaults, strings a numeros, limites
- parsePagination(): skip calculado, primera pagina

### lib/api-response (9 tests)
- successResponse(), paginatedResponse()
- errorResponse(): con detalles, sin detalles

### lib/auth (14 tests)
- getSession(): usuario autenticado, null sin sesion
- getSessionWithRole(): lee rol de app_metadata, default PARENT, null sin user
- requireAuth(): retorna user si autenticado, redirige si no
- requireRole(): valida ADMIN, rechaza rol insuficiente, multiples roles

### lib/db (4 tests)
- Singleton pattern, reutiliza instancia en globalThis
- Crea PrismaClient con PrismaPg adapter

### lib/supabase/client (2 tests)
- createSupabaseBrowserClient(): singleton, variables de entorno

### lib/supabase/middleware (5 tests)
- updateSession(): crea client, retorna user/response, cookies handlers, setAll

### lib/supabase/server (4 tests)
- createSupabaseServerClient(): client, cookies getAll/setAll, Server Component catch

### scraping/cache (14 tests)
- has/add/filterNew/size: todos los casos edge
- save(): writeFileSync, JSON valido
- load(): desde archivo, JSON invalido

### scraping/storage (21 tests)
- saveBatchResults(): vacio, sin data, baja confianza, alta confianza
- Mezcla validos/omitidos, error sin vertical
- Upsert vs create, vincular categorias, mapeo tipos (CAMP, WORKSHOP, ONE_TIME)
- Instagram provider (existente y nuevo), error catch, Prisma.JsonNull
- Partial match de categorias, activityCategory upsert error silencioso
- disconnect()

### scraping/cheerio-extractor (15 tests)
- extract(): exito, elimina nav/script/footer, JSON-LD Event vs no-Event
- FAILED en error de red, en HTTP 4xx
- extractLinks(): filtro mismo dominio, excluye anchors/mailto/javascript/tel
- Deduplicacion, ignora URL de listing, anchorText vacio
- extractLinksAllPages(): pagina unica, multi-pagina

### scraping/playwright-extractor (22 tests)
- extractProfile(): extrae username, bio, posts, maxPosts, errores individuales
- extractPost(): con URL string directo, cierra pagina
- extractUsername(): URL normal, URL sin patron Instagram
- launch()/close(): singleton, close sin abrir
- dismissLoginPopup(): visible e invisible
- extractFollowerCount(): null sin meta, null sin patron, parsea K, error
- extractBio(): og:description, meta name, header section fallback
- extractCaption(): h1, og:description con comillas, article spans fallback
- extractPostUrls(): scroll para cargar mas posts
- extractImageUrls(): deduplicacion
- extractLikesCount(): null sin texto, null en error

### scraping/nlp/claude-analyzer (11 tests)
- Sin API key: mockAnalysis (sin llamar fetch)
- Con API key: JSON valido, markdown cleanup, error API, JSON invalido, schema Zod invalido
- Trunca texto a 15000 chars

### scraping/nlp/gemini-analyzer (26 tests — 18 base + 8 Instagram)
- Sin API key: mockAnalysis (sin llamar Gemini)
- Con API key: JSON valido, markdown cleanup, confianza baja
- JSON invalido lanza error, schema invalido lanza error
- discoverActivityLinks: mapeo indices, fuera de rango, lista vacia, error general
- Lotes de 50 (110 links: 3 llamadas), fallo de lote: continua, schema invalido: continua
- callWithRetry: 503 reintenta, 429 agota (3x), 400 no reintenta
- analyzeInstagramPost: parsea post IG, prompt especifico, schema Zod invalido, error API

### scraping/logger (10 tests)
- startRun(): crea log RUNNING, retorna id
- completeRun(): SUCCESS, FAILED, PARTIAL, metadata, finishedAt
- updateSourceStatus(): actualiza lastRunAt, lastRunStatus, lastRunItems
- getOrCreateSource(): existente, nuevo, busca por URL

### scraping/pipeline (32 tests — 13 base + 6 IG + 13 logger)
- runPipeline(): exito, FAILED, texto vacio
- runBatchPipeline(): 0 links, 0 filtrados, todos en cache
- Procesamiento exitoso, error por URL, saveToDb true/false
- Concurrencia respeta CONCURRENCY_LIMIT
- runInstagramPipeline(): extraccion perfil, analisis posts, guardado DB
- Logger integration (batch): startRun/completeRun, init error non-fatal, complete error non-fatal
- Logger integration (batch): 0 links FAILED, 0 filtrados SUCCESS, todo cache SUCCESS
- Logger integration (IG): startRun/completeRun, init error, complete error, cache, PARTIAL
- disconnect(): con storage, sin storage, con PlaywrightExtractor

### activities/schemas (24 tests)
- listActivitiesSchema, createActivitySchema, updateActivitySchema
- Defaults, validaciones, conversiones, casos de error
- audience: 4 valores válidos, valor inválido rechazado
- ageMax hasta 120 (actividades "de 0 a 100 años")
- ageMin=0 no se trata como falsy en refine ni en ShareButton
- createActivitySchema: audience default ALL, ageMin=0 con ageMax=100

### activities/service (22 tests)
- listActivities(): filtros completos (vertical, city, price, age, type, category, search), paginacion
- getActivityById(), createActivity() con fechas y categoryIds
- updateActivity() con fechas y categoryIds, deleteActivity() soft delete

---

## Modulos sin tests unitarios (requieren E2E)

| Modulo | Razon | Prioridad |
|--------|-------|-----------|
| components/layout/Header | Server Component, requiere RSC testing | Baja |
| app/admin/* pages | Server Components, requiere E2E | Baja |
| app/login, app/registro | Client Components, requiere E2E | Media |

---

## Comandos

```bash
npm test                  # Suite rapida sin cobertura
npm run test:coverage     # Con reporte (verifica threshold del dia)
```

---

## Roadmap de pruebas

v0.5.0 (threshold 80%):
- Tests de endpoints API admin con mock auth
- Tests de providers, search (Meilisearch)

v1.0.0 (MVP):
- Tests E2E con Playwright (login, registro, admin panel, actividades)
- 100% cobertura modulos core

---

## Checklist por PR

- [ ] npm test pasa
- [ ] npm run test:coverage supera threshold del dia
- [ ] Sin skip/todo sin justificacion
- [ ] Happy path + al menos 1 caso de error por funcion publica
- [ ] Docs del modulo actualizados
