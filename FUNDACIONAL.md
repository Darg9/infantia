# HABITAPLAN — DOCUMENTO FUNDACIONAL V28
> Generado por el script V28. Actualizado: 2026-04-25.


# 1. VISION Y PROBLEMA

Las familias con ninos pasan horas buscando actividades en fuentes fragmentadas: sitios web institucionales, Instagram, grupos de WhatsApp, Facebook, Telegram. No existe un lugar centralizado que agregue, normalice y filtre esta informacion.

**La Solucion**: HabitaPlan es un agregador multi-fuente con normalizacion inteligente que centraliza actividades y eventos para ninos, jovenes y familias en ciudades colombianas, con expansion a LATAM.

**Nombre**: HabitaPlan (rebrand desde Infantia, 2026-04-24)

**Dominio**: habitaplan.com — DNS apuntado a Vercel, activo en produccion

**Owner**: Denys Reyes (padre de una hija de 10 anos)

**Inicio del proyecto**: 24 de abril de 2026


# 2. PROPUESTA DE VALOR

Para familias: Un solo lugar para descubrir todas las actividades disponibles para sus hijos, con filtros por edad, precio, ubicacion, audiencia y categoria.

Para proveedores: Visibilidad gratuita, dashboard de metricas y herramientas para gestionar su oferta.

Para anunciantes: Acceso a familias activas via newsletter y listings destacados (modelo de monetizacion implementado).

Para la plataforma: Datos propietarios de demanda de actividades en LATAM.

| Diferenciador | Descripcion |
| --- | --- |
| Agregacion multi-fuente | Web + Instagram + Telegram + Facebook (canal tipificado) — Bogota + Medellin activos |
| Normalizacion inteligente | NLP con Gemini 2.5 Flash + Cheerio fallback — datos estructurados desde fuentes heterogeneas |
| Parser Resiliente (NUEVO V24) | Si Gemini no disponible (429/503), fallback automatico a Cheerio — 0 actividades perdidas por cuota |
| Multi-vertical por config | Ninos, mascotas, adultos mayores — nuevas verticales = registros en BD, sin codigo nuevo |
| Multi-ciudad desde dia 1 | Bogota + Medellin activos — expansion LATAM por configuracion |
| Geocoding curado | venue-dictionary.ts con 40+ venues Bogota — coords exactas sin API call (~0ms) |
| Date Preflight 3 capas (NUEVO V24) | Filtro pre-Gemini: datetime HTML → texto → keywords. Ahorra cuota en eventos pasados. |
| Monetizacion integrada | Sponsors newsletter + listings premium + /anunciate landing — implementado desde mes 0 |
| Design System enforced (NUEVO V24) | ESLint bloquea alert()/prompt()/libr. externas. useToast() UNICO metodo de feedback |
| Intent Manager (NUEVO V24) | Acciones pre-autenticacion preservadas — post-login se ejecutan automaticamente |
| Observabilidad completa | Logger estructurado, Sentry, /api/health, UptimeRobot, Date Preflight metrics en BD |
| CTR Feedback Loop (NUEVO V24) | Clicks de usuarios retroalimentan rankingScore — ranking adaptativo en tiempo real |
| Analytics propios zero-dep (NUEVO V24) | window.__hp_analytics — sin Google Analytics, sin cookies de terceros, GDPR-safe |
| Legal SSOT (NUEVO V24) | PDFs de Terminos/Privacidad/Tratamiento generados con react-pdf desde fuente unica |


# 3. STACK TECNOLOGICO

