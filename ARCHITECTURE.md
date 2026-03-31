# Infantia — Arquitectura del Sistema

> Versión: v0.8.1+ | Actualizado: 2026-03-31
> Documento vivo — se actualiza con cada versión mayor.

---

## 1. Visión General

**Infantia** es un agregador multi-fuente de actividades para niños y familias en Bogotá (con visión de expansión a otras ciudades de Colombia y Latinoamérica). Resuelve el problema de la información fragmentada: talleres, eventos, clubes y cursos están dispersos entre sitios web institucionales, redes sociales, grupos de mensajería y academias privadas.

**Problema central:** Los padres y cuidadores pierden tiempo buscando en múltiples fuentes sin garantía de que la información esté actualizada.

**Solución:** Motor de scraping multi-fuente con NLP (Gemini 2.5 Flash) que normaliza, deduplica y clasifica actividades en una plataforma unificada.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión | Notas |
|---|---|---|---|
| Framework web | Next.js (App Router) | 16.1.6 | SSR + RSC |
| Lenguaje | TypeScript | ^5 | Strict mode |
| UI | Tailwind CSS | v4 | Sin componentes externos |
| Base de datos | PostgreSQL (Supabase) | — | Hosted en AWS |
| ORM | Prisma | 7.5.0 | Adapter `@prisma/adapter-pg` |
| Autenticación | Supabase Auth | ^2.99 | JWT + SSR cookies |
| NLP / IA | Gemini 2.5 Flash | ^0.24.1 | Via `@google/generative-ai` |
| Scraping estático | Cheerio | ^1.2.0 | Sitios con SSR/HTML estático |
| Scraping dinámico | Playwright | ^1.58.2 | Instagram y SPAs |
| Email | Resend + react-email | ^6.9.4 | Transaccional |
| Validación | Zod | ^4.3.6 | Schemas runtime |
| Tests | Vitest | ^4.1.0 | + @vitest/coverage-v8 |
| Cola | BullMQ + Upstash Redis | — | Jobs de scraping asincrono |
| Geocoding | venue-dictionary.ts + Nominatim | — | 40+ venues Bogota ~0ms, sin API key |
| Proxy | IPRoyal (opcional) | — | IPs residenciales para Instagram/TikTok |
| Despliegue | Vercel | — | Crons integrados |
| CI/CD | GitHub → Vercel | — | Auto-deploy en push a master |

> **NLP:** El motor activo es **Gemini 2.5 Flash** (Google AI Studio). Existe `claude.analyzer.ts` como alternativa futura con la API de Anthropic, pero no está en uso en producción.

---

## 3. Estructura de Directorios

