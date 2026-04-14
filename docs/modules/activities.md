# Módulo: Activities

**Versión actual:** v0.11.0-S45
**Última actualización:** Hoy

## ¿Qué hace?

Expone una API REST para crear, leer, actualizar y eliminar actividades. Es el módulo central de HabitaPlan — todo lo que el scraping guarda, la API lo sirve con filtros facetados, ordenamiento, geocoding y soporte de monetización (isPremium).

## Endpoints de actividades

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/activities` | No | Lista actividades con filtros y paginación. **Usa Node TTL Cache (getCachedCount)** para no sobrecargar DB con conteos. |
| POST | `/api/activities` | No | Crea una actividad |
| GET | `/api/activities/:id` | No | Obtiene una actividad por ID |
| PUT | `/api/activities/:id` | **Admin** | Actualiza una actividad (fix C-01 v0.9.0) |
| DELETE | `/api/activities/:id` | **Admin** | Elimina una actividad (fix C-01 v0.9.0) |
| GET | `/api/activities/suggestions?q=` | No | Sugerencias mixtas: actividades (max 3) + categorías (max 1) + ciudades (max 1). Total max 5. Min 3 chars. Ranking: prefix > confianza/count. Formato: `{ type, id, label, sublabel }` |
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
| **GET** | **`/api/profile/me`** | **Sí** | **id, name, cityId, onboardingDone (NUEVO v0.9.1)** |
| **PATCH** | **`/api/profile/onboarding`** | **Sí** | **Guarda cityId + onboardingDone=true (NUEVO v0.9.1)** |
| GET/PUT | `/api/profile/notifications` | Sí | Preferencias de notificaciones |
| GET/POST | `/api/children` | Sí | Lista/crea perfiles de hijos |
| DELETE | `/api/children/:id` | Sí | Elimina perfil de hijo |
| **GET** | **`/api/cities`** | **No** | **Lista ciudades para onboarding (NUEVO v0.9.1)** |

## Endpoints de providers / claims

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| **POST** | **`/api/providers/:slug/claim`** | **Sí** | **Solicita reclamación de proveedor + email admin (NUEVO v0.9.1)** |
| **GET** | **`/api/admin/claims`** | **Admin** | **Lista claims por status (NUEVO v0.9.1)** |
| **PATCH** | **`/api/admin/claims/:id`** | **Admin** | **Aprobar (isClaimed=true, rol PROVIDER) o rechazar (NUEVO v0.9.1)** |

## Endpoints de administración

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | Pública | Health check DB + Redis — 200 si DB ok, 503 solo si DB falla |
| `POST` | `/api/admin/expire-activities` | CRON_SECRET | Expira actividades con fecha pasada (5AM UTC) |
| `POST` | `/api/admin/send-notifications` | CRON_SECRET | Envía digest de email a usuarios suscritos |
| `GET` | `/api/admin/scraping/sources` | Admin | Lista fuentes de scraping |
| `GET/PATCH` | `/api/admin/scraping/sources/[id]` | Admin | Toggle activo/pausado de fuente |
| `GET` | `/api/admin/scraping/logs` | Admin | Logs de scraping con filtros |
| `GET` | `/api/admin/queue/status` | Admin | Estado de la cola BullMQ |
| `POST` | `/api/admin/queue/enqueue` | Admin | Encola un job de scraping manualmente |
| `GET` | `/api/admin/analytics` | Admin | Eventos últimas 24h agrupados por tipo |
| `GET` | `/api/admin/quality` | Admin | ContentQualityMetric — dashboard calidad (S43) |
| `GET` | `/api/admin/alerts` | Admin | Alertas del sistema adaptive filter |
| `GET` | `/api/admin/source-health` | Admin | SourceHealth scores por dominio |
| `GET` | `/api/admin/sources/url-stats` | Admin | Estadísticas de URLs por fuente |
| `GET/POST` | `/api/admin/sponsors` | Admin | Lista/crea sponsors |
| `PATCH/DELETE` | `/api/admin/sponsors/[id]` | Admin | Actualiza/elimina sponsor |
| `GET` | `/api/admin/claims` | Admin | Lista claims de proveedores |
| `PATCH` | `/api/admin/claims/[id]` | Admin | Aprueba o rechaza claim |
| `PUT/DELETE` | `/api/admin/activities/[id]` | Admin | Actualiza/elimina actividad (C-01) |

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
| `relevance` (default) | ACTIVE primero → `isPremium desc` → sourceConfidence* → createdAt |

* *Nota técnica sobre sourceConfidence:* El índice de confianza es una variable puramente algorítmica para priorización en BD y cache, **nunca** se expone a cliente garantizando 100% de veracidad, protegiendo así el Compliance Legal.*
| `date` | Próximas primero, sin fecha al final |
| `price_asc` | Precio ascendente, gratis y sin precio al final |
| `price_desc` | Precio descendente, gratis y sin precio al final |
| `newest` | Recién agregadas a HabitaPlan |

> **isPremium en relevance:** proveedores con `isPremium=true` tienen sus actividades antes de los estándar sin queries extra — integrado en Prisma orderBy.

## CTR Boost en Ranking (NUEVO v0.11.0-S44)

`computeActivityScore()` en `src/modules/activities/ranking.ts` acepta un tercer parámetro opcional `ctrBoost: number = 0` que se suma al score final:

```typescript
computeActivityScore(activity, sourceHealthScore, ctrBoost)
// score = (relevance × 0.5) + (recency × 0.2) + (trust × 0.3) + ctrBoost
```

El boost proviene de `src/modules/analytics/metrics.ts`:

| CTR del dominio fuente | Boost aplicado |
|------------------------|---------------|
| > 30% | +0.15 |
| > 15% | +0.08 |
| > 5% | +0.03 |
| ≤ 5% | 0 |

**Flujo en `activities.service.ts`:**
1. `getCachedCTR()` — CTR por dominio (cache 5min, 0 queries repetidos en el mismo ciclo)
2. `activity.sourceUrl → getDomainFromUrl()` — extrae dominio de la actividad
3. `ctrToBoost(ctr)` — convierte CTR a boost numérico
4. `computeActivityScore(act, healthScore, ctrBoost)` — score final con señal de conversión

**Cold start:** sin eventos acumulados, `ctrMap = {}` → `ctr = 0` → boost = 0 → comportamiento idéntico al sistema previo. Sin riesgo de regresión.

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
- UTM en links de actividades: `?utm_source=habitaplan&utm_medium=email&utm_campaign=digest_{daily|weekly}`
- UTM en CTA "Ver todas": mismo parámetro
- Bloque sponsor opcional (prop `sponsor?`): link con `utm_campaign=newsletter`

## Geocoding por actividad

Cada actividad en detalle y mapa expone `location.latitude` / `location.longitude`. El pipeline garantiza coords reales via:

1. `venue-dictionary.ts` — 40+ venues Bogotá (~0ms)
2. Nominatim (OpenStreetMap) — rate limit 1.1s
3. cityFallback
4. null (actividad sin pin)

## Datos actuales (2026-04-06)

| Proveedor | Actividades |
|-----------|------------|
| BibloRed | ~150 |
| Sec. Cultura | ~29 |
| Planetario | ~25 |
| Alcaldía Bogotá | ~20 |
| IDARTES | ~19 |
| FCE Colombia | ~10 |
| Cinemateca | ~14 |
| JBB | ~7 |
| Banrep (todas ciudades) | ~17 |
| **Total** | **~275** |

- 29/29 locations con coordenadas reales ✅
- BD bajó de 293 a ~275 por expiración de actividades de marzo (fechas pasadas → EXPIRED)
- Pendiente: ingest Banrep ciudades + nuevo ingest web cuando se renueve cuota Gemini (19:00 COL)

## UX y Compliance Legal de Atribución

Para proteger al proyecto como "Agregador de Información", la página de detalle de una actividad (`/actividades/:id`) implementa dinámicas UX irrenunciables:
1.  Enlaza de forma transparente la **fuente oficial original** con etiqueta de "(sitio oficial)".
2.  Desmiente mediante disclaimers cualquier adjudicación sobre ser autor original del contenido.
3.  Protege a la marca eliminando certificaciones de viabilidad como sellos estáticos de "Evento Verificado" o "100% Confianza".
