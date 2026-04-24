# Módulo: Scraping

**Versión actual:** v0.16.1
**Última actualización:** 24 de abril de 2026

## ¿Qué hace?

Descubre y extrae actividades de sitios web, Instagram y canales de Telegram, las normaliza con Gemini 2.5 Flash y las guarda en Supabase con deduplicación automática. Soporta scraping directo y asíncrono via BullMQ. Soporta proxy residencial opcional (IPRoyal). Incluye parser resiliente con fallback a Cheerio cuando Gemini no está disponible (429/503).

## 📉 Naturaleza del Inventario

HabitaPlan NO garantiza cobertura total del mercado.
El inventario es:
- oportunista (según fuentes activas)
- dinámico
- no exhaustivo

### Implicación
El sistema depende de calidad de fuentes, no de cantidad.

## ✅ Definición de Actividad (Quality Gate)

Un registro solo se considera actividad si:
- `isActivity === true`
- tiene título válido
- tiene fecha o schedule interpretable
- tiene contexto familiar/infantil

### Regla
Si no cumple → se descarta antes de persistencia.

## ⏱️ Ejecución del Pipeline

- El scraping es ejecutado por `run-worker.ts`
- Las fuentes se recorren dinámicamente desde la base de datos
- No existen pipelines hardcodeados

### Regla
Si una fuente no está en BD → no existe para el sistema.

## Flujos disponibles

### Web scraping (Resilient Proxy + Parser Resiliente)

```
URL semilla / sitemap XML
   → ScrapingPipeline / Resilient Proxy (Intenta Cheerio primero)
   → [Falló Cheerio por JS Dinámico/SPA?] → Auto-Fallback a Playwright
   → Date Preflight (v2): skip predictivo heurístico → skip NLP → Date Regex Layers
   → Filtrado por cache (SPI - Sitemap Pre-Index lastmod + URLs ya vistas)
   → ScrapingCache.filterSPI(entries)  ← [NUEVO S54] omite URLs con sitemap lastmod <= scrapedAt
    │
    ▼
discoverWithFallback(links, sourceUrl, analyzer)   [NUEVO S52]
    ├─ Heurísticas pre-fetch: descarta años pasados en paths y pre-filtra binarios. [Activo S55]
    ├─ Si PARSER_FALLBACK_ENABLED=true:
    │   ├─ Intenta GeminiAnalyzer.discoverActivityLinks(links)
    │   │   └─ Si 429/503/timeout → pasa TODOS los URLs (cero pérdida de actividades)
    └─ Si PARSER_FALLBACK_ENABLED=false → comportamiento legacy (solo Gemini, propaga error)
    │
    ▼
ScrapingCache.filterNew()  ← omite URLs ya procesadas (salvo URLs de reparse inyectadas por el Scheduler Inteligente)
    │
    ▼
parseActivity(html, url, raw, analyzer, skipPreflight)   [NUEVO S55 — Scheduler Inteligente]
    ├─ Si la URL viene de reparseUrls, skipPreflight=true (evitamos perder tiempo).
    ├─ Si PARSER_FALLBACK_ENABLED=true:
    │   ├─ Intenta GeminiAnalyzer.analyze(sourceText, url)
    │   │   └─ Si 429/503/timeout → fallbackFromCheerio(raw) [confidence 0.5, sin NLP, marca needsReparse=true en caché]
    └─ Si PARSER_FALLBACK_ENABLED=false → comportamiento legacy (solo Gemini)
    │
    ▼
evaluateActivityGate(data, url)   [NUEVO v0.16.1 — Doble capa semántica + heurística]
    ├─ **Capa 1 — LLM Priority Gate (fail-safe estricto):** Si Gemini no retornó `isActivity === true` de forma explícita, descarta inmediatamente con `[discard:llm]`. Cero default positivos.
    ├─ **Capa 2 — Heuristic Gate:** Valida señales de intención de evento (taller, festival, función, concierto…) y señal temporal (dateStart, dateEnd, schedule).
    ├─ Palabras negativas eliminan (gestión, noticias, comunicado, directorio, PQRS, boletín).
    └─ Emite log diferencial: `[discard:llm]` vs `[discard:gate]` para métricas de `llm_rejection_rate`.
    │
    ▼
ScrapingStorage.saveActivity()
    ├─ Streaming Saves [S54]: cada actividad validada se guarda instantáneamente, sin esperar al final del chunk.
    ├─ Deduplicación Nivel 1: similitud Jaccard >75% + ventana ±30 días
    ├─ Threshold Diferenciado [S55]: Gemini entra con trust >=0.3, Fallback Cheerio >=0.5 (minimiza ruido institucional).
    └─ Upsert Activity (sourceUrl como clave)
    │
    ▼
ScrapingCache.save() + ScrapingCache.saveToDb() + ScrapingLogger.completeRun()
   → Normalización Base (Spam/Reglas Cortas/Validation) Vía Data Pipeline Core v1
   → Geocoding: venue-dictionary.ts (~0ms) → Nominatim → cityFallback → null
   → ScrapingStorage.saveActivity() con deduplicación Jaccard >75%
   → Cache actualizado
   → [PARSER:SUMMARY] + [DATE-PREFLIGHT:SUMMARY] al final del batch
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
   → getCachedCTR() — CTR por dominio (cache 5min)
   → priority = Math.min(healthPriority, ctrPriority) — más urgente gana
   → enqueueBatchJob() / enqueueInstagramJob() → Upstash Redis
   → run-worker.ts → Worker BullMQ concurrencia=1
   → Procesa jobs respetando rate limit Gemini (12s entre requests)
   → 3 reintentos con backoff exponencial (5s)
```