```
infantia/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── page.tsx                # Home — landing con contador y categorías
│   │   ├── actividades/            # Listado con filtros facetados
│   │   ├── login/                  # Autenticación (Supabase Auth)
│   │   ├── registro/               # Registro con email de bienvenida
│   │   ├── perfil/                 # Perfil de usuario, hijos, favoritos, notificaciones, historial
│   │   ├── admin/                  # Panel interno (logs de scraping, fuentes)
│   │   ├── contacto/               # Formulario de contacto
│   │   ├── contribuir/             # Página para proveedores
│   │   ├── privacidad/             # Política de privacidad
│   │   ├── terminos/               # Términos de uso
│   │   ├── tratamiento-datos/      # Aviso de tratamiento (Ley 1581)
│   │   └── api/
│   │       ├── activities/         # CRUD de actividades
│   │       │   └── [id]/
│   │       │       └── ratings/    # Calificaciones por actividad
│   │       ├── favorites/          # Favoritos del usuario
│   │       │   └── [activityId]/
│   │       ├── ratings/            # Calificaciones globales
│   │       │   └── [activityId]/
│   │       ├── children/           # Hijos/perfiles de menores
│   │       │   └── [id]/
│   │       ├── profile/            # Perfil del usuario autenticado
│   │       │   ├── avatar/
│   │       │   └── notifications/
│   │       ├── auth/
│   │       │   └── send-welcome/   # Email de bienvenida post-registro
│   │       └── admin/
│   │           ├── expire-activities/     # Marcar actividades vencidas
│   │           ├── send-notifications/    # Envío masivo de notificaciones
│   │           ├── sponsors/              # CRUD de sponsors newsletter (NUEVO v0.8.1)
│   │           │   └── [id]/             # PATCH / DELETE por id
│   │           ├── queue/                 # Estado y encolado de jobs BullMQ
│   │           └── scraping/
│   │               ├── sources/           # CRUD de fuentes de scraping
│   │               └── logs/              # Historial de ejecuciones
│   │
│   ├── modules/                    # Lógica de negocio por dominio
│   │   ├── activities/             # Servicio + schemas de actividades
│   │   ├── providers/              # Proveedores de actividades
│   │   ├── scraping/               # Motor de scraping completo
│   │   ├── search/                 # Búsqueda (stub — Meilisearch pendiente)
│   │   ├── users/                  # Gestión de usuarios
│   │   └── verticals/              # Verticales del negocio
│   │
│   ├── lib/                        # Utilidades compartidas
│   │   ├── db.ts                   # Singleton de PrismaClient
│   │   ├── auth.ts                 # Helpers de Supabase Auth (getSession, requireRole)
│   │   ├── api-response.ts         # Formato estándar de respuesta API
│   │   ├── validation.ts           # Validaciones comunes con Zod
│   │   ├── utils.ts                # Utilidades generales
│   │   ├── category-utils.ts       # Emojis y helpers de categorías
│   │   ├── activity-url.ts         # URLs canónicas: slugifyTitle, activityPath, extractActivityId
│   │   ├── venue-dictionary.ts     # 40+ venues Bogotá con coords exactas — lookupVenue() ~0ms (NUEVO v0.8.1)
│   │   ├── geocoding.ts            # venue-dictionary → Nominatim → cityFallback → null
│   │   ├── expire-activities.ts    # Lógica de expiración de actividades
│   │   ├── email/                  # Templates react-email con UTM tracking + bloque sponsor
│   │   └── supabase/               # Clientes SSR de Supabase
│   │
│   ├── generated/
│   │   └── prisma/                 # Cliente Prisma generado (no en git)
│   │
│   └── types/                      # Tipos globales de TypeScript
│
├── scripts/                        # Scripts de mantenimiento y scraping
│   ├── ingest-sources.ts           # Ingesta multi-fuente (--save-db / --queue / --dry-run)
│   ├── run-worker.ts               # Worker BullMQ (procesa jobs de scraping)
│   ├── test-scraper.ts             # CLI scraping web (--discover, --save-db, --max-pages)
│   ├── test-instagram.ts           # CLI scraping Instagram (--save-db, --max-posts)
│   ├── ig-login.ts                 # Login manual Instagram → genera ig-session.json
│   ├── backfill-geocoding.ts       # Geocodifica locations con coords 0,0 (NUEVO v0.8.1)
│   ├── backfill-images.ts          # Extrae og:image de sourceUrl para actividades sin imagen
│   ├── migrate-premium.ts          # DDL: isPremium/premiumSince en Provider (raw SQL)
│   ├── migrate-sponsors.ts         # DDL: tabla sponsors (raw SQL)
│   ├── promote-admin.ts            # Da rol ADMIN a un usuario
│   ├── verify-db.ts                # Reporte de estado de la BD
│   ├── reclassify-audience.ts      # Reclasifica audiencias con Gemini
│   ├── expire-activities.ts        # Marca actividades vencidas manualmente
│   ├── clean-queue.ts              # Limpia jobs BullMQ acumulados
│   ├── seed-scraping-sources.ts    # Seed de fuentes de scraping
│   ├── generate_v19.mjs            # Genera Documento Fundacional V19 (.docx)
│   └── generate_v20.mjs            # Genera Documento Fundacional V20 (.docx)
│
├── prisma/
│   ├── schema.prisma               # Fuente de verdad del modelo de datos
│   └── prisma.config.ts            # DATABASE_URL desde .env (NO en schema.prisma)
├── docs/
│   └── modules/                    # Documentación funcional por módulo
├── data/
│   ├── scraping-cache.json         # Cache incremental de URLs scrapeadas (~274 URLs)
│   └── ig-session.json             # Sesión de Instagram — NO está en git
├── DEDUPLICATION-STRATEGY.md       # Estrategia completa de deduplicación
└── .agents/
    └── workflows/
        └── project-safety-check.md # Verificación anti-contaminación entre proyectos
```

