# Módulo: Scraping

**Versión actual:** v0.1.0
**Última actualización:** 2026-03-16

## ¿Qué hace?

Descubre y extrae actividades de sitios web externos, las normaliza con IA (Gemini) y las guarda en Supabase.

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
- **Confianza mínima:** actividades con `confidenceScore < 0.7` se guardan pero marcadas para revisión.
- **Retry automático:** 3 intentos con backoff exponencial ante errores de red.

## Tests

```
src/modules/scraping/__tests__/
  cache.test.ts   → ScrapingCache: has, add, filterNew, size
  types.test.ts   → activityNLPResultSchema, discoveredActivityUrlsSchema
```

## Sitios probados

| Sitio | Páginas | Links | Guardados | Confianza |
|---|---|---|---|---|
| biblored.gov.co | 19 | 223 | 167 | 97% alta |

## Pendiente

- [ ] Soporte Instagram (Playwright)
- [ ] Proxy rotation para anti-blocking
- [ ] Probar con Idartes y Jardín Botánico
- [ ] Webhook para notificar nuevas actividades
