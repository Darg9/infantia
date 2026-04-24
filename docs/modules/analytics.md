# Módulo: Analytics (Zero-Dependencies)

**Versión:** ✅ v0.16.1
**Última actualización:** 24 de abril de 2026

Este documento explica la infraestructura de rastreo de interacciones web instalada nativamente en HabitaPlan, la cual opera **sin ninguna plataforma de terceros externa (Sin Google Analytics, Segment ni Mixpanel).** 

La meta de este módulo adherido al paradigma "Zero-Debt" es garantizar que la base analítica nunca añada latencia JavaScript en cliente, no cargue scripts asincrónos inyectados globalmente y evite los firewalls ad-blockers al ser considerado tráfico API _first-party_.

## 📦 Diccionario de Eventos (SSOT)

El archivo `src/lib/track.ts` es la única fuente válida para:
- nombres de eventos
- payloads
- validaciones

Cualquier evento nuevo debe declararse primero ahí para evitar fragmentación. El sistema capta exclusivamente el embudo de conversión:

1. **`page_view`**: Medición clásica de carga de vista Next.js router.
2. **`activity_view`**: Navegación hacia la ruta canónica (`/actividades/[id]`). HabitaPlan utiliza páginas de detalle indexables (no modales) para SEO y shareability.
3. **`activity_click`**: Clic a una tarjeta en un listado global.
4. **`outbound_click`**: Clic al enlace externo hacia un proveedor (Norte comercial).
5. **`search_applied`**: Input textual de un usuario (para evaluar la pertinencia del NLP).
6. **`search_suggestion_clicked`**: Evento capturado en el `HeroSearch` (Search Assist System) para medir adopción del autocompletado y de la corrección explícita de intención.

7. **`filter_applied` [CRITICAL - NOT IMPLEMENTED]**:
   - El sistema actualmente NO mide interacción con filtros facetados.
   - Esto genera ceguera en navegación no textual.
   - **Impacto**: No se puede entender intención real de exploración ni optimizar UX de filtros.
   - **Prioridad**: HIGH (bloquea decisiones de producto).
   - **Recomendación**: Instrumentar evento en cambios de categoría, rango de edad, precio, ubicación.
   - **Backlog ID**: FEAT-6.8-3

> **Nota v0.16.1:** El script `scripts/generate-brand-assets.mjs` no emite eventos de analytics — opera exclusivamente en build-time. Los únicos eventos de producción son los 6 definidos arriba más el pendiente `filter_applied`.

## 👤 Identidad de Usuario (Tracking)

- Todo evento de comportamiento debe incluir:
  - `sessionId` (obligatorio para análisis de cohortes y retención).
  - `userId` (opcional, si existe sesión autenticada).
- Sin identificadores de sesión correlacionados, no es posible construir un funnel real de producto.

## 🔀 Pipelines de Ingesta (SSOT)

El sistema de Analytics opera sobre dos modelos de base de datos separados estructuralmente:

- `Event` → Comportamiento del usuario (UX funnel).
- `SearchLog` → Intención textual (queries de búsqueda).

### Regla de separación
- Eventos de UI van a `Event` (vía `POST /api/events`).
- Consultas de texto van a `SearchLog` (vía `POST /api/search/log`).
- **Nunca mezclar ambos modelos.** `SearchLog` NO es parte del funnel de conversión, es un subsistema de inteligencia de demanda e inventario.

## ⚙️ Arquitectura Técnica de Ingesta

El sistema fluye en tres pasos aislados a fin de ser escalable:

### 1. El Emisor Front-End (`src/lib/track.ts`)
Expone la función `trackEvent`. 
- Usa un **Throttling en Memoria** global `lastEventMap`: Cada evento genera un _hash key_. Si se pulsan repetidos clics en el mismo ID de outbound/banner en menos de *1000ms*, el Frontend lo destruye para que no infle métricas.
- Es *Fail-Silent*. Cualquier error se atrapa con un `try / catch` mudo para no tumbar árboles de UI en React.
- Envía via `fetch()` asincrónico a Next.js Serverless Edge. Para asegurar la transmisión incluso cuando cambian de ruta, emplea el prop experimental de la web app API `keepalive: true`.

### 2. El Agregador API (`src/app/api/events/route.ts`)
Recibe vía HTTP POST, purifica y prepara.
- Ignora si falta el type.
- Mapea IP (desde *x-forwarded-for* o *x-real-ip*) y *User-Agent*. Ambos vitales para el motor futuro Antispam y Detección de Bots B2B.

