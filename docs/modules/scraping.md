# Módulo: Scraping

**Versión actual:** v0.8.1+
**Última actualización:** 2026-03-31

## ¿Qué hace?

Descubre y extrae actividades de sitios web e Instagram, las normaliza con Gemini 2.5 Flash y las guarda en Supabase con deduplicación automática. Soporta scraping directo y asíncrono via BullMQ. Soporta proxy residencial opcional (IPRoyal).

## Flujos disponibles

### Web scraping (Cheerio)

```
URL semilla / sitemap XML
   → CheerioExtractor descubre links (paginación automática o sitemap)
   → Filtrado por cache (URLs ya vistas)
   → GeminiAnalyzer analiza en batches de 50
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
| `pipeline.ts` | Orquesta `runBatchPipeline()` y `runInstagramPipeline()` |
| `cache.ts` | Evita re-scrapear URLs ya procesadas |
| `types.ts` | Tipos y schemas Zod de validación |
| `storage.ts` | Guarda actividades + deduplicación Nivel 1 (Jaccard >75%) |
| `deduplication.ts` | Normalización, fingerprint y similitud (Jaccard) |
| `logger.ts` | Logging estructurado en BD (ScrapingLog) |
| `extractors/cheerio.extractor.ts` | Links + paginación automática + sitemap XML |
| `extractors/playwright.extractor.ts` | Instagram + extractWebLinks/extractWebText + proxy opcional |
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

## Fuentes activas (14)

| Fuente | Ciudad | Tipo |
|--------|--------|------|
| BibloRed | Bogotá | Web — 150 actividades |
| IDARTES | Bogotá | Sitemap XML |
| bogota.gov.co | Bogotá | Sitemap XML |
| Cultura, Rec. y Deporte | Bogotá | Sitemap XML |
| Planetario | Bogotá | Sitemap XML — 25 actividades |
| Cinemateca | Bogotá | Sitemap XML |
| Jardín Botánico (JBB) | Bogotá | Sitemap XML — 4 actividades |
| Maloka | Bogotá | Sitemap XML |
| Banrep | Bogotá | Sitemap filtrado /bogota/ |
| Banrep | Medellín | Sitemap filtrado /medellin/ |
| Banrep | Cali | Sitemap filtrado /cali/ |
| Banrep | Barranquilla | Sitemap filtrado /barranquilla/ |
| Banrep | Cartagena | Sitemap filtrado /cartagena/ |
| Banrep | Bucaramanga/Manizales/Pereira/Ibagué/Santa Marta | Sitemap por ciudad |

## Comandos

```bash
# Ingesta directa (sin queue)
npx tsx scripts/ingest-sources.ts --save-db

# Ingesta via queue (asíncrona)
npx tsx scripts/ingest-sources.ts --queue
npx tsx scripts/run-worker.ts

# Dry run (ver qué haría sin guardar)
npx tsx scripts/ingest-sources.ts --dry-run

# Geocodificación retroactiva
npx tsx scripts/backfill-geocoding.ts [--dry-run]
```

## Deduplicación

3 niveles independientes:

| Nivel | Cuando | Método |
|-------|--------|--------|
| 1 — Real-time | Al guardar | Jaccard >75% en title+description fingerprint |
| 2 — Cron | Diario | Auto-clean de duplicados exactos |
| 3 — Manual | Ad-hoc | Review 70-90% similitud |

## Limitaciones conocidas

- Gemini 2.5 Flash free tier: **20 RPD** — quota renueva medianoche UTC (19:00 COL)
- Rate limit en pipeline: 12s entre requests a Gemini
- Instagram puede bloquear IPs sin proxy tras uso intensivo → activar IPRoyal
- `scraping/queue/types.ts`: 0% cobertura en tests (solo tipos TypeScript, sin runtime)
