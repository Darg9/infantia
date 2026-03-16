# Infantia — Plan de Pruebas

**Versión:** v0.1.0
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

## Cobertura actual (v0.1.0)

| Módulo | Test | Stmts | Funcs | Lines | Estado |
|--------|------|-------|-------|-------|--------|
| lib/utils | utils.test.ts | 100% | 100% | 100% | OK |
| lib/validation | validation.test.ts | 100% | 100% | 100% | OK |
| scraping/cache | cache.test.ts | 100% | 100% | 100% | OK |
| scraping/types | types.test.ts | 100% | 100% | 100% | OK |
| scraping/storage | storage.test.ts | 95% | 100% | 96% | OK |
| activities/schemas | schemas.test.ts | 100% | 100% | 100% | OK |
| activities/service | service.test.ts | 94% | 100% | 100% | OK |
| lib/api-response | pendiente | 0% | 0% | 0% | v0.2.0 |
| scraping/pipeline | pendiente | 0% | 0% | 0% | v0.2.0 |
| scraping/extractor | pendiente | 0% | 0% | 0% | v0.2.0 |
| scraping/nlp | pendiente | 0% | 0% | 0% | v0.2.0 |

Total v0.1.0: 31% statements / 52% functions / 31% lines

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

### scraping/cache
- has/add/filterNew/size: todos los casos edge
- save(): writeFileSync, JSON valido
- load(): desde archivo, JSON invalido

### scraping/storage
- saveBatchResults(): vacio, sin data, baja confianza, alta confianza
- Mezcla validos/omitidos, error sin vertical
- Upsert vs create, vincular categorias, mapeo tipos
- disconnect()

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

v0.2.0 (threshold 40%):
- api-response.ts, pipeline.ts, extractor.ts, gemini.analyzer.ts
- Tests del segundo sitio scrapeado (Idartes)

v0.3.0 (threshold 50%):
- Modulo providers, search (Meilisearch)
- Tests de endpoints API con Supertest

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
