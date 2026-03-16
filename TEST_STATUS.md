# Infantia — Estado de Pruebas

Actualizado: 2026-03-16 | Versión: v0.2.0

## Resumen

| Métrica | Valor |
|---------|-------|
| Archivos de test | 12 |
| Tests totales | 193 |
| Pasados | 193 |
| Fallidos | 0 |
| Threshold hoy (día 1) | 30% |
| Statements | ~96% OK |
| Functions | ~97% OK |
| Lines | 95.8% OK |

## Estado: PASSED

## Detalle por archivo

### lib/__tests__/utils.test.ts (20 tests) OK
- cn(): une clases, ignora falsy, sin args, arg único
- formatPrice(): COP, precio 0, USD, grandes
- calculateAge(): 10 años exacto, cumpleaños mañana, recién nacido, 5 años
- slugify(): minúsculas, acentos, espacios, guiones, especiales, texto ya slug, nombre Infantia

### lib/__tests__/validation.test.ts (13 tests) OK
- uuidSchema: válido, inválido, vacío, número
- paginationSchema: defaults, conversión strings, page<1, page negativa, pageSize>100, pageSize=100, pageSize<1
- parsePagination(): page+skip, primera página, página 5 con size 20, sin params

### lib/__tests__/api-response.test.ts (9 tests) OK
- successResponse(): status 200, data correcta
- paginatedResponse(): incluye pagination meta
- errorResponse(): mensaje, status code, con detalles, sin detalles

### scraping/__tests__/cache.test.ts (14 tests) OK
- has(): URL no vista, URL después de add
- filterNew(): cache vacío, URLs vistas, todas vistas, input vacío
- size: inicio 0, incrementa, no duplica
- add(): sobreescribe título
- save(): writeFileSync llamado, JSON válido con URL
- load(): desde archivo existente, JSON inválido

### scraping/__tests__/types.test.ts (tests de tipos) OK
- activityNLPResultSchema, discoveredActivityUrlsSchema

### scraping/__tests__/storage.test.ts (11 tests) OK
- saveBatchResults(): vacío, sin data, confianza<0.2, confianza>=0.2
- Mezcla validos+omitidos, error sin vertical
- Upsert vs create, vinculación categorías, WORKSHOP mapping
- disconnect(): $disconnect llamado

### scraping/__tests__/cheerio-extractor.test.ts (15 tests) OK
- extract(): HTML exitoso, elimina nav/script/style/footer, extrae JSON-LD tipo Event, ignora JSON-LD no-Event
- Estado FAILED en error de red, en HTTP 4xx
- extractLinks(): filtra mismo dominio, excluye #anchors/mailto/javascript/tel
- Deduplicación, ignora URL de listing, anchorText vacío → usa pathname
- extractLinksAllPages(): página única (sin paginación), multi-página con paginación

### scraping/__tests__/claude-analyzer.test.ts (11 tests) OK
- Sin API key → mockAnalysis sin llamar fetch
- Con API key: parsea JSON correctamente, limpia markdown fences
- Error de API, JSON inválido, schema Zod inválido
- Trunca texto a 15000 chars
- mockAnalysis: incluye URL en descripción, discoverActivityLinks retorna todos los links

### scraping/__tests__/gemini-analyzer.test.ts (18 tests) OK
- Sin API key → mockAnalysis sin llamar a Gemini
- Con API key: parsea JSON, limpia markdown fences, confianza baja (<0.1) → "No identificado"
- JSON inválido lanza error, schema inválido lanza error
- discoverActivityLinks: mapeo de índices, índices fuera de rango, lista vacía
- Error en un lote → continúa con otros lotes, schema inválido → continúa
- Procesa en lotes de 50 (110 links → 3 llamadas)
- callWithRetry: reintenta en 503, agota reintentos en 429 (3x), no reintenta en 400

### scraping/__tests__/pipeline.test.ts (13 tests) OK
- runPipeline(): éxito con análisis, estado FAILED si extract falla, texto vacío
- runBatchPipeline(): 0 links, 0 filtrados por Gemini, todos en caché
- Procesamiento exitoso, error por URL (continúa), saveToDb true/false
- Concurrencia: respeta CONCURRENCY_LIMIT
- disconnect(): con y sin storage

### activities/__tests__/schemas.test.ts (tests de schemas) OK
- listActivitiesSchema, createActivitySchema, updateActivitySchema

### activities/__tests__/service.test.ts (tests de servicio) OK
- listActivities(): 8+ escenarios de filtros y paginación
- getActivityById(): busca por id, null si no existe, retorna actividad
- createActivity(): con/sin categoryIds
- updateActivity(): llama update, retorna actualizado, reemplaza categorías
- deleteActivity(): soft delete EXPIRED, no elimina físicamente

## Cobertura por módulo

| Archivo | Stmts | Branch | Funcs | Lines |
|---------|-------|--------|-------|-------|
| lib/utils.ts | 100% | 100% | 100% | 100% |
| lib/validation.ts | 100% | 100% | 100% | 100% |
| lib/api-response.ts | 100% | 100% | 100% | 100% |
| scraping/cache.ts | 100% | 100% | 100% | 100% |
| scraping/types.ts | 100% | 100% | 100% | 100% |
| scraping/storage.ts | 95% | 78% | 100% | 96% |
| scraping/cheerio.extractor.ts | ~92% | ~80% | 100% | ~91% |
| scraping/nlp/claude.analyzer.ts | 100% | 100% | 100% | 100% |
| scraping/nlp/gemini.analyzer.ts | ~99% | ~95% | 100% | ~99% |
| scraping/pipeline.ts | 100% | 100% | 100% | 100% |
| activities/schemas.ts | 100% | 100% | 100% | 100% |
| activities/service.ts | 94% | 79% | 100% | 100% |
| **TOTAL** | **~96%** | **~88%** | **~97%** | **95.8%** |
