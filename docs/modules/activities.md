# Módulo: Activities

**Versión actual:** v0.1.0
**Última actualización:** 2026-03-16

## ¿Qué hace?

Expone una API REST para crear, leer, actualizar y eliminar actividades. Es el módulo central de Infantia — todo lo que el scraping guarda, la API lo sirve.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/activities` | Lista actividades con filtros y paginación |
| POST | `/api/activities` | Crea una actividad |
| GET | `/api/activities/:id` | Obtiene una actividad por ID |
| PUT | `/api/activities/:id` | Actualiza una actividad |
| DELETE | `/api/activities/:id` | Elimina una actividad |

## Filtros disponibles (GET /api/activities)

| Parámetro | Tipo | Descripción |
|---|---|---|
| `page` | number | Página (default: 1) |
| `pageSize` | number | Resultados por página (default: 20, max: 100) |
| `verticalId` | UUID | Filtrar por vertical |
| `categoryId` | UUID | Filtrar por categoría |
| `cityId` | UUID | Filtrar por ciudad |
| `ageMin` / `ageMax` | number | Rango de edad (0–18) |
| `priceMin` / `priceMax` | number | Rango de precio |
| `status` | enum | ACTIVE, PAUSED, EXPIRED, DRAFT |
| `type` | enum | RECURRING, ONE_TIME, CAMP, WORKSHOP |
| `search` | string | Búsqueda por texto (1–200 chars) |

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `activities.schemas.ts` | Validación Zod de todos los inputs |
| `activities.service.ts` | Lógica de negocio + queries a Prisma |
| `src/app/api/activities/route.ts` | Handler GET + POST |
| `src/app/api/activities/[id]/route.ts` | Handler GET + PUT + DELETE |

## Reglas de negocio

- `ageMin` debe ser ≤ `ageMax` si ambos están presentes
- `priceMin` debe ser ≤ `priceMax` si ambos están presentes
- `status` default: `DRAFT` (las actividades scrapeadas empiezan en draft)
- `priceCurrency` default: `COP`
- `sourceConfidence` default: `0.5`

## Tests

```
src/modules/activities/__tests__/
  schemas.test.ts → listActivitiesSchema, createActivitySchema, updateActivitySchema
```

## Pendiente

- [ ] Soft delete (campo `deletedAt`) en lugar de borrado real
- [ ] Endpoint de búsqueda full-text con Meilisearch
- [ ] Paginación tipo cursor (más eficiente que offset)
- [ ] Endpoint de actividades destacadas / recomendadas