---

## 4. Modelo de Datos

### Diagrama de relaciones

```
Vertical ──┬── Category ──── ActivityCategory ──┐
           │                                    │
           └── ScrapingSource ── ScrapingLog    │
                                                ▼
City ── Location ──────────────────────── Activity ──┬── Favorite ── User ── Child
                    Provider ──────────────────────┘ │
                                                     └── Rating ── User
```

### Entidades

| Entidad | Propósito |
|---|---|
| `Activity` | Actividad normalizada (título, descripción, fechas, precio, audiencia, tipo, fuente, confianza) |
| `Provider` | Academia, institución o persona que ofrece la actividad. Soporta website e Instagram |
| `User` | Usuario registrado (padre, proveedor, moderador, admin) |
| `Child` | Perfil de menor a cargo del usuario — con consentimiento parental explícito (Ley 1581) |
| `Location` | Ubicación física con coordenadas lat/lng |
| `City` | Ciudad con moneda, timezone y país. Preparado para multi-país sin hardcodear |
| `Vertical` | Segmento de negocio (ej: `kids-family`). Configurable por JSON, no por código |
| `Category` | Taxonomía jerárquica de actividades (árbol con `parentId`) |
| `ActivityCategory` | Relación N:M actividad ↔ categoría |
| `Favorite` | Actividades guardadas por un usuario |
| `Rating` | Calificación 1-5 + comentario (una por usuario por actividad) |
| `ScrapingSource` | Fuente configurada: URL, plataforma, cron, estado del último run |
| `ScrapingLog` | Registro histórico de cada ejecución de scraping |

### Enums clave

```typescript
ActivityAudience  → KIDS | FAMILY | ADULTS | ALL
ActivityType      → RECURRING | ONE_TIME | CAMP | WORKSHOP
ActivityStatus    → ACTIVE | PAUSED | EXPIRED | DRAFT
PricePeriod       → PER_SESSION | MONTHLY | TOTAL | FREE
ScrapingPlatform  → WEBSITE | INSTAGRAM | FACEBOOK | TELEGRAM | TIKTOK | X | WHATSAPP
UserRole          → PARENT | PROVIDER | MODERATOR | ADMIN
ProviderType      → ACADEMY | INDEPENDENT | INSTITUTION | GOVERNMENT
```

---

## 5. Módulo de Scraping

El motor de scraping es el núcleo diferenciador de Infantia. Extrae actividades de múltiples fuentes, las normaliza con IA y las persiste con deduplicación automática.

### Archivos del módulo

```
src/modules/scraping/
├── types.ts                    # Contratos de datos del módulo
├── pipeline.ts                 # Orquestador: runBatchPipeline, runInstagramPipeline
├── storage.ts                  # Persistencia en BD con deduplicación Nivel 1
├── cache.ts                    # Cache incremental en data/scraping-cache.json
├── logger.ts                   # Registro en ScrapingLog
├── deduplication.ts            # Jaccard, fingerprint SHA-256, isProbablyDuplicate
├── index.ts                    # Re-exportaciones públicas
├── extractors/
│   ├── cheerio.extractor.ts    # Sitios estáticos + paginación automática
│   └── playwright.extractor.ts # Instagram con Chromium headless + sesión persistente
└── nlp/
    ├── gemini.analyzer.ts      # Motor NLP activo (Gemini 2.5 Flash)
    └── claude.analyzer.ts      # Alternativa futura (API Anthropic — no activo)
```

### Flujo — Scraping Web