**CTR Priority (NUEVO v0.16.1-S44):** fuentes con CTR > 0.15 reciben prioridad 1 (alta), combinado con `healthPriority` via `Math.min()`. Log `ctr_priority_applied` por fuente cuando aplica.

## Date Preflight Filter y Heurísticas pre-fetch — conservación de cuota Gemini (S48 → S55)

Antes de invocar el NLP, `pipeline.ts` optimiza masivamente la cuota bloqueando basuras:
1. **Heurísticas estáticas (O(1)):** `isOldByUrl(url)` (años pasados en URL) y `isOldByLastmod(lastmod)` (Sitemap Pre-Index > 60d o SPI estricto en caché), antes de hacer preflight o parse.
2. **Date Preflight:** Pasa el contenido HTML/texto por `evaluatePreflight()`. Si detecta que **todas** las fechas del texto son > 14 días en el pasado, omite Gemini y retorna resultado neutro. Cada evaluación se persiste en `date_preflight_logs` (fire-and-forget) para análisis posterior. Si la URL está marcada para re-procesar (Scheduler Inteligente), **salta este preflight explícitamente (`skipPreflight`)** ahorrando operaciones.

**Jerarquía de señales (v2 — S48b):**

| Capa | Señal | Calidad |
|---|---|---|
| 1 | `datetime="YYYY-MM-DD"` en HTML | Alta (estructurada, CMS) |
| 2 | Texto plano ES/ISO/DD-MM-YYYY | Media |
| 3 | Keywords + años pasados sin año actual | Baja (heurística) |

**Lógica conservadora:** Sin señales → no descarta. Cualquier fecha futura → no descarta. Buffer 14 días → no descarta. Solo descarta si TODAS las señales apuntan a pasado confirmado.

**Tabla `date_preflight_logs` (NUEVO S50):**

| Campo | Tipo | Descripción |
|---|---|---|
| `reason` | TEXT | `process / datetime_past / text_date_past / past_year_only / keyword_past` |
| `raw_date_text` | TEXT | Primera cadena de fecha/señal detectada (para análisis falsos negativos) |
| `used_fallback` | BOOL | `true` si se usó capa 2 o 3 (menos precisa que capa 1) |
| `skip` | BOOL | `true` si se omitió Gemini |
| `source_id` | TEXT | Host de la fuente (para métricas por fuente) |

