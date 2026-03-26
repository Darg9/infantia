# Módulo: Scraping

**Versión actual:** v0.7.3
**Última actualización:** 2026-03-25

## ¿Qué hace?

Descubre y extrae actividades de sitios web e Instagram, las normaliza con Gemini 2.5 Flash y las guarda en Supabase con deduplicación automática.

## Flujos disponibles

### Web scraping (Cheerio)

```
URL semilla
   → CheerioExtractor descubre links (con paginación automática)
   → Filtrado por cache (URLs ya vistas)
   → GeminiAnalyzer analiza en batches de 50
   → Validación Zod (activityNLPResultSchema)
   → ScrapingStorage.saveActivity() con deduplicación Jaccard >75%
   → Cache actualizado
```

### Instagram scraping (Playwright)

```
Username de cuenta (@handle)
   → PlaywrightExtractor navega el perfil público
   → Extrae posts: caption, imagen, fecha
   → GeminiAnalyzer con INSTAGRAM_SYSTEM_PROMPT
   → Validación Zod + guardado en BD
```

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `pipeline.ts` | Orquesta `runBatchPipeline()` y `runInstagramPipeline()` |
| `cache.ts` | Evita re-scrapear URLs ya procesadas |
| `types.ts` | Tipos y schemas Zod de validación |
| `storage.ts` | Guarda actividades + deduplicación Nivel 1 (Jaccard >75%) |
| `deduplication.ts` | Utilidades de normalización, fingerprint y similitud |
| `logger.ts` | Logging estructurado con niveles (debug/info/warn/error) |
| `extractors/cheerio.extractor.ts` | Descubre links + paginación automática + sitemap XML |
| `extractors/playwright.extractor.ts` | Scraping Instagram + extractWebLinks/extractWebText (SPA fallback) |
| `nlp/gemini.analyzer.ts` | NLP con Gemini 2.5 Flash (activo) |
| `nlp/claude.analyzer.ts` | Alternativa con Claude API (backup, no activo) |
| `queue/connection.ts` | Singleton de conexión Redis (IORedis) |
| `queue/scraping.queue.ts` | Queue BullMQ singleton para jobs de scraping |
| `queue/scraping.worker.ts` | Worker BullMQ: procesa batch + Instagram jobs |
| `queue/producer.ts` | `enqueueBatchJob()` + `enqueueInstagramJob()` |
| `queue/types.ts` | Tipos TypeScript para jobs de la queue |

## Paginación automática (CheerioExtractor)

`extractLinksAllPages()` sigue paginación automáticamente con dos estrategias:

1. **Por texto:** busca links con texto "Siguiente", "Next", "›", "»"
2. **Por parámetro:** detecta `?page=N` e incrementa a `?page=N+1`

No requiere configuración adicional — funciona out-of-the-box.

## Instagram (PlaywrightExtractor)

- **UA:** Desktop Chrome (evita detección móvil)
- **Evento:** `domcontentloaded` (no `networkidle` — más rápido y estable)
- **Sesión:** `data/ig-session.json` — persistente entre ejecuciones
- **Login inicial:** `npx tsx scripts/ig-login.ts` (manual, una sola vez)
- **3 estrategias de caption:** `aria-label` → `alt` → `textContent`

## Deduplicación (3 niveles)

| Nivel | Cuándo | Método |
|---|---|---|
| 1 — Real-time | En cada `saveActivity()` | Jaccard sobre título normalizado >75% → rechaza |
| 2 — Cron diario | 5 AM UTC (Vercel) | Elimina duplicados exactos (mismo fingerprint) |
| 3 — Manual | A demanda | Script `find-all-duplicates.ts` — revisa 70-90% similitud |

## Schema ActivityNLPResult (crítico)

```typescript
schedules: [{
  startDate: string,   // ISO 8601
  endDate: string,     // ISO 8601
  notes?: string,      // "3:00 PM - 5:00 PM"
  // ❌ NO: frequency, timeSlot
}],
location: {
  address?: string,
  city?: string,
  // ❌ NO: string literal
}
```

