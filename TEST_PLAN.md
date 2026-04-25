# HabitaPlan — Plan de Pruebas

**Version:** v0.17.0-beta | **Fecha:** 2026-04-25
**Framework:** Vitest + @vitest/coverage-v8
**Threshold:** 85% (cap desde dia 16 del proyecto — 2026-04-24)

---

## Filosofia

Cada PR incluye codigo + tests + docs. El CI verifica cobertura en cada push.
Patron DDL: Supabase pgbouncer (transaction mode) es incompatible con `prisma migrate dev`.
Se usan scripts `migrate-*.ts` con `$executeRawUnsafe()` para DDL — sin tests unitarios (verificacion manual en BD).

---

## Thresholds dinamicos

| Dia | Fecha | Threshold |
|-----|-------|-----------|
| 1 | 2026-04-24 | 30% |
| 5 | 2026-04-24 | 70% |
| 7 | 2026-04-24 | 85% (cap) |
| 16+ | 2026-04-24+ | 85% (mantenido) |

Calculado automaticamente en `vitest.config.ts`. Cap fijo en 85% para evitar bloqueos por gaps estructurales.

---

## Cobertura actual (v0.17.0-S57)

| Modulo | Test | Stmts | Funcs | Estado |
|--------|------|-------|-------|--------|
| lib/utils | utils.test.ts | 100% | 100% | OK |
| lib/validation | validation.test.ts | 100% | 100% | OK |
| lib/api-response | api-response.test.ts | 100% | 100% | OK |
| lib/auth | auth.test.ts | 100% | 100% | OK |
| lib/db | db.test.ts | 100% | 100% | OK |
| lib/activity-url | activity-url.test.ts | 100% | 100% | OK |
| lib/category-utils | category-utils.test.ts | 100% | 100% | OK |
| lib/venue-dictionary | venue-dictionary.test.ts | 100% | 100% | OK |
| lib/expire-activities | expire-activities.test.ts | 100% | 100% | OK |
| lib/geocoding | geocoding.test.ts | 95% | 95% | OK ← NUEVO v0.16.1 |
| lib/push | push.test.ts | 94% | 94% | OK ← NUEVO v0.16.1 |
| lib/logger | — | ~85% | ~85% | Sin tests dedicados (Sentry dynamic import dificulta mock) |
| lib/email/templates/activity-digest | activity-digest.test.tsx | ~95% | 100% | OK |
| lib/supabase/client | client.test.ts | 100% | 100% | OK |
| lib/supabase/middleware | middleware.test.ts | 100% | 100% | OK |
| lib/supabase/server | server.test.ts | 100% | 100% | OK |
| scraping/cache | cache.test.ts | 100% | 100% | OK |
| scraping/types | types.test.ts | 100% | 100% | OK |
| scraping/deduplication | deduplication.test.ts | 94% | 100% | OK |
| scraping/storage | storage.test.ts | 100% | 100% | OK ← NUEVO S43 (adaptive filter, batch context, discardRate) |
| scraping/logger | logger.test.ts | 100% | 100% | OK |
| scraping/pipeline | pipeline.test.ts | 98% | 100% | OK |
| scraping/cheerio-extractor | cheerio-extractor.test.ts | 94% | 100% | OK |
| scraping/playwright-extractor | playwright-extractor.test.ts | ~97% | ~90% | OK |
| scraping/claude-analyzer | claude-analyzer.test.ts | 100% | 100% | OK |
| scraping/gemini-analyzer | gemini-analyzer.test.ts | 94% | 94% | OK |
| scraping/queue/connection | queue-connection.test.ts | 100% | 100% | OK |
| scraping/queue/scraping.queue | queue.test.ts | 100% | 100% | OK |
| scraping/queue/scraping.worker | queue-worker.test.ts | 100% | 100% | OK |
| scraping/queue/producer | queue.test.ts | 100% | 100% | OK |
| activities/schemas | schemas.test.ts | 100% | 100% | OK |
| activities/ranking | ranking.test.ts | 100% | 100% | OK ← NUEVO S44 (ctrBoost default, tiers, score addition) |
| activities/service | service.test.ts | 100% | 100% | OK |
| analytics/metrics | metrics.test.ts | 100% | 100% | OK ← NUEVO S44 (getCTRByDomain, ctrToBoost, cache, fail-safe) |
| api/admin/sponsors | sponsors.test.ts | ~95% | 100% | OK |
| lib/ratings | — | Sin test dedicado (testeado via ratings API) | — | OK |
| api/ratings | ratings.test.ts | ~90% | 100% | OK ← ACTUALIZADO v0.16.1 (recalcProviderRating mock) |
| lib/source-scoring | source-scoring.test.ts | 100% | 100% | OK ← NUEVO S32 (calcSourceScore, formatReach, TIER_LABEL/COLOR) |

**Total v0.17.0: >91% stmts / >85% branches / 77 archivos | 1244 tests (2 skipped)**

---

## Escenarios cubiertos por modulo

### lib/email/templates/activity-digest (11 tests — NUEVO v0.16.1+)
- UTM tracking links "Ver detalles": `utm_campaign=digest_daily` y `digest_weekly`
- UTM tracking CTA "Ver todas las actividades"
- Link actividad apunta a URL correcta con UTM
- Bloque sponsor: no renderiza si no se pasa prop
- Bloque sponsor: renderiza name, tagline, link con `utm_campaign=newsletter`
- Sponsor sin logoUrl: no renderiza img
- Sponsor con logoUrl: renderiza img
- Contenido base: nombre de usuario, cantidad actividades, "hoy" vs "esta semana"
- Truncado de descripcion a 120 caracteres