```
URL semilla
    │
    ▼
CheerioExtractor.extractLinksAllPages(baseUrl, maxPages)
    ├─ Extrae JSON-LD estructurado (Event/Article) ANTES de limpiar scripts
    ├─ Extrae todos los <a href> del mismo dominio
    └─ Paginación automática: busca "Siguiente / Next / › / »" o ?page=N+1
    │
    ▼
GeminiAnalyzer.discoverActivityLinks(links)
    ├─ Divide en chunks de 50 (evita truncamiento de Gemini)
    └─ Retorna índices de links identificados como actividades
    │
    ▼
ScrapingCache.filterNew()  ← omite URLs ya procesadas
    │
    ▼
GeminiAnalyzer.analyze(sourceText, url)   [concurrencia: 3]
    ├─ Trunca a 15,000 chars
    ├─ Llama Gemini con responseMimeType: 'application/json'
    ├─ Valida con Zod (ActivityNLPResult)
    └─ Retry x3 con backoff exponencial (errores 429 / 503)
    │
    ▼
ScrapingStorage.saveActivity()
    ├─ Deduplicación Nivel 1: similitud Jaccard >75% + ventana ±30 días
    ├─ Crea / reutiliza Provider por hostname
    ├─ Mapea categorías de Gemini a categorías existentes en BD
    └─ Upsert Activity (sourceUrl como clave)
    │
    ▼
ScrapingCache.save() + ScrapingLogger.completeRun()
```

### Flujo — Scraping Instagram

```
URL de perfil (https://www.instagram.com/@cuenta/)
    │
    ▼
PlaywrightExtractor.extractProfile(profileUrl, maxPosts)
    ├─ Chromium headless, desktop UA (Chrome/122), viewport 1280x800, locale es-CO
    ├─ Carga sesión desde data/ig-session.json (cookies persistentes)
    ├─ waitUntil: 'domcontentloaded' + espera fija 4-6s (NO networkidle)
    ├─ Descarta popup de login ("Not Now" / "Ahora no")
    ├─ Extrae: bio (og:description), follower count, URLs de posts del grid
    └─ Por cada post: caption (3 estrategias en cascada), imágenes, timestamp, likes
    │
    ▼
ScrapingCache.filterNew()
    │
    ▼
GeminiAnalyzer.analyzeInstagramPost(post, bio)   [SECUENCIAL — evita rate limiting]
    └─ INSTAGRAM_SYSTEM_PROMPT: hashtags y emojis como señales de clasificación
    │
    ▼
ScrapingStorage.saveActivity()
    └─ Provider con campo instagram = @username
```

### Paginación web — estrategias implementadas

1. Busca `<a>` con texto: `siguiente`, `next`, `›`, `»`, `>>`
2. Busca `<a href>` con parámetro `?page=N+1`

### Fuentes activas (al 2026-03-24)

| Fuente | Extractor | Páginas recorridas | Actividades |
|---|---|---|---|
| `biblored.gov.co/eventos` | Cheerio + Gemini | 19 | 167 |
| `bogota.gov.co` | Cheerio + Gemini | — | 21 |
| `@fcecolombia` | Playwright (Instagram) | — | 10 |
| `@quehaypahacerenbogota` | Playwright (Instagram) | — | 2 |
| CEFEs / culturarecreacionydeporte.gov.co | Script manual | — | ~11 |
| Idartes | — | — | ❌ Pendiente |
| Jardín Botánico | — | — | ❌ Pendiente |

**Total en BD: ~211 actividades únicas**

---

## 6. Búsqueda Full-Text

La búsqueda de actividades usa **PostgreSQL pg_trgm** (trigram similarity) para tolerancia a errores tipográficos.

### Implementación
- **Extensión:** `pg_trgm` activa en Supabase
- **Índices GIN:** en `activities.title` y `activities.description`
- **Lógica:** `activities.service.ts` → `prisma.$queryRaw` con ILIKE + `similarity() > 0.2`
- **Flujo:** raw query obtiene IDs coincidentes → Prisma filtra por esos IDs con todos los demás filtros activos

