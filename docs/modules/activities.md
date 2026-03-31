# Módulo: Activities

**Versión actual:** v0.9.0
**Última actualización:** 2026-03-31

## ¿Qué hace?

Expone una API REST para crear, leer, actualizar y eliminar actividades. Es el módulo central de Infantia — todo lo que el scraping guarda, la API lo sirve con filtros facetados, ordenamiento, geocoding y soporte de monetización (isPremium).

## Endpoints de actividades

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/activities` | No | Lista actividades con filtros y paginación |
| POST | `/api/activities` | No | Crea una actividad |
| GET | `/api/activities/:id` | No | Obtiene una actividad por ID |
| PUT | `/api/activities/:id` | **Admin** | Actualiza una actividad (fix C-01 v0.9.0) |
| DELETE | `/api/activities/:id` | **Admin** | Elimina una actividad (fix C-01 v0.9.0) |
| GET | `/api/activities/suggestions` | No | Autocompletado de búsqueda (debounce 300ms, máx 6) |
| GET | `/api/activities/map` | No | Actividades con coords reales para mapa (máx 500) |
| POST | `/api/activities/:id/view` | No | Registra una vista (métricas) |
| GET/POST | `/api/activities/:id/ratings` | Auth (POST) | Calificaciones de una actividad |

## Endpoints de favoritos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/favorites` | Sí | Lista activityIds favoritos del usuario |
| POST | `/api/favorites` | Sí | Añade favorito `{ activityId }` (upsert, idempotente) |
| DELETE | `/api/favorites/:activityId` | Sí | Elimina favorito (404 si no existe) |

## Endpoints de perfil / hijos / notificaciones

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET/PUT | `/api/profile` | Sí | Perfil del usuario autenticado (upsert) |
| PUT | `/api/profile/avatar` | Sí | Sube avatar a Supabase Storage |
| GET/PUT | `/api/profile/notifications` | Sí | Preferencias de notificaciones |
| GET/POST | `/api/children` | Sí | Lista/crea perfiles de hijos |
| DELETE | `/api/children/:id` | Sí | Elimina perfil de hijo |

## Endpoints de administración

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| **GET** | **`/api/health`** | **Pública** | **Health check DB + Redis (NUEVO v0.9.0)** |
| GET | `/api/admin/scraping/sources` | Admin | Lista fuentes de scraping |
| GET | `/api/admin/scraping/logs` | Admin | Logs de scraping con filtros |
| POST | `/api/admin/expire-activities` | Cron | Expira actividades con fecha pasada (5AM UTC) |
| POST | `/api/admin/send-notifications` | Cron | Envía digest de email a usuarios suscritos |
| GET | `/api/admin/queue/status` | Admin | Estado de la cola BullMQ |
| POST | `/api/admin/queue/enqueue` | Admin | Encola un job de scraping |
| GET | `/api/admin/metrics` | Admin | Vistas, búsquedas frecuentes, distribución |
| **GET** | **`/api/admin/sponsors`** | **Admin** | **Lista sponsors (NUEVO v0.8.1)** |
| **POST** | **`/api/admin/sponsors`** | **Admin** | **Crea sponsor (NUEVO v0.8.1)** |
| **PATCH** | **`/api/admin/sponsors/:id`** | **Admin** | **Actualiza sponsor parcialmente (NUEVO v0.8.1)** |
| **DELETE** | **`/api/admin/sponsors/:id`** | **Admin** | **Elimina sponsor (NUEVO v0.8.1)** |

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
| `free` | boolean | Solo actividades gratuitas |
| `status` | enum | `ACTIVE`, `PAUSED`, `EXPIRED`, `DRAFT` |
| `type` | enum | `RECURRING`, `ONE_TIME`, `CAMP`, `WORKSHOP` |
| `audience` | enum | `KIDS`, `FAMILY`, `ADULTS`, `ALL` |
| `search` | string | Búsqueda por texto (1–200 chars) |
| `sortBy` | enum | `relevance` \| `date` \| `price_asc` \| `price_desc` \| `newest` |