### 3. La Base de Datos (Entity: `Event`)
Un modelo en PostgreSQL que incluye atributos dinámicos bajo tipado robusto `JSONB` de Prisma:
```prisma
model Event {
  id          String   @id @default(uuid())
  type        String
  activityId  String?
  path        String?
  metadata    Json?
  userAgent   String?
  ip          String?
  createdAt   DateTime @default(now())
  
  @@index([type])
  @@index([createdAt])
  @@index([activityId])
}
```

## 🔌 Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/events` | No (público) | Ingesta un evento de tracking. Body: `{ type, activityId?, path?, metadata? }`. Devuelve `204 No Content`. |
| `GET` | `/api/admin/analytics` | Admin | Agrega eventos de las últimas 24h por tipo. Devuelve `[{ type, _count }]`. |

**Contrato POST `/api/events`:**
```json
{ "type": "outbound_click", "activityId": "uuid", "path": "/actividades/uuid-slug" }
```
- `type` es requerido — devuelve 400 si falta.
- IP leída de `x-forwarded-for` o `x-real-ip` (compatible con Vercel).
- Fail-silent en servidor: errores no rompen el request del usuario.

## 📈 Dashboard Interno (`/admin/analytics`)

El dashboard es un Client Component (`page.tsx`) que consume `GET /api/admin/analytics` (ventana 24h):

**KPIs calculados en cliente:**
| KPI | Fórmula | Descripción |
|---|---|---|
| CTR Exploración | `activity_click / page_view × 100` | % de usuarios que abren alguna actividad |
| Conversión a Fuente | `outbound_click / activity_view × 100` | Tasa de interés que lleva al proveedor |

**Tabla raw:** todos los eventos ordenados por volumen descendente — útil para detectar anomalías (spike en `page_view` sin `activity_click` = contenido no resonando).

## 🔄 CTR Feedback Loop (NUEVO v0.16.1-S44)

Los eventos acumulados en la BD se convierten en señales activas que gobiernan el sistema.

### `src/modules/analytics/metrics.ts`

Módulo que agrega eventos en CTR por dominio de fuente:

```typescript
getCTRByDomain(): Promise<Record<string, number>>
// Retorna: { "biblored.gov.co": 0.24, "idartes.gov.co": 0.18, ... }
```

**Flujo interno:**
1. `event.groupBy({ type: 'outbound_click', activityId: { not: null } })` — clicks por actividad
2. `event.groupBy({ type: 'activity_view', activityId: { not: null } })` — views por actividad
3. Join `activityId → Activity.sourceUrl → getDomainFromUrl()` — mapeo a dominio
4. Agrega clicks y views por dominio → CTR = clicks / views
5. Cache TTL 5min en memoria — 0 queries repetidas en el mismo ciclo
6. Fail-safe: retorna `{}` ante cualquier error de BD

**`ctrToBoost(ctr: number): number`** — convierte CTR en boost de ranking:

| CTR | Boost |
|-----|-------|
| > 0.30 | +0.15 |
| > 0.15 | +0.08 |
| > 0.05 | +0.03 |
| ≤ 0.05 | 0 |

### Impacto en el sistema

| Capa | Efecto |
|------|--------|
| **Ranking** | `computeActivityScore(act, health, ctrBoost)` — dominios con más conversión suben en listados |
| **Crawler** | `ingest-sources.ts` — `Math.min(healthPriority, ctrPriority)` — fuentes con mejor CTR se scrapean primero |

### Cold start behavior

Con 0 eventos (despliegue nuevo o reset de BD): `ctrMap = {}` → todos los dominios usan `ctr = 0` → boost = 0 → comportamiento idéntico al sistema previo. Sin riesgo de regresión.

### Señales a monitorear

```json
{ "event": "ranking_applied", "ctrDomainsActive": 5 }
{ "event": "ctr_priority_applied", "domain": "biblored.gov.co", "ctr": 0.24, "priority": 1 }
```

**Evolución esperada de `ctrDomainsActive`:**
- Día 1: 0–2
- Día 3: 5–15
- Día 7: crecimiento sostenido

### Próximo paso (cuando haya ~1000+ eventos)

Aplicar suavizado de Laplace en `getCTRByDomain()` para evitar CTR inflado con pocos datos:
```typescript
result[domain] = clicks / (views + 5); // Laplace smoothing
```