## Cómo usarlo

```bash
# Prueba rápida con una URL
npx tsx scripts/test-scraper.ts --url https://biblored.gov.co/actividades

# Batch completo con guardado en BD
npx tsx scripts/test-scraper.ts --url https://biblored.gov.co/actividades --save-db

# Instagram (requiere ig-session.json)
npx tsx scripts/test-instagram.ts --username fcecolombia

# Buscar duplicados
npx tsx scripts/find-all-duplicates.ts

# Ver estado de la BD
npx tsx scripts/verify-db.ts
```

## Comportamiento importante

- **Cache incremental:** borrar `data/scraping-cache.json` para re-procesar todo.
- **Batches de 50:** Gemini tiene límite de tokens por request.
- **Cuota Gemini:** si falla con error 429/quota, revisar Google AI Studio antes de debuggear código.
- **Confianza mínima:** actividades con `sourceConfidence < 0.7` se guardan en estado `DRAFT`.
- **Retry automático:** 3 intentos con backoff exponencial.

## Queue asíncrona (BullMQ + Redis)

```
queue/
  connection.ts       → Singleton Redis (IORedis) con getRedisConnection/closeRedisConnection
  scraping.queue.ts   → Queue BullMQ singleton "scraping-jobs"
  scraping.worker.ts  → Worker que procesa batch e instagram jobs
  producer.ts         → enqueueBatchJob({ url, cityName, verticalSlug, maxPages?, sitemapPatterns? })
                        enqueueInstagramJob({ profileUrl, cityName, verticalSlug }, { delay?, priority? })
  types.ts            → BatchJobData | InstagramJobData
```

### Flujo de job de scraping asíncrono

```
Producer.enqueueBatchJob(opts)
   → BullMQ Queue "scraping-jobs".add("batch", data)
   → Worker recibe job
   → runBatchPipeline(url, cityName, verticalSlug, { maxPages, sitemapPatterns })
   → disconnect()
```

## Tests (v0.7.3)

```
src/modules/scraping/__tests__/
  cache.test.ts              → 14 tests — 100%
  types.test.ts              → 17 tests, schemas Zod — 100%
  storage.test.ts            → 24 tests, saveActivity, dedup, disconnect — 100% stmts
  deduplication.test.ts      → 42 tests, normalizeString, Jaccard, fingerprint — 94%
  cheerio-extractor.test.ts  → 16 tests, extract, extractLinks, sitemap, maxPages — 94%
  claude-analyzer.test.ts    → 11 tests, ClaudeAnalyzer mock/real — 100%
  gemini-analyzer.test.ts    → 30 tests, GeminiAnalyzer web + Instagram — 94%
  pipeline.test.ts           → 34 tests, runBatchPipeline, runInstagramPipeline — 98%
  logger.test.ts             → 10 tests, niveles, contexto, formato — 100%
  queue-connection.test.ts   → 6 tests, singleton Redis, close — 100%
  queue-worker.test.ts       → 5 tests, Worker, processors — 100%
  queue.test.ts              → 9 tests, producer, queue singleton — 100%
```

Cobertura v0.7.3: 97.41% stmts / 92.5% branches / 96.7% funcs / 98.17% lines

## Fuentes activas

| Fuente | Tipo | Páginas | Actividades | Confianza |
|---|---|---|---|---|
| biblored.gov.co | Web (Cheerio) | 19 | 167 | 99% alta |
| bogota.gov.co | Web (Cheerio) | — | 21 | 95% alta |
| @fcecolombia | Instagram | — | ~8 | 90% |
| @quehaypahacerenbogota | Instagram | — | ~4 | 88% |
| CEFEs / Eventos Bogotá | Scripts hardcoded | — | ~21 | 90% |

## Pendiente

- [ ] Scraping Idartes (idartes.gov.co) — nunca intentado
- [ ] Scraping Jardín Botánico — nunca intentado
- [ ] Proxy rotation para anti-blocking en sitios con rate limit
- [ ] Webhook para notificar nuevas actividades al guardarse
- [ ] Más cuentas de Instagram
