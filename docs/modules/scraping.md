# Módulo: Scraping

**Versión actual:** v0.11.0-S42
**Última actualización:** Hoy

## ¿Qué hace?

Descubre y extrae actividades de sitios web, Instagram y canales de Telegram, las normaliza con Gemini 2.5 Flash y las guarda en Supabase con deduplicación automática. Soporta scraping directo y asíncrono via BullMQ. Soporta proxy residencial opcional (IPRoyal).

## Flujos disponibles

### Web scraping (Resilient Proxy)

```
URL semilla / sitemap XML
   → ScrapingPipeline / Resilient Proxy (Intenta Cheerio primero)
   → [Falló Cheerio por JS Dinámico/SPA?] → Auto-Fallback a Playwright
   → Filtrado por cache (URLs ya vistas)
   → GeminiAnalyzer analiza en batches de 100
   → Validación Zod (activityNLPResultSchema)
   → Geocoding: venue-dictionary.ts (~0ms) → Nominatim → cityFallback → null
   → ScrapingStorage.saveActivity() con deduplicación Jaccard >75%
   → Cache actualizado
```

### Instagram scraping (Playwright)

```
Username de cuenta (@handle)
   → PlaywrightExtractor navega el perfil público
   → [si PLAYWRIGHT_PROXY_SERVER está en .env → usa proxy residencial]
   → Extrae posts: caption, imagen, fecha
   → GeminiAnalyzer con INSTAGRAM_SYSTEM_PROMPT
   → Validación Zod + guardado en BD
```

### Telegram scraping (MTProto via gramjs)

```
Canal público (@handle)
   → TelegramClient (gramjs) con sesión autenticada
   → Requiere: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION
   → Extrae mensajes: texto, fecha, mediaUrl, URL al mensaje
   → GeminiAnalyzer analiza con INSTAGRAM_SYSTEM_PROMPT (similar a posts)
   → ScrapingStorage.saveActivity() con deduplicación
```

**Estado (S29):** autenticación exitosa. `TELEGRAM_SESSION` guardado en .env y Vercel. dry-run detectó 3 actividades en @quehaypahacer. Pendiente correr sin --dry-run.

### Cola asíncrona (BullMQ + Upstash Redis)