Los filtros son **facetados**: cada dimensión calcula sus opciones excluyendo su propia selección, garantizando 0 combinaciones vacías.

## Ordenamiento (sortBy)

| Valor | Criterio |
|-------|---------|
| `relevance` (default) | ACTIVE primero → `isPremium desc` → sourceConfidence → createdAt |
| `date` | Próximas primero, sin fecha al final |
| `price_asc` | Precio ascendente, gratis y sin precio al final |
| `price_desc` | Precio descendente, gratis y sin precio al final |
| `newest` | Recién agregadas a Infantia |

> **isPremium en relevance:** proveedores con `isPremium=true` tienen sus actividades antes de los estándar sin queries extra — integrado en Prisma orderBy.

## Modelo Sponsor (NUEVO v0.8.1)

Gestiona patrocinadores del newsletter. Un sponsor activo (`isActive=true`) se muestra en el email digest entre la lista de actividades y el CTA final.

```typescript
interface Sponsor {
  id: string           // UUID
  name: string         // Nombre del sponsor (max 255)
  tagline: string      // Descripción corta (max 500)
  logoUrl?: string     // URL del logo (opcional)
  url: string          // URL destino (con UTM en el email)
  isActive: boolean    // Default: false
  campaignStart?: Date // Inicio de campaña (opcional)
  campaignEnd?: Date   // Fin de campaña (opcional)
  createdAt: Date
  updatedAt: Date
}
```

**Tabla:** `sponsors` — creada via `scripts/migrate-sponsors.ts` (raw SQL).
**CRUD:** `/admin/sponsors` (UI) + `/api/admin/sponsors` (API).

## isPremium en Provider (NUEVO v0.8.1)

```typescript
// Provider model additions
isPremium    Boolean   @default(false)
premiumSince DateTime?
```

- **Badge:** "⭐ Destacado" (ambar) en `ActivityCard` — prioridad sobre badge "Nuevo"
- **Ordering:** `{ provider: { isPremium: 'desc' } }` en relevance sort
- **Dashboard:** `/proveedores/[slug]/dashboard` muestra estado premium con fecha

## URL canónica de actividades

Formato: `/actividades/{uuid}-{slug-titulo}`

```typescript
// src/lib/activity-url.ts
activityPath(id, title)  // → "/actividades/{uuid}-{slug}"
extractActivityId(param) // → UUID (desde param con o sin slug)
```

- UUID como clave de lookup en BD (backward compatible con URLs bare)
- Redirect server-side: `/actividades/{uuid}` → `/actividades/{uuid}-{slug}`
- `<link rel="canonical">` apunta siempre a URL con slug

## Email digest con UTM

`activity-digest.tsx` incluye:
- UTM en links de actividades: `?utm_source=infantia&utm_medium=email&utm_campaign=digest_{daily|weekly}`
- UTM en CTA "Ver todas": mismo parámetro
- Bloque sponsor opcional (prop `sponsor?`): link con `utm_campaign=newsletter`

## Geocoding por actividad

Cada actividad en detalle y mapa expone `location.latitude` / `location.longitude`. El pipeline garantiza coords reales via:

1. `venue-dictionary.ts` — 40+ venues Bogotá (~0ms)
2. Nominatim (OpenStreetMap) — rate limit 1.1s
3. cityFallback
4. null (actividad sin pin)

## Datos actuales (2026-03-31)

| Proveedor | Actividades |
|-----------|------------|
| BibloRed | 150 |
| Sec. Cultura | 29 |
| Planetario | 25 |
| Alcaldía Bogotá | 20 |
| IDARTES | 19 |
| FCE Colombia | 10 |
| Cinemateca | 14 (+13 hoy) |
| JBB | 7 (+3 hoy) |
| Banrep Cartagena | 1 (+1 hoy) |
| **Total** | **~277** |

- 29/29 locations con coordenadas reales ✅
- Mayoría EXPIRED — pendiente: ingest Banrep (reset Gemini 19:00 COL) para fechas futuras