### Ejemplo
- "taeatro" → encuentra "teatro"
- "natcion" → encuentra "natación"
- "biblored" → encuentra actividades de BibloRed

### Por qué no Meilisearch
Con 211 actividades, `pg_trgm` es suficiente y gratuito (usa Supabase ya existente). Meilisearch evaluable cuando haya 2000+ actividades o se necesite ranking avanzado.

---

## 7. Sistema de Deduplicación (3 Niveles)

### Nivel 1 — Real-time (en `storage.ts`)
Antes de guardar cada actividad, busca en las últimas 100 de la BD:
- **Criterio:** similitud Jaccard >75% sobre palabras del título + fechas en ventana ±30 días
- **Acción:** si hay match, reutiliza el ID existente (no crea duplicado)

### Nivel 2 — Validación diaria automatizada (`daily-dedup-check.ts`)
Cron en Vercel: `15 2 * * *` (2:15 AM UTC)
- Duplicados exactos (100% por título normalizado) → **eliminación automática**
- Similares 70-90% → **reporte para revisión manual**, no se eliminan

### Nivel 3 — Revisión manual
Para pares 70-90%: verificar fechas, ubicación y fuente.
Ejemplo legítimo: "Salones de baile: Ritmos folclóricos - Chapinero" vs "- Fontanar" → actividades distintas, mantener ambas.
Decisiones se registran en `DEDUP-LOG.md`.

### Umbrales por fuente

| Fuente | Propensión a duplicados | Umbral de revisión |
|---|---|---|
| BibloRed | Alta | 80% |
| Centro Felicidad / CEFEs | Media | 75% (diferenciadas por localidad) |
| Bogotá.gov.co | Baja | 70% (revisión manual) |

---

## 8. Autenticación y Cumplimiento Legal

### Autenticación
- **Motor:** Supabase Auth (JWT con cookies SSR via `@supabase/ssr`)
- **Flujo:** formulario → Supabase → email de confirmación → callback → email de bienvenida (Resend)
- **Roles:** `PARENT | PROVIDER | MODERATOR | ADMIN`

### Menores de edad (Ley 1581 de 2012)
El modelo `Child` almacena consentimiento parental explícito:
- `consentGivenAt` — fecha exacta del consentimiento
- `consentGivenBy` — userId del padre/tutor
- `consentText` — texto exacto mostrado en el momento

### Transferencia internacional de datos
- Supabase Inc. (AWS, EEUU) — SOC 2 Type II, AES-256
- Vercel Inc. (EEUU) — SOC 2 Type II
- Registrado en RNBD (SIC Colombia) — trámite en `infantia.co/tratamiento-datos`

---

## 9. API REST

Todas las rutas bajo `/api/`. Respuestas estandarizadas por `lib/api-response.ts`.

### Actividades
| Método | Ruta | Auth |
|---|---|---|
| `GET` | `/api/activities` | Pública |
| `POST` | `/api/activities` | Admin |
| `GET/PUT/DELETE` | `/api/activities/[id]` | Mixto |
| `GET/POST` | `/api/activities/[id]/ratings` | Usuario |

**Filtros GET `/api/activities`:** `page`, `pageSize`, `verticalId`, `categoryId`, `cityId`, `ageMin`, `ageMax` (0-120), `priceMin`, `priceMax`, `status`, `type`, `audience`, `search`

### Perfil y familia
| Método | Ruta |
|---|---|
| `GET/PUT` | `/api/profile` |
| `PUT` | `/api/profile/avatar` |
| `GET/PUT` | `/api/profile/notifications` |
| `GET/POST` | `/api/children` |
| `GET/PUT/DELETE` | `/api/children/[id]` |

### Interacciones
| Método | Ruta |
|---|---|
| `GET` | `/api/favorites` |
| `POST/DELETE` | `/api/favorites/[activityId]` |
| `GET` | `/api/ratings` |
| `POST` | `/api/ratings/[activityId]` |

