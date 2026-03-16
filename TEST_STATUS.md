# Infantia — Estado de Pruebas

Actualizado: 2026-03-16 | Versión: v0.1.0

## Resumen

| Métrica | Valor |
|---------|-------|
| Archivos de test | 7 |
| Tests totales | 120 |
| Pasados | 120 |
| Fallidos | 0 |
| Threshold hoy (día 1) | 30% |
| Statements | 31% OK |
| Functions | 52% OK |
| Lines | 31% OK |

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
| scraping/cache.ts | 100% | 100% | 100% | 100% |
| scraping/types.ts | 100% | 100% | 100% | 100% |
| scraping/storage.ts | 95% | 78% | 100% | 96% |
| activities/schemas.ts | 100% | 100% | 100% | 100% |
| activities/service.ts | 94% | 79% | 100% | 100% |
| lib/api-response.ts | 0% | 0% | 0% | 0% |
| scraping/pipeline.ts | 0% | 0% | 0% | 0% |
| scraping/extractor.ts | 0% | 0% | 0% | 0% |
| scraping/nlp/*.ts | 0% | 0% | 0% | 0% |
| **TOTAL** | **31%** | **41%** | **52%** | **31%** |
