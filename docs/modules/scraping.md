# Módulo: Scraping

**Versión actual:** v0.2.0
**Última actualización:** 2026-03-16

## ¿Qué hace?

Descubre y extrae actividades de sitios web externos, las normaliza con IA (Gemini o Claude) y las guarda en Supabase.

## Flujo completo

```
URL semilla
   → Cheerio extrae links de actividades
   → Filtrado de URLs ya vistas (cache)
   → Gemini NLP analiza cada URL en batches de 50
   → Validación con Zod (activityNLPResultSchema)
   → Guardado en Supabase (storage.ts)
   → Cache actualizado
```

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `pipeline.ts` | Orquesta el flujo completo, paginación, retry |
| `cache.ts` | Evita re-scrapear URLs ya procesadas |
| `types.ts` | Tipos y schemas Zod de validación |
| `storage.ts` | Guarda actividades normalizadas en Supabase |
| `extractors/cheerio.extractor.ts` | Descubre links desde HTML |
| `nlp/gemini.analyzer.ts` | Extrae datos estructurados con Gemini 2.5 Flash |
| `nlp/claude.analyzer.ts` | Alternativa con Claude API (Anthropic) |

## Cómo usarlo

```bash
# Scraper con una URL (prueba rápida)
npx tsx scripts/test-scraper.ts --url https://biblored.gov.co/actividades

# Batch completo con guardado en DB
npx tsx scripts/test-scraper.ts --url https://biblored.gov.co/actividades --save-db

# Ver qué hay en Supabase
npx tsx scripts/verify-db.ts
```

## Comportamiento importante

- **Cache incremental:** las URLs ya procesadas se saltan automáticamente. Borrar `data/scraping-cache.json` para re-procesar todo.
- **Chunks de 50 URLs:** Gemini tiene límite de tokens — el pipeline divide en batches de 50.
- **Confianza mínima:** actividades con `sourceConfidence < 0.7` se guardan pero marcadas para revisión.
- **Retry automático:** 3 intentos con backoff exponencial ante errores de red.

## Tests

```
src/modules/scraping/__tests__/
  cache.test.ts              → ScrapingCache: has, add, filterNew, size, save, load (14 tests) — 100%
  types.test.ts              → activityNLPResultSchema, discoveredActivityUrlsSchema — 100%
  storage.test.ts            → ScrapingStorage: saveBatchResults, saveActivity, disconnect (11 tests) — 95% stmts
  cheerio-extractor.test.ts  → CheerioExtractor: extract, extractLinks, extractLinksAllPages (15 tests) — ~91% lines
  claude-analyzer.test.ts    → ClaudeAnalyzer: analyze, discoverActivityLinks, mock/real paths (11 tests) — 100%
  gemini-analyzer.test.ts    → GeminiAnalyzer: analyze, discoverActivityLinks, callWithRetry (18 tests) — ~99% lines
  pipeline.test.ts           → runPipeline, runBatchPipeline, concurrencia, disconnect (13 tests) — 100%
```

Cobertura v0.2.0: todos los módulos cubiertos — líneas totales: ~96%

## Sitios probados

| Sitio | Páginas | Links | Guardados | Confianza |
|---|---|---|---|---|
| biblored.gov.co | 19 | 223 | 167 | 99% alta |
| bogota.gov.co | — | — | 21 | 95% alta |

## Pendiente

- [ ] Soporte Instagram (Playwright)
- [ ] Proxy rotation para anti-blocking
- [ ] Probar con Idartes y Jardín Botánico
- [ ] Webhook para notificar nuevas actividades
