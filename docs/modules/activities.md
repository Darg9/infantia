# Módulo: Activities

**Versión:** ✅ v0.18.0-stable
**Última actualización:** 1 de mayo de 2026

## ¿Qué hace?

Expone una API REST para crear, leer, actualizar y eliminar actividades. Es el módulo central de HabitaPlan — todo lo que el scraping guarda, la API lo sirve con filtros facetados, ordenamiento, geocoding y soporte de monetización (isPremium).

## Endpoints de actividades

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/activities` | No | Lista actividades con filtros y paginación. **Usa Node TTL Cache (getCachedCount)** para no sobrecargar DB con conteos. |
| POST | `/api/activities` | No | Crea una actividad |
| GET | `/api/activities/:id` | No | Obtiene una actividad por ID |
| PUT | `/api/activities/:id` | **Admin** | Actualiza una actividad (fix C-01 v0.16.1) |
| DELETE | `/api/activities/:id` | **Admin** | Elimina una actividad (fix C-01 v0.16.1) |
| GET | `/api/activities/suggestions?q=` | No | Sugerencias mixtas: actividades (max 3) + categorías (max 1) + ciudades (max 1) + queries históricas (SearchLog). Total max 8. **Mín 3 chars** (umbral corregido en v0.16.1). Ranking: prefix > confianza/count. Formato: `{ type, id, label, sublabel }` |
| GET | `/api/activities/map` | No | Actividades con coords reales para mapa (máx 500). **Requiere `?cityId=` obligatorio — HTTP 400 sin él (v0.16.1)**. Excluye coords (0,0). Filtro estricto por `location.cityId`. |
| POST | `/api/activities/:id/view` | No | Registra una vista (métricas) |
| GET/POST | `/api/activities/:id/ratings` | Auth (POST) | Calificaciones de una actividad |

## Endpoints de favoritos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/favorites` | Sí | Lista favoritos del usuario (actividades y lugares) |
| POST | `/api/favorites` | Sí | Añade favorito `{ targetId, type: 'activity'\|'place' }` (upsert, idempotente) |
| DELETE | `/api/favorites/[targetId]?type=activity\|place` | Sí | Elimina favorito polimórfico (404 si no existe) |

## Endpoints de perfil / hijos / notificaciones

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET/PUT | `/api/profile` | Sí | Perfil del usuario autenticado (upsert) |
| PUT | `/api/profile/avatar` | Sí | Sube avatar a Supabase Storage |
| **GET** | **`/api/profile/me`** | **Sí** | **id, name, cityId, onboardingDone (NUEVO v0.16.1)** |
| **PATCH** | **`/api/profile/onboarding`** | **Sí** | **Guarda cityId + onboardingDone=true (NUEVO v0.16.1)** |
| GET/PUT | `/api/profile/notifications` | Sí | Preferencias de notificaciones |
| GET/POST | `/api/children` | Sí | Lista/crea perfiles de hijos |
| DELETE | `/api/children/:id` | Sí | Elimina perfil de hijo |
| **GET** | **`/api/cities`** | **No** | **Lista ciudades para onboarding (NUEVO v0.16.1)** |

## Endpoints de providers / claims

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| **POST** | **`/api/providers/:slug/claim`** | **Sí** | **Solicita reclamación de proveedor + email admin (NUEVO v0.16.1)** |
| **GET** | **`/api/admin/claims`** | **Admin** | **Lista claims por status (NUEVO v0.16.1)** |
| **PATCH** | **`/api/admin/claims/:id`** | **Admin** | **Aprobar (isClaimed=true, rol PROVIDER) o rechazar (NUEVO v0.16.1)** |

## Endpoints de administración

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | Pública | Health check DB + Redis con timeouts 2000ms — semántica ok/degraded/down. Incluye `business_signal` (operational, stale) + `by_city` (JOIN Activity→Location→City, slug NFD). 503 solo si DB falla. |
| `GET` | `/api/admin/cron/scrape` | CRON_SECRET | Selecciona hasta 5 fuentes por lastRunAt y encola en BullMQ. Vercel Cron diario 6 AM UTC (`0 6 * * *` — Vercel Hobby limit). |
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
| `PUT/DELETE` | `/api/admin/activities/[id]` | Admin | Actualiza/elimina actividad |
| `GET` | `/api/admin/preflight` | Admin | Métricas Date Preflight — `date_preflight_logs` (S50) |
| `GET` | `/api/admin/retention-policy` | Admin | Política de retención de actividades expiradas |
| `GET` | `/api/admin/cities/review` | Admin | Lista ciudades detectadas pendientes de revisión |
| `POST` | `/api/admin/cities/review/approve` | Admin | Aprueba ciudad detectada |
| `POST` | `/api/admin/cities/review/reassign` | Admin | Reasigna ciudad detectada a una existente |
| `GET` | `/api/admin/check-overdue-pqrs` | CRON_SECRET | Audita PQRS vencidas y notifica a `info@habitaplan.com` (cron lun-vie 8am). Usa `RESPONSE_CHANNELS` de `src/lib/pqrs.ts` (S56) |
| `POST` | `/api/contact` | No | Crea `ContactRequest` PQRS — devuelve ID y confirma acuse de recibo |
| `POST` | `/api/push/subscribe` | Auth | Suscripción Web Push VAPID |
| `GET/POST/DELETE` | `/api/legal/terminos/pdf` | No | PDF Términos de Servicio (react-pdf) |
| `GET/POST/DELETE` | `/api/legal/privacidad/pdf` | No | PDF Política de Privacidad (react-pdf) |
| `GET/POST/DELETE` | `/api/legal/datos/pdf` | No | PDF Tratamiento de Datos Ley 1581 (react-pdf) |
| `POST` | `/api/events` | No | Ingesta evento de analytics — `{ type, activityId?, path?, metadata? }`. 204 No Content. |
| `POST` | `/api/search/log` | No | Registra query de búsqueda en `SearchLog` |