| Capa | Tecnologia |
| --- | --- |
| Framework | Next.js 16.2.1 (App Router) + TypeScript strict |
| Estilos | Tailwind CSS + clsx — Design System tokens en src/lib/design-tokens.ts |
| Base de datos | PostgreSQL via Supabase (Free Tier) |
| ORM | Prisma 7 con adapter-pg (PrismaClient con PrismaPg) |
| Search engine | pg_trgm (similarity + word_similarity + GIN indexes) — activo en produccion (NUEVO V24) |
| Autenticacion | Supabase Auth (SSR cookies, middleware) |
| Scraping web | Cheerio (HTML) + Playwright (JS-heavy / Instagram) + Proxy residencial (IPRoyal) |
| AI / NLP | Gemini 2.5 Flash (Google AI Studio, 20 RPD free tier) + fallback Cheerio (NUEVO V24) |
| Email | Resend + react-email templates (UTM tracking + bloque sponsor) |
| Cola de tareas | BullMQ + Upstash Redis (rediss:// TLS, Free Tier) + Cron scheduler 6h (NUEVO V24) |
| Busqueda | pg_trgm activo — Meilisearch Cloud free tier cuando +1.000 actividades |
| Mapas | Leaflet 1.9.4 + OpenStreetMap (sin API key) |
| Geocoding | Nominatim + venue-dictionary.ts curado (40+ venues, sin API key, ~0ms) |
| Legal docs | react-pdf — generacion de PDFs desde fuente unica SSOT (NUEVO V24) |
| Analytics | window.__hp_analytics — zero-dep, sin cookies terceros, GDPR-safe (NUEVO V24) |
| Logger | createLogger(ctx) en src/lib/logger.ts — formato estructurado + Sentry integration |
| Error tracking | Sentry (@sentry/nextjs) — activo si SENTRY_DSN en env |
| ESLint | Reglas custom: no-alert, no-restricted-imports (NUEVO V24) — bloquea libr. externas |
| Hosting | Vercel (frontend + API) + Railway (workers, futuro) |
| CI/CD | GitHub Actions — tests + build + smoke CI en cada push a master (NUEVO V24) |
| Almacenamiento | Supabase Storage (avatares de usuario) |
| Pagos | Wompi (Colombia) — pendiente mes 6, primer cliente y cuenta bancaria activa |


# 4. ARQUITECTURA DEL SISTEMA


## 4.1 Estructura de directorios

| Directorio / Archivo | Contenido |
| --- | --- |
| src/app/ | Next.js App Router — paginas, layouts, rutas API |
| src/app/api/health/ | GET /api/health — check DB + Redis en tiempo real |
| src/app/admin/ | Panel admin: actividades, metricas, scraping, sponsors, quality |
| src/app/admin/quality/ | Dashboard calidad NLP — metricas Date Preflight, parser resiliente (NUEVO V24) |
| src/app/admin/sources/ | CRUD fuentes scraping en BD + toggle activar/desactivar (NUEVO V24) |
| src/app/legal/ | Centro de Seguridad Legal — PDFs react-pdf desde SSOT (NUEVO V24) |
| src/app/proveedores/[slug]/dashboard/ | Dashboard de proveedor — ADMIN o dueno (email + isClaimed) |
| src/app/anunciate/ | Landing de monetizacion para sponsors y proveedores |
| src/middleware.ts | Middleware global Next.js — protege /api/admin/* automaticamente |
| src/modules/ | Modulos de dominio: activities, providers, scraping, favorites, etc. |
| src/modules/scraping/parser/ | parser.ts orchestrator + fallback-mapper.ts Cheerio (NUEVO V24) |
| src/modules/scraping/utils/date-preflight.ts | Filtro pre-Gemini 3 capas (NUEVO V24) |
| src/modules/scraping/utils/preflight-db.ts | Persistencia metricas date_preflight_logs (NUEVO V24) |
| src/modules/scraping/nlp/url-classifier.ts | Clasificador URL pre-Gemini: activity/listing/other (NUEVO V24) |
| src/modules/favorites/toggle-favorite.ts | Servicio HTTP para toggle favorito — desacoplado de UI (NUEVO V24) |
| src/lib/intent-manager.ts | Intent Manager — localStorage hp_intent, TTL 15min (NUEVO V24) |
| src/lib/require-auth.ts | requireAuth() — UNICO punto de auth pre-accion (NUEVO V24) |
| src/components/IntentResolver.tsx | Resuelve intents post-login — montado globalmente en layout (NUEVO V24) |
| src/components/ui/toast.tsx | useToast() — UNICO metodo de feedback en Design System (NUEVO V24) |
| src/lib/logger.ts | createLogger(ctx) — logger estructurado universal + Sentry |
| src/lib/geocoding.ts | venue-dictionary → Nominatim → cityFallback → null |
| src/lib/ratings.ts | recalcProviderRating() — ratingAvg/Count siempre actualizados |
| src/lib/analytics.ts | window.__hp_analytics — tracking zero-dep GDPR-safe (NUEVO V24) |
| src/lib/design-tokens.ts | Tokens de Design System — colores, tamanios, radios (NUEVO V24) |
| scripts/ingest-sources.ts | Ingesta multi-fuente con canales (--channel/--source/--list) |
| scripts/source-pause-manager.ts | Auto-pause de fuentes por score bajo (NUEVO V24) |
| prisma/ | Schema de BD y migraciones |


## 4.2 Principios arquitecturales

- Multi-vertical por configuracion: nuevas verticales = registros en BD, sin codigo nuevo.
- API-first: toda funcionalidad expuesta via endpoints REST en /api/.
- Event-driven: scraping asincrono via BullMQ — el worker procesa jobs en background.
- Multi-pais desde dia 1: ciudades, monedas y fuentes en BD — sin hardcoding.
- Parser resiliente: Gemini primario → si 429/503, fallback automatico a Cheerio — nunca falla por cuota.
- Design System enforced: ESLint bloquea alert()/prompt()/libr. externas. Toast global es el unico feedback.
- Intent Manager: requireAuth() en src/lib/require-auth.ts es el UNICO punto de auth pre-accion.
- Date Preflight: 3 capas (datetime HTML → texto → keywords/anos) filtran eventos pasados antes de consumir cuota Gemini.
- Los datos son el activo: normalizacion NLP convierte fuentes heterogeneas en modelo comun.
- Geocoding local primero: venue-dictionary.ts resuelve 40+ venues Bogota en ~0ms antes de llamar Nominatim.
- DDL via raw SQL: Supabase pgbouncer (transaction mode) es incompatible con prisma migrate dev — se usan scripts migrate-*.ts.
- Logger estructurado: createLogger(ctx) reemplaza todos los console.* — logs con timestamp + nivel + contexto.
- Middleware global de seguridad: src/middleware.ts protege /api/admin/* automaticamente.
- Analytics propios: window.__hp_analytics — sin dependencias externas, sin cookies de terceros, GDPR-safe.
- Cron scheduler integrado: Vercel Cron dispara BullMQ cada 6h para scraping automatico.

# 5. SEGURIDAD


## 5.1 Hallazgos y correcciones (Sprint S25)

| ID | Descripcion y Correccion |
| --- | --- |
| C-01 (Critico) | PUT/DELETE /api/activities/:id estaban sin autenticacion. Correccion: requireRole([ADMIN]) agregado. |
| C-02 (Critico) | CRON_SECRET tenia fallback inseguro '|| test-secret'. Correccion: eliminado fallback + check !cronSecret. |
| npm audit | 0 vulnerabilidades criticas. defu prototype pollution (S29) y Vite (S30) corregidos. 3 moderate dev-only aceptables. |


## 5.2 Design System — ESLint enforced (NUEVO V24 — S45/S53)

- ESLint reglas custom bloquean en build/CI:
- no-restricted-globals: alert(), confirm(), prompt() → error en compile time.
- no-restricted-imports: react-hot-toast, sonner, @radix-ui/toast y similares externos.
- useToast() de src/components/ui/toast.tsx es el UNICO metodo de feedback permitido.
- Resultado: feedback consistente en toda la UI, sin libr. externas adicionales.

## 5.3 Middleware global /api/admin/*

- src/middleware.ts: Sin sesion → 401 | Sin rol ADMIN → 403.
- Rutas cron en lista de excepciones — autenticadas via CRON_SECRET.
- Cualquier ruta /api/admin/* futura queda protegida automaticamente.

## 5.4 Security Headers (next.config.ts)

| Header | Proposito |
| --- | --- |
| Content-Security-Policy | Previene XSS — fuentes: Supabase, Google Fonts, OpenStreetMap, CDNs |
| X-Content-Type-Options: nosniff | Previene MIME sniffing |
| X-Frame-Options: SAMEORIGIN | Previene clickjacking |
| Strict-Transport-Security | Fuerza HTTPS 2 anos (preload) |
| Referrer-Policy: strict-origin-when-cross-origin | Controla datos en header Referer |
| Permissions-Policy | Deniega camera, microphone, geolocation |


# 6. OBSERVABILIDAD


## 6.1 Logger estructurado — createLogger(ctx)

- Archivo: src/lib/logger.ts — reemplaza todos los console.* en produccion.
- Formato: 2026-04-24T20:00:00Z INFO  [ctx] mensaje {"meta":"json"}
- log.error() captura a Sentry si SENTRY_DSN configurado — import dinamico, no bloquea el request.

## 6.2 Sentry + UptimeRobot

- Sentry activo — SENTRY_DSN en Vercel. tracesSampleRate 0.1 server / 0.05 client.
- UptimeRobot activo — monitoreando https://habitaplan.com/api/health.

## 6.3 Date Preflight — Metricas en BD (NUEVO V24 — S50)

- Tabla date_preflight_logs: decision (process|skip), razon, matchedText, timestamp por URL.
- Dashboard /admin/quality muestra distribucion en tiempo real.
- [DATE-PREFLIGHT:SUMMARY] al final de cada batch: total, sent_to_gemini, skip_rate.

## 6.4 Parser Resiliente — [PARSER:SUMMARY] (NUEVO V24 — S52)

- [PARSER:SUMMARY] al final de cada batch: gemini_ok, fallback_analyze_count, fallback_discover_count, fallback_rate.
- Feature flag PARSER_FALLBACK_ENABLED — desactivable sin deploy.

## 6.5 Smoke CI (NUEVO V24 — S48)

- GitHub Actions corre smoke tests en cada push: GET /api/health en staging, build check, lint.

# 7. MODELO DE DATOS


## 7.1 Entidades principales

| Entidad | Descripcion |
| --- | --- |
| Activity | Actividad: title, description, type, status, audience, price, imageUrl, sourceUrl, schedules (JSON), rankingScore |
| Provider | Proveedor: name, slug, type, isVerified, isClaimed, isPremium, premiumSince, ratingAvg, ratingCount |
| Sponsor | Patrocinador newsletter: name, tagline, logoUrl, url, isActive, campaignStart, campaignEnd |
| Location | Ubicacion: name, address, neighborhood, latitude, longitude, cityId |
| City | Ciudad: name, country, timezone |
| Category / ActivityCategory | Categoria + relacion N:M con Activity |
| Vertical | Vertical de mercado: name, slug (kids, mascotas, etc.) |
| User | Usuario: supabaseAuthId, name, email, role, avatarUrl, onboardingDone, city |
| Child | Perfil de hijo: name, birthDate, gender, consentGivenAt |
| Favorite (polimorf.) | NUEVO V24 — activityId? | locationId? con XOR CHECK constraint BD (S49+S51) |
| Rating | Calificacion 1-5 estrellas con comentario opcional |
| PushSubscription | Suscripcion Web Push: endpoint, p256dh, auth por usuario |
| ScrapingSource | Fuente de scraping: url, platform, scraperType, status — CRUD desde admin (NUEVO V24) |
| ScrapingLog | Log de ejecucion de scraping por fuente |
| ProviderClaim | Solicitud de reclamacion: providerId, userId, ClaimStatus enum, email notif (S29) |


## 7.2 Tablas de infraestructura / scraping

| Tabla | Proposito |
| --- | --- |
| scraping_cache | Cache dual disco+BD — url PK, title, source, scrapedAt |
| source_pause_config | Config auto-pause por fuente/ciudad: score, threshold, pausedAt |
| source_url_stats | Estadisticas URL classifier por fuente: activity/listing/other counts |
| date_preflight_logs | Metricas Date Preflight por URL: decision, razon, matchedText (NUEVO V24) |
| source_health | Salud de fuentes: successCount, errorCount, avgResponseMs, scoreHealth |


## 7.3 Integridad — Favorites XOR (NUEVO V24 — S51)

- CHECK constraint: (activityId IS NOT NULL) != (locationId IS NOT NULL) — un favorito apunta a exactamente una entidad.
- Aplicado via script migrate-favorites-xor.ts — idempotente.

# 8. PIPELINE DE SCRAPING


## 8.1 Flujo principal (Web)

| Paso | Descripcion |
| --- | --- |
| 1. Extraccion de links | CheerioExtractor.extractLinksAllPages() — paginacion automatica o sitemap XML |
| 2. URL Classifier pre-Gemini | NUEVO V24 — url-classifier.ts clasifica en activity/listing/other sin IA. Ahorra cuota. |
| 3. Filtrado IA (con fallback) | NUEVO V24 — discoverWithFallback(): Gemini primario. Si 429/503, pasa TODOS los URLs (conservador). |
| 4. Date Preflight 3 capas | NUEVO V24 — capa 1: <datetime> HTML; capa 2: texto (regex); capa 3: keywords/anos pasados. |
| 5. Cache + DB diff | ScrapingCache + diff contra activities BD — omite URLs ya procesadas. |
| 6. Extraccion de contenido | CheerioExtractor.extract() — HTML completo + JSON-LD + og:image |
| 7. Analisis NLP (con fallback) | NUEVO V24 — parseActivity(): Gemini primario → si 429/503 → fallbackFromCheerio(). |
| 8. fallbackFromCheerio() | NUEVO V24 — extrae titulo (og:title→<title>→<h1>), desc, precio desde HTML real. |
| 9. Enriquecimiento + Geocoding | og:image adjuntada; venue-dictionary → Nominatim → cityFallback. |
| 10. Persistencia | ScrapingStorage.saveActivity() — upsert por sourceUrl + dedup Jaccard >75%. |


## 8.2 Date Preflight — 3 capas (NUEVO V24 — S48b/c)

- Capa 1 (datetime HTML): busca <time datetime='...'> — maxima precision.
- Capa 2 (texto plano): patrones regex — '24 de abril de 2026', '15/03/2026'. Compara vs fecha actual.
- Capa 3 (keywords/anos): ano < 2026 junto a palabras clave ('taller 2024', 'conferencia 2023').
- skip=true: NLP omitido — ahorra 1 request Gemini por URL. matchedText guardado para auditoria.
- Metricas persisten en date_preflight_logs (fire-and-forget, no bloquea pipeline).

## 8.3 Parser Resiliente — Fallback Cheerio (NUEVO V24 — S52/S54)

- Fase Descubrimiento: discoverWithFallback() — si Gemini 429/503, pasa TODOS los URLs al pipeline.
- Fase Analisis: parseActivity() — si Gemini 429/503, llama fallbackFromCheerio(raw).
- fallbackFromCheerio: og:title → <title> → <h1> para titulo; og:description → primer parrafo para desc.
- Fix S54: pipeline.ts pasa HTML completo (no texto plano) a rawForFallback.html — extractTitle() funciona.
- Feature flag PARSER_FALLBACK_ENABLED — desactivable sin deploy.

## 8.4 Fuentes activas (2026-04-24)

| Fuente | Ciudad / Tipo / Estado |
| --- | --- |
| BibloRed (biblored.gov.co) | Bogota — Web — 150+ actividades |
| IDARTES (idartes.gov.co) | Bogota — Web — sitemap XML |
| FUGA — Filarmonica de Bogota | Bogota — Web — NUEVO V24 — pendiente ingest con Gemini |
| Bogota.gov.co / CRD | Bogota — Web — sitemap XML |
| Planetario de Bogota | Bogota — Web — sitemap XML |
| Cinemateca de Bogota | Bogota — Web — 14 actividades |
| Jardin Botanico (JBB) | Bogota — Web — 7 actividades |
| Banrep — 10 ciudades | Multi-ciudad — Web — sitemap XML |
| @biblored / @idartes / @planetariobogota | Bogota — Instagram — activos |
| @distritojovenbta / @festiencuentro | Bogota — Instagram — validados, pendiente ingest |
| @parqueexplora | Medellin — Instagram — NUEVO V24 — validado, pendiente ingest |
| @quehacerenmedellin | Medellin — Instagram — NUEVO V24 — validado, pendiente ingest |
| Parque Explora / Biblioteca Piloto | Medellin — Web — NUEVO V24 |
| @quehaypahacer (Telegram) | Bogota — Telegram MTProto — operativo, pendiente ingest sin --dry-run |


## 8.5 Cron Scheduler (NUEVO V24 — S47)

- Vercel Cron dispara POST /api/admin/scraping/cron cada 6 horas.
- Encola un BullMQ job por cada fuente activa — worker los procesa secuencialmente.
- Resultado: scraping automatico 4 veces al dia sin intervencion manual.

# 9. GEOCODING — VENUE-DICTIONARY + NOMINATIM

| Paso | Descripcion |
| --- | --- |
| 1. venue-dictionary.ts | Lookup local — 40+ venues Bogota curados — ~0ms, sin API call |
| 2. Nominatim (OSM) | Fallback geocodificacion via OpenStreetMap — rate limit 1.1s (ToS) |
| 3. cityFallback | Si la direccion falla, geocodifica solo la ciudad |
| 4. Fallback null | Ultimo recurso — actividad sin pin en el mapa |

- Estado al 2026-04-24: 29/29 locations en BD con coordenadas reales (lat/lng != 0).

# 10. DESIGN SYSTEM E INTENT MANAGER (NUEVO V24)


## 10.1 Design System enforced (S45/S53)

- src/components/ui/toast.tsx: useToast() hook — UNICA fuente de feedback en la UI.
- ESLint bloquea en build/CI: alert(), confirm(), prompt(), react-hot-toast, sonner.
- Tokens en src/lib/design-tokens.ts — colores, tamanios, radios consistentes.
- Upload con AbortController — cancelacion limpia de subidas de imagen (S46).

## 10.2 Intent Manager — requireAuth() (S53)

- src/lib/intent-manager.ts guarda intent en localStorage (key hp_intent, TTL 15min).
- src/lib/require-auth.ts: UNICO punto de verificacion de autenticacion antes de una accion.
- IntentResolver.tsx en el layout raiz: al hacer login, detecta intent pendiente y lo ejecuta automaticamente.
- FavoriteButton usa requireAuth() — si no autenticado, guarda intent → /login → al volver, ejecuta toggle.

# 11. ANALYTICS Y RANKING ADAPTATIVO (NUEVO V24)


## 11.1 Analytics zero-dep (S42)

- window.__hp_analytics — objeto global sin dependencias externas.
- Eventos: page_view, activity_click, search, filter_use, favorite_add, favorite_remove.
- Sin cookies de terceros — GDPR-safe por diseno.
- API POST /api/analytics persiste eventos anonimizados en BD.

## 11.2 CTR Feedback Loop + Ranking Adaptativo (S44)

- Cada click incrementa rankingScore via PATCH /api/activities/[id]/ctr.
- ctrToBoost: CTR > 30% → +0.15 | CTR > 15% → +0.08 | CTR > 5% → +0.03.
- Hybrid Ranking: boostScore (CTR) + recency score + source health + premium boost.
- Resultado: actividades con mas engagement suben organicamente en el listing.

# 12. MONETIZACION

| Fase | Estado / Descripcion |
| --- | --- |
| Mes 1-5 (actual) | Construir audiencia. 0 ingresos. Datos y UX. INFRAESTRUCTURA LISTA. |
| Mes 6 | Newsletter sponsorships: COP 200k-500k/mes. Sponsor model + CRUD + email block LISTOS. |
| Mes 9 | Listings premium: COP 150k-300k/mes. isPremium + badge + ordering LISTOS. |
| Ano 2 | Freemium proveedores (dashboard analiticas) + cajas de compensacion B2B. |
| Largo plazo | Modelo Fever: de agregador a productor de eventos propios curados. |
| Pagos (Wompi) | PENDIENTE: cuenta bancaria + primer cliente real. Mes 6. |

| Componente | Estado |
| --- | --- |
| Sponsor en email digest | LISTO — bloque entre actividades y CTA, UTM tracking |
| isPremium Provider | LISTO — campo en BD + badge 'Destacado' + ordering preferencial |
| Pagina /anunciate | LISTO — stats, opciones de patrocinio, precios orientativos |
| Admin sponsors CRUD | LISTO — /admin/sponsors: crear, activar, editar, eliminar |
| Dashboard proveedor | LISTO — /proveedores/[slug]/dashboard |
| Provider claim flow | LISTO — ProviderClaim + admin UI + email notif + Supabase role update |
| Pasarela Wompi | PENDIENTE — mes 6 |


# 13. FUNCIONALIDADES DE INTERFAZ


## 13.1 Paginas publicas

| Ruta | Descripcion |
| --- | --- |
| / | Landing: HeroSearch prominente + autocomplete + chips Hoy/Gratis/Cerca. Footer 4 columnas. (S37) |
| /actividades | Grid: barra filtros unica desktop; modal mobile. Chips activos con X. Estado loading+spinner. (S38-S40) |
| /actividades/[uuid-slug] | Detalle: hero, descripcion, fechas, precio, mini-mapa Leaflet, RatingForm 3 pasos, similares |
| /mapa | Mapa Leaflet — pines por categoria, popup con imagen y link |
| /legal | Centro de Seguridad Legal — PDFs react-pdf Terminos, Privacidad, Tratamiento (S41) |
| /anunciate | Landing monetizacion: stats, opciones de patrocinio y listing premium |
| /proveedores/[slug] | Perfil publico del proveedor |
| /contribuir | Formulario para sugerir actividades |
| /contacto | 6 motivos de contacto |
| /login / /registro | Auth Supabase SSR |


## 13.2 Buscador mixto — Suggestions API (NUEVO V24 — S40)

- GET /api/suggestions: max 5 = 3 actividades + 1 categoria + 1 ciudad. Tipo SuggestionItem {type, id, label, sublabel}.
- Cache LRU 20 entradas. AbortController para cancelar requests. Debounce 300ms.
- Historial sessionStorage max 5 — busquedas recientes sin backend.

## 13.3 Zona de usuario + Panel admin

| Ruta | Descripcion |
| --- | --- |
| /perfil/favoritos | Actividades Y lugares favoritos (polimorficos) con FavoriteButton (S49) |
| /admin/sources | CRUD fuentes scraping + toggle activar/desactivar + score auto-pause (NUEVO V24) |
| /admin/quality | Dashboard calidad NLP — Date Preflight metrics, parser fallback rate (NUEVO V24) |
| /admin/sponsors / /admin/actividades / /admin/metricas | CRUD y reportes (existentes) |


# 14. AUTENTICACION, ROLES Y CUMPLIMIENTO LEGAL

- Supabase Auth SSR con cookies HttpOnly — sin tokens en localStorage.
- Roles: ADMIN, PROVIDER (isClaimed), MODERATOR, PARENT.
- Intent Manager: requireAuth() preserva accion → /login → post-login ejecuta automaticamente.
- Cumplimiento Ley 1581: /legal — PDFs react-pdf desde SSOT. /privacidad, /terminos, /tratamiento-datos.
- SIC RNBD — pendiente registrar en https://rnbd.sic.gov.co (accion Denys).

# 15. NOTIFICACIONES (EMAIL + WEB PUSH)

- Email: Resend + react-email. Templates welcome + activity-digest con UTM y bloque sponsor.
- Cron Vercel: 9am UTC diario → POST /api/admin/send-notifications (CRON_SECRET).
- Web Push VAPID: public/sw.js + API /api/push/subscribe. sendPushToMany() limpia endpoints expirados.

# 16. ESTADO ACTUAL — v0.16.1 (2026-04-24)

| Metrica | Valor |
| --- | --- |
| Actividades en BD | ~300+ actividades activas (con cobertura de ciudad > 86%) |
| Locations geocodificadas | 29/29 con coordenadas reales |
| Tests | 1213 pasando / 1215 totales (2 skipped) en 75 archivos — todos verdes |
| Cobertura | >91% stmts / >85% branches / >88% funcs |
| TypeScript | 0 errores (tsc --noEmit) |
| npm audit | 3 moderate dev-only aceptables |
| Build | OK — sin warnings críticos |
| Deployment | Vercel ACTIVO — habitaplan.com |
| CI/CD | GitHub Actions — tests + build + smoke CI |
| Cola | BullMQ + Upstash Redis OPERATIVO — Cron 6h activo |
| Fuentes activas | 10 web Bogotá + 2 web Medellín + 10 Instagram + 1 Telegram |
| Search engine | pg_trgm activo — similarity + GIN indexes |
| Activity Gate | ACTIVO (v0.16.1) — doble capa semántica + heurística. Logging diferencial. |
| Date Preflight | Activo — date_preflight_logs. 3 capas. |
| Parser Resiliente | Activo — PARSER_FALLBACK_ENABLED. Cheerio fallback cuando Gemini 429/503. |
| Intent Manager | Activo — hp_intent localStorage TTL 15min |
| Sentry | ACTIVO — SENTRY_DSN en Vercel |
| UptimeRobot | ACTIVO — monitoreando /api/health |
| Analytics | window.__hp_analytics + CTR Feedback Loop |
| Legal Center | /legal — PDFs react-pdf desde SSOT |
| **Branding SSOT** | **logo.svg + logo-dark.svg + logo-icon.svg — Brand Asset Pipeline en build (V27)** |


## 16.1 Historial de versiones (S33-S54)

| Git tag / commit | Doc | Hito principal |
| --- | --- | --- |
| 429559a (S33) | V23 | Rebrand Infantia → HabitaPlan, 71 archivos. 835 tests. |
| S34 — fc7c1aa..168a465 | V23 | URL classifier (28 tests, 100% cov). Auto-pause dashboard. Banrep Ibague pausado. |
| S35 — 08f8a8d..ce060ff | V23 | Multi-ciudad Medellin (Parque Explora + Bib. Piloto web + IG). Admin toggle fuentes. habitaplan.com DNS. |
| S36 — 6418fda | V23 | Rebrand masivo 71 archivos, CLAUDE.md rutas fisicas. 876 tests. |
| S37 — f30addd (v0.16.1) | V23 | Home UX: HeroSearch, chips, ActivityCard compact, Footer 4 columnas. |
| S38 — 871512e | V23 | Filters.tsx: barra unica desktop, modal mobile, chips activos con X. |
| S39 — 67ecb2e (v0.16.1) | V23 | Header /actividades, loading+spinner, FiltersSkeleton, mobile ordenar. |
| S40 — c5efce5 (v0.16.1) | V23 | Buscador mixto: SuggestionItem, LRU cache, AbortController, debounce. 882 tests. |
| S41 — v0.16.1 | V24 | Legal SSOT + react-pdf. /legal con PDFs. 882 tests. |
| S42 | V24 | Analytics zero-dep window.__hp_analytics. Hybrid Ranking boostScore + recency. |
| S44 | V24 | CTR Feedback Loop. ctrToBoost tiers. Adaptive Quality Filter. |
| S45 | V24 | ESLint Freeze: no-alert, no-restricted-imports. Legal SSOT auditoria. |
| S46 | V24 | UI Hardening: Toast global, AbortController uploads, A11y, Performance. |
| S47 — v0.16.1 | V24 | Sources CRUD en BD. pg_trgm search engine. Vercel Cron → BullMQ 6h. |
| S48/b/c | V24 | Date Preflight v2: 3 capas. Health by_city. Smoke CI. 1082 tests. |
| S49 | V24 | Favoritos Mixtos (actvidades+lugares). FavoriteButton polimorfco. 1082 tests. |
| S50 | V24 | Date Preflight metricas BD. date_preflight_logs. matchedText. 1101 tests. |
| S51 | V24 | Favorites XOR CHECK constraint BD. migrate-favorites-xor.ts. 1105 tests. |
| S52 | V24 | Parser Resiliente: fallback Cheerio 429/503. parser.ts + fallback-mapper.ts. 1123 tests. |
| S53 — 043aa3e | V24 | Design System ESLint. Intent Manager. toggle-favorite.ts. requireAuth. 1155 tests. |
| S54 — 2542178 | V24 | Fix fallback-mapper HTML completo. Design System Zero Debt (erradicación alert). FUGA + IG Medellín. 1157 tests. |
| S55 | V25 | Pipeline Optimization. Scheduler Inteligente. Honest Facets UX. Deduplication Engine. 1203 tests. |
| S58 — d958311 | **V26** | **Activity Gate v0.16.1**: fail-safe LLM estricto (`isActivity` sin default), Gate heurístico, logging diferencial `[discard:llm]/[discard:gate]`, backfill ubicaciones 86%. |
| v0.16.1 | V26 | Design System Zero-Debt. Semantic hp-tokens. Chromatic VRT. Storybook Vite. |
| v0.16.1 | V26 | Search Assist System E2E. Hybrid Ranking. Zero-Debt DS Hardening. 1215 tests. |
| **v0.16.1** | **V27** | **SVG-First Branding SSOT. logo.svg + logo-dark.svg + logo-icon.svg. Brand Asset Pipeline (og.png, favicon, apple-touch). Mobile Header fix. Test repair. Docs full sync.** |


# 17. TESTING

| Metrica | Valor |
| --- | --- |
| Framework | Vitest + @vitest/coverage-v8 |
| Tests totales | 1213 en 75 archivos (+ 2 skipped) |
| Threshold | 85% branches — cap fijo |
| Statements | >91% |
| Branches | >85% |
| Functions | >88% |
| Tiempo ejecucion | ~26s |


## Tests nuevos V24 (S34-S54 — seleccion)

- url-classifier.test.ts (28 tests, S34): clasificacion activity/listing/other, 100% cobertura.
- date-preflight.test.ts (S48b): 3 capas, casos limite, matchedText preservado.
- FavoriteButton.test.tsx (11 tests, S49/S53): estado, toggle, auth, reversion optimista.
- gemini-analyzer.test.ts +2 tests (S54): re-lanza 429 si todos lotes fallan; resultados parciales si un lote exitoso.
- parser.test.ts (S52): discoverWithFallback, parseActivity con fallback Cheerio.
- fallback-mapper.test.ts (S52): extractTitle og:title→title→h1, extractDescription, extractPrice.
- favorites.test.ts (S51): XOR constraint, tipo invalido rechazado.
- source-scoring.test.ts (22 tests, S32): calcSourceScore, formatReach, TIER_LABEL.

# 18. ROADMAP


## Inmediato — cuando Gemini quota se renueve (~3am COL)

| Item | Comando |
| --- | --- |
| FUGA Filarmonica Bogota | npx tsx scripts/ingest-sources.ts --source=fuga --save-db (~16-26 actividades) |
| @parqueexplora + @quehacerenmedellin | npx tsx scripts/ingest-sources.ts --source='Parque Explora IG' --save-db |
| @festiencuentro + @distritojovenbta | npx tsx scripts/ingest-sources.ts --source=festiencuentro --save-db |


## Pendiente — Infra

- Renombrar repo GitHub → habitaplan (Settings → Rename).
- Renombrar proyecto Vercel → habitaplan.
- Telegram ingest real — npx tsx scripts/ingest-telegram.ts sin --dry-run.
- SIC RNBD — registrar en https://rnbd.sic.gov.co (accion Denys).

## Mediano plazo — v1.0.0 (MVP publico)

- Primer cliente sponsor newsletter (mes 6) — requiere cuenta Wompi activa.
- Pagos Wompi: PSE + tarjeta + Nequi.
- Meilisearch Cloud — activar cuando +1.000 actividades activas.

## Largo plazo

- Facebook Pages y TikTok (channel ya tipificado en ingest-sources.ts).
- Expansion Cali y Barranquilla.
- App movil (React Native o PWA).

# 19. SCRIPTS Y COMANDOS UTILES

| Comando | Descripcion |
| --- | --- |
| npm test | Correr todos los tests (1213 tests, ~26s) |
| npm run test:coverage | Tests + reporte de cobertura (threshold 85%) |
| npm run generate:brand | Generar og.png, favicon.png, apple-touch-icon.png desde SVG (V27) |
| npm run validate:logo | Validar que SVGs no tengan fondos falsos (pre-commit hook, V27) |
| npx tsx scripts/ingest-sources.ts --list | Ver inventario de fuentes por canal |
| npx tsx scripts/ingest-sources.ts --save-db | Ingest completo a BD (todas las fuentes) |
| npx tsx scripts/ingest-sources.ts --source=banrep --save-db | Solo Banrep — ahorra cuota Gemini |
| npx tsx scripts/ingest-sources.ts --source=fuga --save-db | Solo FUGA Filarmonica (NUEVO V24) |
| npx tsx scripts/ingest-sources.ts --channel=instagram --save-db | Solo fuentes Instagram |
| npx tsx scripts/ingest-sources.ts --queue | Encolar todos los jobs de scraping |
| npx tsx scripts/run-worker.ts | Iniciar el worker BullMQ |
| npx tsx scripts/promote-admin.ts <email> | Dar rol ADMIN a un usuario |
| npx tsx scripts/verify-db.ts | Verificar estado de la BD |
| npx tsx scripts/backfill-geocoding.ts [--dry-run] | Geocodificar locations con coords 0,0 |
| npx tsx scripts/backfill-images.ts | Extraer og:image para actividades sin imagen |
| npx tsx scripts/telegram-auth.ts | Autenticacion one-time Telegram MTProto |
| npx tsx scripts/ingest-telegram.ts [--dry-run] | Ingestar canales Telegram |
| npx tsx scripts/source-ranking.ts [--weeks=4] | Ranking de fuentes por produccion/volumen |
| npx tsx scripts/source-pause-manager.ts | Calcular scores y pausar fuentes bajas (NUEVO V24) |
| npx tsx scripts/test-instagram.ts <URL> --count-new | Contar posts nuevos sin consumir Gemini |
| node scripts/generate_v27.mjs | Generar Documento Fundacional V27 (actual) |