### Admin
| Método | Ruta |
|---|---|
| `POST` | `/api/auth/send-welcome` |
| `POST` | `/api/admin/expire-activities` |
| `POST` | `/api/admin/send-notifications` |
| `GET` | `/api/admin/scraping/sources` |
| `GET` | `/api/admin/scraping/logs` |

---

## 10. Despliegue

- **Plataforma:** Vercel (auto-deploy en push a `master`)
- **DB:** Supabase PostgreSQL (AWS us-east-1, proyecto `vjfhlrpfubbfnvpthwym`)
- **Dominio objetivo:** `infantia.co` (pendiente de configurar en Vercel)
- **Crons Vercel:** deduplicación diaria — `15 2 * * *`

### Variables de entorno requeridas

```env
DATABASE_URL                    # PostgreSQL Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY                  # Google AI Studio
RESEND_API_KEY                  # Email transaccional
CRON_SECRET                     # Autenticación de crons Vercel
```

### Comandos

```bash
npm run dev       # Desarrollo (Turbopack)
npm run build     # prisma generate + next build
npm test          # Vitest
npm run test:coverage
```

---

## 11. Testing

### Unit tests (Vitest)
- **Framework:** Vitest + @vitest/coverage-v8
- **Estado actual:** 402 tests, 28 archivos, 0 fallos
- **Cobertura:** ~95% statements / ~88% branch / ~84% functions / ~96% lines
- **Threshold dinámico:** +10%/día desde 2026-03-16 (configurado en `vitest.config.ts`)
- **Módulos al 100%:** `lib/utils`, `lib/validation`, `scraping/cache`, `scraping/types`, `activities/schemas`, `activities/service`
- **Gap justificado:** `playwright.extractor.ts` (~42% functions) — callbacks de browser no testeables en unit tests

**Patrón crítico para mocks:**
```typescript
// Usar vi.hoisted() para mock functions en factories de vi.mock()
const mockFn = vi.hoisted(() => vi.fn());
vi.mock('./module', () => ({ fn: mockFn }));
```

### E2E tests (Playwright)
- **Framework:** @playwright/test ^1.58.2
- **Estado actual:** 19 tests, 3 archivos, 0 fallos
- **Proyectos configurados:**
  - `setup` — login inicial, guarda sesión en `e2e/.auth/user.json`
  - `sin-auth` — tests sin sesión (auth, filtros, favorito sin login)
  - `con-auth` — tests con sesión (agregar/quitar favorito, perfil)
- **Archivos:**
  - `e2e/auth.spec.ts` — login/registro (formularios, validaciones, errores)
  - `e2e/actividades.spec.ts` — búsqueda, filtros, paginación
  - `e2e/favoritos.auth.spec.ts` — favoritos sin y con autenticación
- **Comandos:** `npm run test:e2e` / `npm run test:e2e:ui` / `npm run test:e2e:report`
- **Requiere:** servidor dev corriendo + `.env.e2e` con credenciales de usuario de prueba

---

## 12. UI/UX — Patrones Implementados

### Filtros facetados (`/actividades`)
- **Layout**: dos filas en desktop (búsqueda+edad+audiencia / tipo+categoría+limpiar), vertical en mobile
- **Counts**: cada opción muestra cantidad de resultados (facetado completo — cada filtro excluye su propia dimensión)
- **Active state**: filtro activo tiene `border-indigo-400 bg-indigo-50 text-indigo-700 font-medium` (helper `selectCls()`)
- **Sin "No disponible"**: contador no muestra "(con filtros activos)" — el botón "Limpiar" ya indica que hay filtros

### Tarjetas de actividad (`/actividades`)
- **Ordenamiento**: ACTIVE primero, EXPIRED al final
- **Strip visual**: h-20 con imagen real o emoji placeholder
- **Badges**: solo si hay información (oculta "No disponible")
- **Contador**: cada tarjeta ahora muestra el conteo de la fuente

### Detalle de actividad (`/actividades/[id]`)
- **Con imagen**: hero h-48/h-64 con badges overlay
- **Sin imagen**: encabezado compacto (~44px) con fondo de categoría y badges inline — el título aparece inmediatamente (no desperdiciar espacio con placeholders gigantes)
- **Badges precio**: solo si hay información real