### api/admin/sponsors (16 tests — NUEVO v0.16.1+)
- GET: retorna lista, ordena por createdAt desc, retorna 401 si no admin
- POST: crea con datos validos (201), retorna 400 sin campos requeridos, 400 URL invalida, 401 sin admin
- POST: pasa campaignStart como Date si se proporciona
- PATCH: actualiza parcialmente, retorna 400 si URL invalida, retorna 401 sin admin
- DELETE: elimina y retorna ok:true, retorna 401 sin admin

### activities/service (32 tests — actualizado v0.16.1+)
- Relevance orderBy: `[{ status: 'asc' }, { provider: { isPremium: 'desc' } }, { sourceConfidence: 'desc' }, { createdAt: 'desc' }]`
- Resto de filtros: vertical, city, price, age, type, category, audience, search, pagination

---

## Modulos sin tests unitarios (requieren E2E o inspeccion manual)

| Modulo | Razon | Prioridad |
|--------|-------|-----------|
| components/layout/Header | Server Component con query DB (providerSlug) — requiere RSC testing | Baja |
| components/layout/UserMenu | Client Component con estado y router | Baja |
| app/admin/sponsors/page.tsx | Client Component CRUD — requiere E2E | Baja |
| app/proveedores/[slug]/dashboard/page.tsx | Server Component — requiere E2E | Baja |
| app/anunciate/page.tsx | Pagina estatica — sin logica testeable | N/A |
| scripts/migrate-*.ts | DDL via raw SQL — verificacion manual en BD | N/A |

---

## Comandos

```bash
npm test                  # Suite rapida sin cobertura (1244 tests)
npm run test:coverage     # Con reporte (verifica threshold 85%)
npx vitest run <archivo>  # Test especifico
```

---

## Roadmap de pruebas

### Completado hasta v0.17.0-S57
- ✅ 1244 tests, 77 archivos, todos verdes
- ✅ activity-gate.test.ts: hostname matching exacto + sufijo (bug substring corregido S56)
- ✅ storage.test.ts: SaveActivityResult type (id+action) — 9 tests actualizados S57
- ✅ PQRS: firstRespondedAt + responseChannel en ContactRequest (S56)
- ✅ src/lib/pqrs.ts SSOT: RESPONSE_CHANNELS, CONTACT_CATEGORIES, PQRS_SLA (S56)

### Completado hasta v0.16.1-S48
- ✅ 1056 tests, 69 archivos, todos verdes
- ✅ date-preflight.test.ts: 17 tests (isPastEventContent, 3 formatos, buffer 14d, conservador)
- ✅ e2e/health.spec.ts: 5 Playwright tests (/api/health, by_city shape, latencia < 3s)

### Completado hasta v0.16.1-S45
- ✅ 916 tests, 60 archivos, todos verdes
- ✅ analytics/metrics.test.ts: 11 tests (getCTRByDomain, ctrToBoost tiers, cache TTL, fail-safe, domain join)
- ✅ activities/ranking.test.ts +7: ctrBoost default/addition/tiers (S44)
- ✅ scraping/storage.test.ts +6: adaptive filter batch context, global rule, source rule, Math.max, passing case (S43)

### Completado hasta v0.16.1
- ✅ 783 tests, 51 archivos, todos verdes
- ✅ geocoding.ts: 19 tests (venue dict, Nominatim, rate limit, fallbacks, HTTP/network errors)
- ✅ push.ts: 16 tests (sendPushNotification: success/410/404/500/400/network, sendPushToMany: mixed expiry)
- ✅ UTM tracking + bloque sponsor en email
- ✅ CRUD API sponsors (admin)
- ✅ isPremium en relevance orderBy
- ✅ venue-dictionary 40+ venues

### Proximos (v0.9.x)
- Tests dedicados para `lib/logger.ts` (Sentry path actualmente difícil de mockear)
- E2E: `/admin/sponsors` CRUD completo
- E2E: `/proveedores/[slug]/dashboard` — acceso admin y owner
- E2E: `/api/health` — verificar respuestas 200/503

---

## Checklist por PR

- [ ] `npm test` pasa (1213+ tests) — `npm run lint` sin errores nuevos (ESLint freeze S45)
- [ ] `npm run test:coverage` supera 85% branches
- [ ] Sin skip/todo sin justificacion
- [ ] Happy path + al menos 1 caso de error por funcion publica
- [ ] Docs del modulo actualizados si aplica

---

## Historial de actualizaciones del Plan de Pruebas

| Version | Archivos | Tests | Notas |
|---|---|---|---|
| v0.16.1-S48 | 69 | 1056 | Date Preflight, Parser Resiliente |
| v0.16.1 | 73 | 1203 | Activity Gate, Geographic backfill |
| v0.16.1 | 73 | 1215 | Design System Enforcement, Chromatic |
| v0.16.1 | 75 | 1215 | Search Assist System E2E |
| **v0.16.1** | **75** | **1213+2skip** | **Branding Pipeline; fix searchLog mock en suggestions.test.ts; fix createdAt exacto en ranking.test.ts** |