**Queries de validación (ejecutar tras primer run con `--save-db`):**
```sql
-- Skip rate + distribución (últimos 7 días)
SELECT reason, COUNT(*) * 1.0 / SUM(COUNT(*)) OVER() AS pct
FROM date_preflight_logs WHERE created_at >= now() - interval '7 days'
GROUP BY reason ORDER BY pct DESC;

-- Dataset falsos negativos (muestra manual)
SELECT url, raw_date_text FROM date_preflight_logs
WHERE skip = true ORDER BY random() LIMIT 30;
```

**Umbrales de validación:** skip rate > 40% ✅ | false negative rate < 5% ✅ | Migración pendiente: `npx tsx scripts/migrate-date-preflight-logs.ts`

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `pipeline.ts` | Orquesta la lógica e invoca al pipeline a través de resiliencia |
| `utils/date-preflight.ts` | Gate pre-NLP: detecta eventos pasados y omite Gemini. `evaluatePreflight()` devuelve `{ skip, reason, datesFound, matchedText }` |
| `utils/preflight-db.ts` | **(NUEVO S50)** Persiste resultados en `date_preflight_logs` (fire-and-forget). Incluye queries de métricas embebidas. |
| `data-pipeline.ts` | **(NUEVO v0.16.1)** Orquestador principal de limpieza atómica NLP pre-persistencia. Reemplazó por completo al antiguo `validation.ts`. Incluye detección de spam (stopwords/ruidos), enriquecimiento (Environment/PricePeriod) y penalización condicional. |
| `resilience.ts` | **(NUEVO v0.16.1)** Proxy dinámico que intenta Cheerio primero y en caso de fallo, dispara Playwright automáticamente |
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

## Proxy residencial (NUEVO v0.16.1+)

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

## 📡 Fuentes Activas (SSOT)

Fuente única: `scripts/seed-scraping-sources.ts`

### Reglas
- Cualquier fuente no presente en el seed → se considera inexistente.
- No documentar fuentes manualmente en este archivo.
- Toda modificación de fuentes debe hacerse vía seed + migración.

### Enforcement
- Documentación debe derivarse del seed, no al revés.

### Telegram
Estado: **PROTOTIPO (no productivo)**
No considerado parte del pipeline oficial.
El extractor y la conexión MTProto existen en código, pero no hay fuentes `TELEGRAM` registradas en la base de datos, por lo que el Scheduler y el Cron nunca lo ejecutarán en producción.

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

## Activity Gate — Semántica de Evento (NUEVO v0.16.1)

El Gate es la primera defensa **de calidad ontológica** del pipeline. Responde a la pregunta "¿Es esto un evento al que una persona puede asistir?" antes de tocar la BD.

### Arquitectura del Gate (doble capa jerárquica)

**Capa 1: LLM Priority Gate** — `isActivity` field en schema Zod de `types.ts`
- Gemini analiza el contenido y emite explícitamente `"isActivity": true/false`.
- El prompt es extremadamente conservador: ante la duda, `false`.
- `isActivity` **no tiene valor por defecto en Zod** — si Gemini no lo emite, o el JSON viene corrupto, se trata como `false`.
- Resultado: `[discard:llm]` en el log diferencial.

**Capa 2: Heuristic Gate** — `activityGate()` en `pipeline.ts`
- Solo se ejecuta si Gemini aprobó la capa 1.
- Valida señales de **intención** (keywords: taller, festival, concierto, función…) y **tiempo** (dateStart, dateEnd, schedule no vacío).
- Palabras negativas causan descarte inmediato.
- Resultado: `[discard:gate]` en el log diferencial.

### Prompt de Gemini (directriz conservadora)

```
Set "isActivity" to TRUE only if:
- A real person could attend this
- There is a clear time reference (date, schedule or upcoming occurrence)

Set "isActivity" to FALSE if:
- It is news, announcement, or institutional content
- It lacks a concrete time to attend

Be conservative: if unsure → FALSE
```

### Métricas de Observabilidad

| Log event | Significado | Acción si sube mucho |
|-----------|-------------|----------------------|
| `[discard:llm]` | Gemini rechazó contenido como no-evento | Normal si fuente mezcla noticias |
| `[discard:gate]` | Gemini lo aprobó pero faltó fecha/intención | Revisar preflight de fechas |
| `llm_rejection_rate` > 60% | Fuente emite demasiado ruido | Pausar / revisar fuente |
| `llm_rejection_rate` < 5% | Gate muy permisivo | Endurecer prompt |

### Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/modules/scraping/types.ts` | Campo `isActivity` en schema Zod (sin default) |
| `src/modules/scraping/nlp/gemini.analyzer.ts` | Prompt conservador + fail-safe en `analyze()` |
| `src/modules/scraping/pipeline.ts` | Jerarquía LLM → Gate → DB + logging diferencial |

## Curaduría Adaptativa (NUEVO v0.16.1-S43)
El Pipeline cuenta con un **Filtro Adaptativo Inteligente** que evalúa dinámicamente si debe descartar una actividad antes de guardarla.
Cruza la Calidad Global del sistema con la métrica de Salud de la Fuente (`SourceHealth`).

Si una actividad falla el filtro adaptativo (`Math.max(adaptive, source)` para la longitud mínima de caracteres valiosos), se descarta con `"DISCARDED_QUALITY"`, logrando **Trazabilidad sin Persistencia**.

**Integración en `storage.ts`:** `saveActivity()` recibe un 5º param opcional `ctx: AdaptiveContext` con `globalMetrics` y `sourceHealthMap`. `saveBatchResults()` carga ambas tablas una sola vez (batch context) y pasa el contexto a cada llamada individual — sin N+1 queries. Retorna log `adaptive_rules_applied` con `discardRate` al finalizar el lote.

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

## Diccionario Maestro de Categorías (Data Pipeline V1)
Todo flujo de Ingesta, posterior al scraping NLP, está obligado a cruzar el `data-pipeline.ts`, el cual sanitiza el vector crudo de categorías que exporta Gemini hacia **10 Buckets Estrictos**:
1. `Arte`
2. `Deporte`
3. `Ciencia`
4. `Aire Libre`
5. `Idiomas`
6. `Música`
7. `Juegos`
8. `Talleres`
9. `Eventos`
10. `General`

Cualquier variante externa (ej. "Taller de pintura al óleo") colapsará atómicamente al grupo correspondiente ("Arte", "Talleres") antes de ser introducida a PostgreSQL. Esta decisión elimina la "Basura Nominal" logrando resultados de búsqueda exactos y limpios.

## Deduplicación

3 niveles independientes:

| Nivel | Cuando | Método |
|-------|--------|--------|
| 1 — Real-time | Al guardar | Jaccard >75% en title+description fingerprint |
| 2 — Cron | Diario | Auto-clean de duplicados exactos |
| 3 — Manual | Ad-hoc | Review 70-90% similitud |

## Pre-filtro de URLs binarias (NUEVO v0.16.1)

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

## 📦 Contrato Estricto (Zod)

El schema en `src/modules/scraping/types.ts` es la única fuente válida.

### Reglas
- No se permiten campos fuera del schema.
- Si el LLM no puede inferir → usar fallback controlado.
- Campos críticos (`minAge`, `isActivity`) no pueden ser null.

### Falla dura
Si `isActivity !== true` → el registro se descarta.
Esto convierte el scraping en pipeline gobernado, no heurístico.

## Limitaciones conocidas

- Gemini 2.5 Flash free tier: **20 RPD** — quota renueva medianoche UTC (19:00 COL)
- Rate limit en pipeline: 12s entre requests a Gemini
- Instagram puede bloquear IPs sin proxy tras uso intensivo → activar IPRoyal
- `scraping/queue/types.ts`: 0% cobertura en tests (solo tipos TypeScript, sin runtime)
- `scraping/extractors/telegram.extractor.ts`: 0% cobertura (sin tests — S28, pendiente)
- JBB publica parte de su agenda como imágenes JPG — el scraper obtiene metadata pero no el contenido detallado
- **Telegram ISP Colombia:** ISP bloquea conexiones MTProto a servidores Telegram. Requiere VPN para autenticación inicial. Una vez obtenido `TELEGRAM_SESSION`, la sesión puede funcionar directamente.