```
ingest-sources.ts --queue
   → enqueueBatchJob() / enqueueInstagramJob() → Upstash Redis
   → run-worker.ts → Worker BullMQ concurrencia=1
   → Procesa jobs respetando rate limit Gemini (12s entre requests)
   → 3 reintentos con backoff exponencial (5s)
```

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `pipeline.ts` | Orquesta la lógica e invoca al pipeline a través de resiliencia |
| `resilience.ts` | **(NUEVO v0.11.0)** Proxy dinámico que intenta Cheerio primero y en caso de fallo, dispara Playwright automáticamente |
| `cache.ts` | Caché dual disco+BD — evita re-scrapear URLs ya procesadas entre máquinas |
| `types.ts` | Tipos y schemas Zod de validación |
| `storage.ts` | Guarda actividades + deduplicación Nivel 1 (Jaccard >75%) |
| `deduplication.ts` | Normalización, fingerprint y similitud (Jaccard) |
| `logger.ts` | Logging estructurado en BD (ScrapingLog) |
| `extractors/cheerio.extractor.ts` | Links + paginación automática + sitemap XML |
| `extractors/playwright.extractor.ts` | Instagram + extractWebLinks/extractWebText + proxy opcional |
| `extractors/telegram.extractor.ts` | Canales Telegram MTProto (gramjs) — NUEVO S28 |
| `nlp/gemini.analyzer.ts` | NLP con Gemini 2.5 Flash (activo en producción) |
| `nlp/claude.analyzer.ts` | Alternativa con Claude API (backup, no activo) |
| `queue/connection.ts` | Singleton IORedis (soporte rediss:// TLS) |
| `queue/scraping.queue.ts` | Queue BullMQ singleton |
| `queue/scraping.worker.ts` | Worker BullMQ: procesa batch + Instagram jobs |
| `queue/producer.ts` | `enqueueBatchJob()` + `enqueueInstagramJob()` |
| `queue/types.ts` | Tipos TypeScript para jobs |

## Proxy residencial (NUEVO v0.8.1+)

`PlaywrightExtractor` soporta proxy residencial para evitar bloqueos en Instagram, TikTok y Facebook.

```bash
# Agregar a .env para activar proxy
PLAYWRIGHT_PROXY_SERVER=http://geo.iproyal.com:12321
PLAYWRIGHT_PROXY_USER=usuario_iproyal
PLAYWRIGHT_PROXY_PASS=contrasena_iproyal
```

- Sin vars → comportamiento anterior sin proxy (backward compatible)
- Proxy aplicado a todos los `chromium.launch()`: Instagram y extracción web
- Log: `[PLAYWRIGHT] Proxy activo: ...` cuando está configurado
- Proveedor recomendado: **IPRoyal** — IPs residenciales, pay-as-you-go $7/GB

## Geocoding integrado

El pipeline integra geocoding automático en cada actividad guardada:

1. `venue-dictionary.ts` — lookup local con 40+ venues Bogotá (~0ms, sin API call)
2. Nominatim (OpenStreetMap) — rate limit 1.1s entre requests
3. cityFallback — geocodifica solo la ciudad si la dirección falla
4. null — último recurso (actividad sin pin en mapa)

## Paginación automática (CheerioExtractor)

`extractLinksAllPages()` sigue paginación con dos estrategias:

1. **Por texto:** busca links con texto "Siguiente", "Next", "›", "»"
2. **Por parámetro:** detecta `?page=N` e incrementa a `?page=N+1`

## Sitemap XML

`extractSitemapLinks(url, patterns?)` parsea sitemap index + sub-sitemaps:

- Detecta automáticamente si la URL contiene `sitemap*.xml`
- Filtra URLs por patrones (ej: `/bogota/` para Banrep Bogotá)
- Sin Playwright, sin bot-detection

## Fuentes activas (20 web + 12 Instagram + canal Telegram pendiente) — S40

### Web (14 fuentes)

| Fuente | Ciudad | Tipo |
|--------|--------|------|
| BibloRed | Bogotá | Web — 150 actividades |
| IDARTES | Bogotá | Sitemap XML |
| bogota.gov.co | Bogotá | Sitemap XML |
| Cultura, Rec. y Deporte | Bogotá | Sitemap XML |
| Planetario | Bogotá | Sitemap XML — 25 actividades |
| Cinemateca | Bogotá | Sitemap XML |
| Jardín Botánico (JBB) | Bogotá | Sitemap XML |
| Maloka | Bogotá | Sitemap XML |
| Banrep Bogotá | Bogotá | Sitemap filtrado /bogota/ |
| Banrep Medellín | Medellín | Sitemap filtrado /medellin/ |
| Banrep Cali | Cali | Sitemap filtrado /cali/ |
| Banrep Barranquilla | Barranquilla | Sitemap filtrado /barranquilla/ |
| Banrep Cartagena | Cartagena | Sitemap filtrado /cartagena/ |
| Banrep (Buca/Mani/Pereira/Ibagué/Santa Marta) | Multi | Sitemap por ciudad |

### Instagram (12 fuentes activas — +2 Medellín en S35)

| Cuenta | Seguidores | Tipo de contenido |
|--------|-----------|-------------------|
| @quehaypahacerenbogota | 53K | Agenda cultural Bogotá |
| @plansitosbogota | 22K | Planes gratis Bogotá |
| @parchexbogota | 214K | Ferias, eventos, planes |
| @bogotaplan | 299K | Cultura en Bogotá |
| @planesenbogotaa | 60K | Planes en Bogotá |
| @bogotateatralycircense | 17K | Teatro y circo — Idartes |
| @festiencuentro | 1.6K | Festival de títeres |
| @teatropetra | 87K | Teatro — programación activa |
| @distritojovenbta | 24K | Agenda juventudes Bogotá |
| @centrodeljapon | 7K | Cultura japonesa — talleres |

Configuración por fuente: `instagram.contentMode` (text/image/both) + `instagram.maxPosts` (1–12).
Validación sin cuota: `npx tsx scripts/test-instagram.ts <URL> --validate-only`

### Telegram (pendiente)
| Canal | Ciudad | Estado |
|-------|--------|--------|
| @quehaypahacer | Bogotá | MTProto operativo — pendiente correr sin --dry-run |

## Comandos

```bash
# Telegram — canal separado (requiere TELEGRAM_SESSION en .env)
npx tsx scripts/telegram-auth.ts                          # genera TELEGRAM_SESSION (interactivo)
npx tsx scripts/ingest-telegram.ts                        # todos los canales
npx tsx scripts/ingest-telegram.ts --dry-run              # sin guardar
npx tsx scripts/ingest-telegram.ts --channel=bogotaenplanes
npx tsx scripts/ingest-telegram.ts --limit=100            # más mensajes por canal

# Ver inventario de fuentes por canal
npx tsx scripts/ingest-sources.ts --list

# Ingesta completa (todas las fuentes)
npx tsx scripts/ingest-sources.ts --save-db

# Por canal
npx tsx scripts/ingest-sources.ts --channel=web --save-db
npx tsx scripts/ingest-sources.ts --channel=social          # todas las redes sociales
npx tsx scripts/ingest-sources.ts --channel=instagram       # solo Instagram

# Por fuente puntual (parcial, sin importar mayúsculas)
npx tsx scripts/ingest-sources.ts --source=banrep --save-db
npx tsx scripts/ingest-sources.ts --source=banrep,cinemateca --save-db

# Combinado (canal + fuente)
npx tsx scripts/ingest-sources.ts --channel=web --source=banrep --save-db

# Dry run (descubre pero NO guarda)
npx tsx scripts/ingest-sources.ts --dry-run

# Ingesta via queue BullMQ (asíncrona)
npx tsx scripts/ingest-sources.ts --queue
npx tsx scripts/run-worker.ts

# Geocodificación retroactiva
npx tsx scripts/backfill-geocoding.ts [--dry-run]

# Reescritura pura de descripciones (Mitigación Módulo Legal)
npx tsx scripts/backfill-descriptions.ts [--limit=N] [--ai-enabled] [--dry-run]
```

## Calidad y Observabilidad (NUEVO v0.10.x)

El pipeline de ingesta cuenta con un flujo estricto de **mitigación legal/copyright**. Se ejecuta un algoritmo de normalización sobre cada descripción entrante en `3 capas` priorizadas:
1. **`structured`**: Búsqueda puramente regex de Tipo de Actividad + Categoría.
2. **`rule-based`** (Activo y Default): Aisla la primera frase no-promocional omitiendo stopwords. Extrae hasta el primer punto, limpiando hashtags o basura, previniendo el plagio textual extenso.
3. **`ai`** (Fallback Inactivo por defecto): Se envía a LLM si las capas previas no logran rescatar >60 caracteres no ambiguos.

Para mantener total monitoreo sobre las fuentes, cada bloque ingestado se inserta temporalmente en la BD como un reporte de degradación (`ContentQualityMetric`) visible en `/admin/quality`. Evalúa % Cortas, % Ruido y % Promo de los strings.

## Curaduría Adaptativa (NUEVO v0.11.0)
El Pipeline cuenta con un **Filtro Adaptativo Inteligente** que evalúa dinámicamente si debe descartar una actividad antes de guardarla.
Cruza la Calidad Global del sistema con la métrica de Salud de la Fuente (`SourceHealth`).

Si una actividad falla el filtro adaptativo (`Math.max(adaptive, source)` para la longitud mínima de caracteres valiosos), se descarta con `method: "skipped"`, logrando **Trazabilidad sin Persistencia**.

### Monitoring Toolkit (Log: `adaptive_filter_summary`)
Parámetros a monitorear desde PM2/Vercel (evento `adaptive_filter_summary`):

- **discardRate** ideal: `0.10 – 0.35`
  - `< 0.05` → filtro débil (under-filtering). Acción: endurecer `normalize`.
  - `> 0.50` → filtro agresivo (riesgo de over-filtering). Acción: revisar umbrales de Sources de baja salud.
- **avgMinLength** ideal: `45 – 65`
  - `> 75` → El sistema está siendo ultra severo globalmente (probablemente impulsado por una crisis histórica de ruido).
  - `< 40` → El sistema está confiado y dejando pasar todo contenido pobre.

### Quick Debug

| Métrica        | Valor        | Acción                  |
|----------------|-------------|--------------------------|
| discardRate >50% | 🔴 alto     | bajar thresholds         |
| discardRate <5%  | 🟡 bajo     | subir validación         |
| avgMinLength >75 | 🔴 alto     | relajar reglas           |
| avgMinLength <40 | 🟡 bajo     | endurecer reglas         |

Esta lógica descansa de forma determinista en `adaptive-rules.ts`.

## Deduplicación

3 niveles independientes:

| Nivel | Cuando | Método |
|-------|--------|--------|
| 1 — Real-time | Al guardar | Jaccard >75% en title+description fingerprint |
| 2 — Cron | Diario | Auto-clean de duplicados exactos |
| 3 — Manual | Ad-hoc | Review 70-90% similitud |

## Pre-filtro de URLs binarias (NUEVO v0.9.0)

`GeminiAnalyzer.discoverActivityLinks()` excluye automáticamente antes de enviar a Gemini:
- Imágenes: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.tiff`
- Documentos: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`
- Media: `.mp4`, `.mp3`, `.zip`

Esto evita consumir cuota del free tier (20 RPD) en archivos que nunca son actividades.
**Caso real que motivó el fix:** JBB publica su agenda como imágenes JPG — eran 4 requests perdidos por ejecución.

## Caché dual disco + BD (NUEVO S31)

`ScrapingCache` ahora persiste URLs en PostgreSQL además del archivo local `data/scraping-cache.json`.

```bash
# Crear tabla scraping_cache (ya ejecutado)
npx tsx scripts/migrate-scraping-cache.ts

# Contar posts nuevos sin consumir Gemini
npx tsx scripts/test-instagram.ts <URL> --count-new
```

**Flujo:**
1. Al iniciar pipeline: `syncFromDb(source?)` fusiona BD → disco
2. Pipeline filtra URLs ya vistas (disco, ~0ms)
3. Al terminar: `saveToDb()` persiste URLs nuevas en BD

Garantiza que si corres en otra máquina no re-scraped URLs ya procesadas.

## Ranking de fuentes (NUEVO S31)

```bash
npx tsx scripts/source-ranking.ts [--weeks=4] [--platform=INSTAGRAM]
```

3 criterios:
- **Producción (50%):** % actividades guardadas / posts analizados
- **Volumen (30%):** actividades nuevas por semana (benchmark: 5/semana = 100%)
- **Alcance (20%):** seguidores (IG) o actividades históricas (web)

Tiers: 🥇 A (≥70) · 🥈 B (≥40) · 🥉 C (≥20) · ❌ D (<20)

Lógica reutilizable en `src/lib/source-scoring.ts` para uso en UI admin.

## Tolerancia Zod ante Gemini (NUEVO S31)

`activityNLPResultSchema` normaliza respuestas imprecisas de Gemini antes de rechazarlas:

| Campo | Valor Gemini | Normalizado a |
|-------|-------------|---------------|
| `title` | `null` o `""` | `"Sin título"` |
| `categories` | `null` o `[]` | `["General"]` |

`sanitizeGeminiResponse()` en `gemini.analyzer.ts` aplica la limpieza antes de Zod como capa adicional.

## Limitaciones conocidas

- Gemini 2.5 Flash free tier: **20 RPD** — quota renueva medianoche UTC (19:00 COL)
- Rate limit en pipeline: 12s entre requests a Gemini
- Instagram puede bloquear IPs sin proxy tras uso intensivo → activar IPRoyal
- `scraping/queue/types.ts`: 0% cobertura en tests (solo tipos TypeScript, sin runtime)
- `scraping/extractors/telegram.extractor.ts`: 0% cobertura (sin tests — S28, pendiente)
- JBB publica parte de su agenda como imágenes JPG — el scraper obtiene metadata pero no el contenido detallado
- **Telegram ISP Colombia:** ISP bloquea conexiones MTProto a servidores Telegram. Requiere VPN para autenticación inicial. Una vez obtenido `TELEGRAM_SESSION`, la sesión puede funcionar directamente.