## 🔌 Contrato API/UI

La UI no debe enviar parámetros no soportados por el schema.
Regla:
- El contrato válido está definido por:
  - `listActivitiesSchema` en `src/modules/activities/activities.schemas.ts`.
  - `ListParams` en el servicio `activities.service.ts`.
Cualquier desviación genera comportamiento inconsistente o ignorado.

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
| `price` | string | `free` o `paid`. Filtro comercial simplificado. |
| `status` | enum | `ACTIVE`, `PAUSED`, `EXPIRED`, `DRAFT` |
| `type` | enum | `RECURRING`, `ONE_TIME`, `CAMP`, `WORKSHOP` |
| `audience` | enum | `KIDS`, `FAMILY`, `ADULTS`, `ALL` |
| `search` | string | Búsqueda por texto (1–200 chars) |
| `sortBy` | enum | `relevance` \| `date` \| `price_asc` \| `price_desc` \| `newest` |

### ⚠️ Validación de Query Params (Zod Gate)
Todos los parámetros de entrada son filtrados por `listActivitiesSchema`.
**Regla:** Si un parámetro no está en el schema → no existe para el sistema.
**Implicación:** UI, API y Schema deben evolucionar en sincronía. Zod eliminará silenciosamente cualquier filtro fantasma.

### Regla de Filtros
Solo se documentan filtros implementados activamente en:
- Zod schema (`listActivitiesSchema`)
- Prisma query (`activities.service.ts`)

## 🔢 Ordenamiento

Orden por defecto: `relevance`

Nota: Actualmente otros tipos de orden (date, price, newest) no están expuestos en la interfaz de usuario en producción, aunque el motor de base de datos los soporta completamente a través del query param `sortBy`.

| Valor | Criterio |
|-------|---------|
| `relevance` (default) | ACTIVE primero → `isPremium desc` → sourceConfidence* → createdAt |
| `date` | Próximas primero, sin fecha al final |
| `price_asc` | Precio ascendente, gratis y sin precio al final |
| `price_desc` | Precio descendente, gratis y sin precio al final |
| `newest` | Recién agregadas a HabitaPlan |

> **Kill-Switch (S56):** Si la variable de entorno `FORCE_CHRONO='true'` está presente, el sistema forzará `newest` sobreescribiendo algorítmicamente cualquier ordenamiento de tipo `relevance`. Útil ante caídas de algoritmos de ranking.

* *Nota técnica sobre sourceConfidence:* El índice de confianza es una variable puramente algorítmica para priorización en BD y cache, **nunca** se expone a cliente garantizando 100% de veracidad, protegiendo así el Compliance Legal.*

> **isPremium en relevance:** proveedores con `isPremium=true` tienen sus actividades antes de los estándar sin queries extra — integrado en Prisma orderBy.

## Ranking en Memoria (Base y Búsqueda Híbrida)

`computeActivityScore()` en `src/modules/activities/ranking.ts` inyecta las métricas base al listado general:

```typescript
// Ranking Base (Exploración)
score = (relevance × 0.5) + (recency × 0.2) + (trust × 0.3) + ctrBoost
```

Cuando hay una búsqueda por texto (`?q=`), `activities.service.ts` emplea el **Search Hybrid Ranking**:

```typescript
// Ranking Híbrido (Búsqueda Activa)
hybridScore = (textScore × 0.50) + (healthScore × 0.25) + (ctrBoost × 0.15) + (recency × 0.10)
```

**Modificadores (Stack multiplicativo):**
1. **⭐ Destacado (Canonical Root):** Hasta `x1.10` (+10%) basado en el `duplicatesCount` (Eventos que eclipsan duplicados validando popularidad del crawler).
2. **🛡️ Oficial:** `x1.2` si el dominio terminal pertenece a fuentes seguras (ej. `.gov.co`).
3. **🔥 Popular:** Hasta `x1.10` (+10%) basado en vistas orgánicas extraidas paralelamente.
4. **🧩 Completeness:** Hasta `x1.15` sumatorio para actividades ricas en metadata sin ocultar incompletas (Precio: +5%, Edad: +5%, Location: +5%). 
5. **⏳ Freshness Decay:** Caída de máximo `-20%` penalizando eventos pasados independientemente de cuando entraron al pipeline (evita monopolios).

