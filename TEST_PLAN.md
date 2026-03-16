# Infantia — Plan de Pruebas

**Versión:** v0.2.0
**Fecha:** 2026-03-16
**Framework:** Vitest + @vitest/coverage-v8
**Threshold:** +10% por día desde 2026-03-16 (día 1 = 30%, cap = 100%)

---

## Filosofía

Cada PR incluye código + tests + docs. El CI verifica cobertura en cada push.

---

## Thresholds dinámicos

| Día | Fecha | Threshold |
|-----|-------|-----------|
| 1 | 2026-03-16 | 30% |
| 2 | 2026-03-17 | 40% |
| 3 | 2026-03-18 | 50% |
| 4 | 2026-03-19 | 60% |
| 5 | 2026-03-20 | 70% |
| 6 | 2026-03-21 | 80% |
| 7+ | 2026-03-22+ | 100% |

Calculado automáticamente en vitest.config.ts.

---

## Cobertura actual (v0.2.0)

| Módulo | Test | Stmts | Funcs | Lines | Estado |
|--------|------|-------|-------|-------|--------|
| lib/utils | utils.test.ts | 100% | 100% | 100% | OK |
| lib/validation | validation.test.ts | 100% | 100% | 100% | OK |
| lib/api-response | api-response.test.ts | 100% | 100% | 100% | OK |
| scraping/cache | cache.test.ts | 100% | 100% | 100% | OK |
| scraping/types | types.test.ts | 100% | 100% | 100% | OK |
| scraping/storage | storage.test.ts | 95% | 100% | 96% | OK |
| scraping/extractor | cheerio-extractor.test.ts | ~92% | 100% | ~91% | OK |
| scraping/nlp/claude | claude-analyzer.test.ts | 100% | 100% | 100% | OK |
| scraping/nlp/gemini | gemini-analyzer.test.ts | ~99% | 100% | ~99% | OK |
| scraping/pipeline | pipeline.test.ts | 100% | 100% | 100% | OK |
| activities/schemas | schemas.test.ts | 100% | 100% | 100% | OK |
| activities/service | service.test.ts | 94% | 100% | 100% | OK |

**Total v0.2.0: ~96% statements / ~97% functions / 95.8% lines**

---

## Escenarios cubiertos

### lib/utils
- cn(): clases, falsy, sin args
- formatPrice(): COP, 0, USD, grandes
- calculateAge(): exacto, cumpleanos manana, recien nacido
- slugify(): minusculas, acentos, espacios, especiales

### lib/validation
- uuidSchema: valido, invalido, vacio, numero
- paginationSchema: defaults, strings a numeros, limites
- parsePagination(): skip calculado, primera pagina

### lib/api-response
- successResponse(), paginatedResponse()
- errorResponse(): con detalles, sin detalles

### scraping/cache
- has/add/filterNew/size: todos los casos edge
- save(): writeFileSync, JSON valido
- load(): desde archivo, JSON invalido

### scraping/storage
- saveBatchResults(): vacio, sin data, baja confianza, alta confianza
- Mezcla validos/omitidos, error sin vertical
- Upsert vs create, vincular categorias, mapeo tipos
- disconnect()

### scraping/cheerio-extractor
- extract(): exito, elimina nav/script/footer, JSON-LD Event vs no-Event
- FAILED en error de red, en HTTP 4xx
- extractLinks(): filtro mismo dominio, excluye anchors/mailto/javascript/tel
- Deduplicacion, ignora URL de listing, anchorText vacio
- extractLinksAllPages(): pagina unica, multi-pagina

### scraping/nlp/claude-analyzer
- Sin API key → mockAnalysis (sin llamar fetch)
- Con API key: JSON valido, markdown cleanup, error API, JSON invalido, schema Zod invalido
- Trunca texto a 15000 chars

### scraping/nlp/gemini-analyzer
- Sin API key → mockAnalysis (sin llamar Gemini)
- Con API key: JSON valido, markdown cleanup, confianza baja → "No identificado"
- JSON invalido lanza error, schema invalido lanza error
- discoverActivityLinks: mapeo indices, fuera de rango, lista vacia
- Lotes de 50 (110 links → 3 llamadas), fallo de lote → continua
- callWithRetry: 503 reintenta, 429 agota (3x), 400 no reintenta

### scraping/pipeline
- runPipeline(): exito, FAILED, texto vacio
- runBatchPipeline(): 0 links, 0 filtrados, todos en cache
- Procesamiento exitoso, error por URL, saveToDb true/false
- Concurrencia respeta CONCURRENCY_LIMIT
- disconnect(): con y sin storage

### activities/schemas
- listActivitiesSchema, createActivitySchema, updateActivitySchema
- Defaults, validaciones, conversiones, casos de error

### activities/service (Prisma mockeado)
- listActivities(): filtros completos, paginacion
- getActivityById(), createActivity(), updateActivity(), deleteActivity()
- Soft delete, reemplazo de categorias

---

## Comandos

```bash
npm test                  # Suite rapida sin cobertura
npm run test:coverage     # Con reporte (verifica threshold del dia)
```

---

## Roadmap de pruebas

v0.3.0 (threshold 50%):
- Modulo providers, search (Meilisearch)
- Tests de endpoints API con Supertest
- Tests del segundo sitio scrapeado (Idartes)

v1.0.0 (MVP):
- Tests E2E con Playwright
- 100% cobertura modulos core

---

## Checklist por PR

- [ ] npm test pasa
- [ ] npm run test:coverage supera threshold del dia
- [ ] Sin skip/todo sin justificacion
- [ ] Happy path + al menos 1 caso de error por funcion publica
- [ ] Docs del modulo actualizados