### Componentes
- **UserMenu**: dropdown con click-outside detection, contiene "Mi perfil", "Mis favoritos", separator, "Salir" y enlace admin condicional
- **Header**: UserMenu reemplazó avatar + links dispersos

## 14. Decisiones de Arquitectura

| Decisión | Razón |
|---|---|
| Gemini 2.5 Flash como NLP (no Claude API) | Mayor cuota gratuita, menor costo en producción |
| Cheerio para web estática | Playwright es lento y pesado; Cheerio suficiente para HTML SSR |
| Playwright solo para Instagram | Graph API de Instagram requiere permisos difíciles de obtener |
| Cache incremental en JSON (no Redis) | Sin infraestructura adicional para el MVP |
| Multi-vertical por config JSON | Permite nuevas verticales sin deploy de código |
| Supabase Auth (no NextAuth) | Integración nativa con PostgreSQL, sin tablas adicionales |
| Prisma 7 con adapter-pg | Prisma 7 requiere adapter explícito para conexión directa a PostgreSQL |
| `DATABASE_URL` en `prisma.config.ts` (no en `schema.prisma`) | Requisito de Prisma 7 |
| `getOrCreateDbUser()` con upsert | Garantiza DB record en primer acceso, sin "Usuario no encontrado" |
| Encabezados compactos sin imagen | Respeta el tiempo del usuario — si no hay contenido visual real, no mostrar placeholder |

---

## 15. Roadmap Técnico Pendiente

### Corto plazo
- [ ] Idartes y Jardín Botánico como fuentes activas
- [x] Tests E2E con Playwright (autenticación, filtros, favoritos) — 19 tests
- [x] Búsqueda fuzzy con pg_trgm (reemplaza ILIKE básico)
- [x] Git tags v0.2.0–v0.5.0 creados y pusheados
- [x] CHANGELOG completo para versiones v0.2.0–v0.5.0
- [x] UserMenu component con dropdown
- [x] Dos filas de filtros en /actividades (búsqueda ancha en desktop)
- [x] Filtro visual active state (border indigo + bg)
- [x] Counts en todas las opciones de filtro
- [x] Encabezados compactos en detalle sin imagen
- [x] Ocultar badges "No disponible" en tarjetas y detalle
- [x] Ordenar ACTIVE antes de EXPIRED en listado
- [x] getOrCreateDbUser() en auth callback + páginas de perfil
- [x] Auditoría de pruebas generales (home, /actividades, detalle, auth, mobile)

### Mediano plazo
- [ ] BullMQ + Redis para colas de scraping asíncronas
- [ ] Proxy rotation para anti-blocking
- [ ] Geocodificación automática de direcciones
- [ ] Segunda vertical (ej: adultos mayores)

### Largo plazo
- [ ] Facebook Graph API y Telegram Bot API como fuentes
- [ ] Expansión a Medellín y Cali
- [ ] Modelo de monetización (pendiente de definir)

---

## 14. Separación de Proyectos

El mismo desarrollador mantiene dos proyectos independientes. En el pasado hubo contaminación cruzada (archivos de Habit Challenge en el repo de Infantia). Verificar al inicio de cada sesión:

| Proyecto | Directorio | DB | NLP activo |
|---|---|---|---|
| **Infantia** | `C:\Users\denys\Projects\infantia` | PostgreSQL (Supabase) | Gemini 2.5 Flash |
| **Habit Challenge** | `C:\Users\denys\Projects\habit-challenge` | SQLite | Claude API |

**Señales de contaminación:**
- `provider = "sqlite"` en `prisma/schema.prisma` → archivo de Habit Challenge
- `"name": "habit-challenge"` en `package.json` → directorio equivocado
- `DATABASE_URL="file:./dev.db"` en `.env` → configuración de Habit Challenge

Ver `.agents/workflows/project-safety-check.md` para el checklist completo de verificación.
