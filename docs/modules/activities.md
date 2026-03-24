# Módulo: Activities

**Versión actual:** v0.5.0
**Última actualización:** 2026-03-23

## ¿Qué hace?

Expone una API REST para crear, leer, actualizar y eliminar actividades. Es el módulo central de Infantia — todo lo que el scraping guarda, la API lo sirve.

## Endpoints de actividades

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/activities` | No | Lista actividades con filtros y paginación |
| POST | `/api/activities` | No | Crea una actividad |
| GET | `/api/activities/:id` | No | Obtiene una actividad por ID |
| PUT | `/api/activities/:id` | No | Actualiza una actividad |
| DELETE | `/api/activities/:id` | No | Elimina una actividad |

## Endpoints de favoritos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/favorites` | Sí | Lista activityIds favoritos del usuario |
| POST | `/api/favorites` | Sí | Añade favorito `{ activityId }` (upsert, idempotente) |
| DELETE | `/api/favorites/:activityId` | Sí | Elimina favorito (404 si no existe) |

## Endpoints de hijos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/children` | Sí | Lista hijos del usuario autenticado |
| POST | `/api/children` | Sí | Crea perfil de hijo con consentimiento parental |
| DELETE | `/api/children/:id` | Sí | Elimina perfil de hijo |

## Endpoints de administración

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/admin/scraping/sources` | Admin | Lista fuentes de scraping |
| GET | `/api/admin/scraping/logs` | Admin | Logs de scraping con filtros |
| POST | `/api/admin/expire-activities` | Cron | Expira actividades con fecha pasada (5AM UTC) |

## Filtros disponibles (GET /api/activities)

| Parámetro | Tipo | Descripción |
|---|---|---|
| `page` | number | Página (default: 1) |
| `pageSize` | number | Resultados por página (default: 20, max: 100) |
| `verticalId` | UUID | Filtrar por vertical |
| `categoryId` | UUID | Filtrar por categoría |
| `cityId` | UUID | Filtrar por ciudad |
| `ageMin` / `ageMax` | number | Rango de edad (0–120) |
| `priceMin` / `priceMax` | number | Rango de precio |
| `status` | enum | `ACTIVE`, `PAUSED`, `EXPIRED`, `DRAFT` |
| `type` | enum | `RECURRING`, `ONE_TIME`, `CAMP`, `WORKSHOP` |
| `audience` | enum | `KIDS`, `FAMILY`, `ADULTS`, `ALL` |
| `search` | string | Búsqueda por texto (1–200 chars) |

Los filtros son **facetados**: cada dimensión calcula sus opciones excluyendo su propia selección, garantizando 0 combinaciones vacías.

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `activities.schemas.ts` | Validación Zod de todos los inputs |
| `activities.service.ts` | Lógica de negocio + queries a Prisma |
| `src/app/api/activities/route.ts` | Handler GET + POST |
| `src/app/api/activities/[id]/route.ts` | Handler GET + PUT + DELETE |
| `src/app/api/favorites/route.ts` | GET + POST favoritos |
| `src/app/api/favorites/[activityId]/route.ts` | DELETE favorito |
| `src/app/api/children/route.ts` | GET + POST hijos |
| `src/app/api/children/[id]/route.ts` | DELETE hijo |

## Reglas de negocio

- `ageMin` debe ser ≤ `ageMax` si ambos están presentes (0–120, no 0–18)
- `priceMin` debe ser ≤ `priceMax` si ambos están presentes
- `status` default: `DRAFT` (actividades scrapeadas empiezan en draft)
- `audience` default: `ALL`
- `priceCurrency` default: `COP`
- `sourceConfidence` default: `0.5`
- Edad calculada por fecha exacta (no solo por año)
- `ageMin=0` se trata como valor válido (no falsy)

## Tests

```
src/modules/activities/__tests__/
  schemas.test.ts  → listActivitiesSchema, createActivitySchema, updateActivitySchema
                     audience, ageMax=120, falsy-zero guards — 100%
  service.test.ts  → listActivities (filtros+paginación+audience), CRUD — 94% stmts

src/app/api/children/__tests__/
  children.test.ts → GET/POST/DELETE, auth, consentimiento, edad — 224 líneas

src/app/api/favorites/ (sin archivo de test separado — cubierto en pipeline)
```

Cobertura v0.5.0: schemas 100% · service 94% stmts / 100% funcs

## Pendiente

- [ ] Endpoint de búsqueda full-text con Meilisearch (módulo stub existe, no activo)
- [ ] Paginación tipo cursor (más eficiente que offset para listados grandes)
- [ ] Endpoint de actividades destacadas / recomendadas
- [ ] Ratings de actividades (modelo `ActivityRating` existe en schema, falta API)
- [ ] Soft delete (`deletedAt`) en lugar de borrado real