El boost de CTR (+0.15 de máx), se maneja via pre-integración auditando dominios orgánicos:
**Cold start safe**: sin eventos acumulados, `ctr = 0` → comportamiento idéntico al sistema previo.

## Modelo Sponsor (NUEVO v0.16.1)

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

## isPremium en Provider (NUEVO v0.16.1)

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

## 📊 Métricas

Las métricas del inventario **NO** se documentan de forma estática.

**Fuente única:**
- `/api/admin/analytics`

**Regla:**
- Ningún documento técnico o de arquitectura puede contener datos numéricos dinámicos hardcodeados (como conteos totales o actividades por proveedor). Esto rompe la veracidad del sistema Zero-Debt en cada nuevo ciclo de scraping.

## UX y Compliance Legal de Atribución

Para proteger al proyecto como "Agregador de Información", la página de detalle de una actividad (`/actividades/:id`) implementa dinámicas UX irrenunciables:
1.  Enlaza de forma transparente la **fuente oficial original** con etiqueta de "(sitio oficial)".
2.  Desmiente mediante disclaimers cualquier adjudicación sobre ser autor original del contenido.
3.  Protege a la marca eliminando certificaciones de viabilidad como sellos estáticos de "Evento Verificado" o "100% Confianza".

## Patrón de Autenticación (Intent Manager) — NUEVO v0.16.1-S55

Todo flujo protegido (favoritos, acciones futuras) usa `requireAuth` del `src/lib/require-auth.ts` como único punto de entrada de auth. No se hacen redirects manuales a `/login`.

```
Click protegido (ej: FavoriteButton sin sesión)
  ↓
requireAuth(intent, router) [async — verifica supabase.auth.getSession()]
  ↓ (sin sesión)
IntentManager.save(intent) → localStorage (TTL 15min, key: hp_intent)
router.push('/login')
  ↓ login exitoso
IntentResolver.tsx (global en layout, useEffect[])
  ↓ IntentManager.consume() → ejecuta acción + toast.success + router.replace(returnTo)
```

**Intent types:**
- `NAVIGATE` — redirige a una ruta post-login
- `TOGGLE_FAVORITE` — ejecuta `toggleFavorite()` y muestra toast de confirmación
- `GENERIC_ACTION` — hook genérico para acciones futuras

**toggleFavorite service:** `src/modules/favorites/toggle-favorite.ts` — servicio HTTP reutilizado por `FavoriteButton` e `IntentResolver`. Cero duplicación de lógica.

## Arquitectura Multi-Ciudad (NUEVO v0.16.1)

El sistema está diseñado para aislar datos geográficamente por ciudad. No existe ningún fallback geográfico implícito en el backend.

### Jerarquía de resolución de ciudad
```
URL (?cityId=) → [SSOT — gobierna SSR y fetch]
    ↓
CityProvider context → [sincronizador]
    ↓
localStorage (hp_city_id) → [persistencia secundaria]
    ↓
DB default city (más locations) → [último recurso]
```

### Componentes clave
| Archivo | Rol |
|---|---|
| `src/lib/city/resolveCity.ts` | Helper SSOT `resolveCityId()` — jerarquía pura sin side-effects |
| `src/components/providers/CityProvider.tsx` | Provider cliente: expone `{ cityId, city, cities, setCityId }`. URL-watch effect. Persistencia localStorage. |
| `src/app/actividades/layout.tsx` | Segment layout server: monta CityProvider con DB query (ciudades activas + default). |
| `src/app/actividades/_components/MapInner.tsx` | Mapa Leaflet: usa `city.defaultLat/Lng/Zoom` del contexto como centro cuando no hay pines. |

### Contrato del endpoint `/api/activities/map`
- `?cityId=` es **obligatorio**. Sin él → `HTTP 400 Bad Request`.
- Coordenadas (0,0) excluidas automáticamente.
- Filtro estricto `location: { cityId }` — nunca mezcla actividades de otras ciudades.
- Máx 500 actividades por respuesta.

### Flujo completo de cambio de ciudad
```
Filters.handleCity(cityId)
  ↓ navigate({ ...params, cityId })
  ↓ router.push(?...&cityId=xxx)
  ↓ URL cambia → SSR re-render (page.tsx)
  ↓ CityProvider URL-watch effect detecta urlCityId nuevo
  ↓ setCityIdState(nuevo) → localStorage sync
  ↓ MapInner refetch /api/activities/map?cityId=xxx
  ↓ fitBounds sobre pines de la nueva ciudad
```

