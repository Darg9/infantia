# HabitaPlan — Estado de Pruebas

Actualizado: 2026-04-08 | Version: v0.9.5-S37

## Resumen

| Metrica | Valor |
|---------|-------|
| Archivos de test | 56 |
| Tests totales | 876 |
| Pasados | 876 |
| Fallidos | 0 |
| Threshold configurado | 85% branches (cap desde día 16) |
| Statements | 91.39% ✅ |
| Branches | 85.90% ✅ |
| Functions | 88.09% ✅ |
| Lines | 92.71% ✅ |

## Estado: PASSED ✅

> Todos los módulos lib/*, lib/supabase/*, activities/*, scraping/queue/* y api/admin/* tienen cobertura alta.
> Los gaps (~15% branches) son: ramas `NODE_ENV !== 'production'`, callbacks de `page.$$eval()` en contexto
> browser (inaccesibles en unit tests), y ramas de Sentry dynamic import que no se pueden mockear limpiamente.

## Archivos de test (56 total)

### lib/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| db.test.ts | 4 | OK |
| utils.test.ts | 20 | OK |
| validation.test.ts | 13 | OK |
| api-response.test.ts | 9 | OK |
| auth.test.ts | 14 | OK |
| expire-activities.test.ts | 16 | OK |
| activity-url.test.ts | 12 | OK |
| category-utils.test.ts | — | OK |
| venue-dictionary.test.ts | 26 | OK |
| geocoding.test.ts | 19 | OK ← NUEVO v0.9.0 (venue dict, Nominatim, fallbacks, rate limit) |
| push.test.ts | 16 | OK ← NUEVO v0.9.0 (sendPushNotification, sendPushToMany, 410/404/500) |
| ratings.test.ts | 3 | OK ← NUEVO v0.9.2 (recalcProviderRating, null avg, error propagation) |
| source-scoring.test.ts | 22 | OK ← NUEVO S32 (calcSourceScore, formatReach, TIER_LABEL/COLOR) |

### lib/supabase/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| client.test.ts | 2 | OK |
| server.test.ts | 4 | OK |
| middleware.test.ts | 5 | OK |

### lib/email/templates/__tests__/ (NUEVO v0.8.1+)
| Archivo | Tests | Estado |
|---------|-------|--------|
| activity-digest.test.tsx | 11 | OK — UTM tracking, bloque sponsor, contenido base |

### modules/scraping/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| cache.test.ts | 25 | OK ← +11 tests (S32): syncFromDb() y saveToDb() con vi.hoisted() |
| types.test.ts | 19 | OK ← +2 tests (S31): normalización title null→'Sin título', categories null/[]→['General'] |
| deduplication.test.ts | 42 | OK |
| storage.test.ts | 24 | OK |
| logger.test.ts | 10 | OK |
| cheerio-extractor.test.ts | 16 | OK |
| playwright-extractor.test.ts | 30 | OK |
| claude-analyzer.test.ts | 11 | OK |
| gemini-analyzer.test.ts | 30 | OK |
| pipeline.test.ts | 34 | OK |
| queue-connection.test.ts | 6 | OK |
| queue-worker.test.ts | 5 | OK |
| queue.test.ts | 9 | OK |

### modules/activities/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| schemas.test.ts | 24 | OK |
| service.test.ts | 32 | OK — incluye relevance sort con isPremium |

### app/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| robots.test.ts | — | OK |
| sitemap.test.ts | 5 | OK |
| not-found.test.tsx | — | OK |

### app/actividades/_components/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| ActivityCard.test.tsx | — | OK — incluye isPremium: false en mock |
| EmptyState.test.tsx | — | OK |
| loading.test.tsx | — | OK |

### app/api/
| Archivo | Tests | Estado |
|---------|-------|--------|
| activities/map/__tests__/ | — | OK |
| activities/suggestions/__tests__/ | — | OK |
| activities/[id]/ratings/__tests__/ | — | OK |
| activities/[id]/view/__tests__/ | — | OK |
| favorites/__tests__/ | — | OK |
| ratings/__tests__/ | — | OK |
| children/__tests__/ | — | OK |
| profile/__tests__/ | — | OK |
| profile/notifications/__tests__/ | — | OK |
| search/log/__tests__/ | — | OK |
| admin/queue/__tests__/ | — | OK |
| admin/send-notifications/__tests__/ | 21 | OK |
| admin/sponsors/__tests__/sponsors.test.ts | 16 | OK — GET/POST/PATCH/DELETE (NUEVO v0.8.1+) |
| ratings/__tests__/ratings.test.ts | 15 | OK — GET/POST list+detail, DELETE, upsert, validaciones (ACTUALIZADO v0.9.1+) |

### components/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| FavoriteButton.test.tsx | — | OK |

### hooks/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| useActivityHistory.test.ts | — | OK |

## Cobertura por módulo clave (v0.9.2)

| Archivo | Stmts | Branch | Funcs | Lines |
|---------|-------|--------|-------|-------|
| lib/api-response.ts | 100% | 100% | 100% | 100% |
| lib/auth.ts | 100% | 100% | 100% | 100% |
| lib/category-utils.ts | 100% | 100% | 100% | 100% |
| lib/db.ts | 100% | 75% | 100% | 100% |
| lib/utils.ts | 100% | 100% | 100% | 100% |
| lib/validation.ts | 100% | 100% | 100% | 100% |
| lib/activity-url.ts | 100% | 100% | 100% | 100% |
| lib/venue-dictionary.ts | 100% | 100% | 100% | 100% |
| lib/supabase/client.ts | 100% | 100% | 100% | 100% |
| lib/supabase/middleware.ts | 100% | 100% | 100% | 100% |
| lib/supabase/server.ts | 100% | 100% | 100% | 100% |
| scraping/cache.ts | 100% | 100% | 100% | 100% |
| scraping/deduplication.ts | 94.44% | 95.23% | 100% | 96.77% |
| scraping/logger.ts | 100% | 100% | 100% | 100% |
| scraping/pipeline.ts | 98.19% | 87.23% | 100% | 99.52% |
| scraping/storage.ts | 100% | 96.87% | 100% | 100% |
| scraping/types.ts | 100% | 100% | 100% | 100% |
| scraping/queue/connection.ts | 100% | 100% | 100% | 100% |
| scraping/queue/producer.ts | 100% | 100% | 100% | 100% |
| scraping/queue/scraping.queue.ts | 100% | 100% | 100% | 100% |
| scraping/queue/scraping.worker.ts | 100% | 100% | 100% | 100% |
| scraping/queue/types.ts | 0% | 0% | 0% | 0% |
| scraping/extractors/cheerio.extractor.ts | 94.02% | 83.92% | 100% | 95.04% |
| scraping/extractors/playwright.extractor.ts | ~97% | ~94% | ~90% | ~98% |
| scraping/nlp/claude.analyzer.ts | 100% | 100% | 100% | 100% |
| scraping/nlp/gemini.analyzer.ts | 94.44% | 89.09% | 94.73% | 94.85% |
| activities/schemas.ts | 100% | 100% | 100% | 100% |
| activities/service.ts | 100% | 100% | 100% | 100% |
| lib/geocoding.ts | 95% | 87% | 95% | 95% |
| lib/push.ts | 94% | 84% | 94% | 94% |
| lib/ratings.ts | 100% | 100% | 100% | 100% |
| lib/logger.ts | ~73% | ~80% | ~46% | ~73% |
| **TOTAL** | **91.39%** | **85.90%** | **88.09%** | **92.71%** |

## Gaps de cobertura conocidos (aceptados)

### scraping/queue/types.ts (0%)
Solo contiene interfaces TypeScript. No hay runtime — 0% es correcto.

### scraping/extractors/playwright.extractor.ts (~10% funcs gap)
Callbacks de `page.$$eval()` / `page.evaluate()` que ejecutan en contexto del browser. En unit tests estos se mockean — limitación fundamental de unit tests con mocks.

### scraping/extractors/cheerio.extractor.ts (~16% branches)
Edge cases de URL malformadas y path `NODE_ENV === 'production'` para rate limiting.

### scraping/nlp/gemini.analyzer.ts (~11% branches)
Rate limiting path (`NODE_ENV !== 'production'` desactivado en tests).

### lib/db.ts (75% branches)
Rama `process.env.NODE_ENV === 'production'` en singleton de Prisma.

## Historial de tests por versión

| Version | Tests | Archivos | Stmts | Branch |
|---------|-------|----------|-------|--------|
| v0.3.0 | 236 | 16 | ~85% | ~76% |
| v0.4.0 | 294 | 20 | ~88% | ~79% |
| v0.5.0 | 314 | 21 | ~95% | ~88% |
| v0.6.1 | 473 | 35 | 86.85% | 78.57% |
| v0.7.0 | 531 | 36 | 90.53% | 82.9% |
| v0.7.1 | 581 | 38 | 98.32% | 93.07% |
| v0.7.3 | 636 | 40 | 97.41% | 92.5% |
| v0.8.0 | 695 | 46 | ~97% | ~93% |
| v0.8.1 | 721 | 47 | ~97% | ~93% |
| v0.8.1+ | 748 | 49 | ~97% | ~93% |
| **v0.9.0** | **783** | **51** | **91.76%** | **86.98%** |
| **v0.9.1** | **792** | **52** | **91.73%** | **86.70%** |
| **v0.9.2** | **795** | **53** | **90.66%** | **85.18%** |
| **v0.9.3** | **795** | **53** | **90.66%** | **85.18%** |
| **v0.9.3-S31** | **797** | **53** | **90.66%** | **85.18%** |
| **v0.9.3-S32** | **832** | **54** | **90.95%** | **85.69%** |
| **v0.9.3-S33** | **838** | **54** | **90.95%** | **85.69%** |
| **v0.9.3-S34** | **835** | **55** | **90.95%** | **85.69%** |
| **v0.9.4-S35** | **876** | **56** | **91.39%** | **85.90%** |
| **v0.9.5-S37** | **876** | **56** | **91.39%** | **85.90%** |

## Cambios en S37 (v0.9.5-S37)

- **Sin nuevos tests** — cambios UI-only (Server Components + un Client Component sin lógica testeable adicional)
- `ActivityCard` prop `compact` compatible con todos los 876 tests existentes (default `false`)
- TypeScript: 0 errores ✅ | Branches: 85.90% ✅ (sobre umbral 85%)

## Cambios en S35 (v0.9.4-S35)

- **+41 tests** (835 → 876): +13 `source-pause-manager.test.ts` (nuevo) + 28 `url-classifier.test.ts` (S34, contabilizados en S35)
- **2 archivos nuevos de test:** `source-pause-manager.test.ts` + `url-classifier.test.ts`
- Fix TS: `expire-activities.test.ts` — `makeActivity` con tipos `Date | null` explícitos
- Coverage branches: 85.69% → 85.90% ✅

## Cambios en S35 — nuevos archivos
| Archivo | Tests | Estado |
|---------|-------|--------|
| lib/__tests__/url-classifier.test.ts | 28 | OK ← NUEVO S34 (100% cobertura) |
| lib/__tests__/source-pause-manager.test.ts | 13 | OK ← NUEVO S35 (auto-pause logic) |

## Cambios en S32 (v0.9.3-S32)

- **+35 tests** (797 → 832): corrección de cobertura
  - `cache.test.ts` +11 tests: `syncFromDb()` (4 tests) + `saveToDb()` (4 tests) + `load()` (2) + refactor con `vi.hoisted()`
  - `source-scoring.test.ts` nuevo (22 tests): `calcSourceScore()`, `formatReach()`, `TIER_LABEL`, `TIER_COLOR`
- `cache.ts`: imports estáticos (antes dinámicos `await import()`) — requerido para que `vi.mock()` los intercepte en Vitest 4
- Coverage branches: 85.18% → 85.69% ✅

## Cambios en S31 (v0.9.3-S31)

- **+2 tests** (795 → 797): `types.test.ts` — 4 nuevos tests de normalización (reemplazan 2 existentes que cambiaron semántica)
  - `title null` → normaliza a `'Sin título'`
  - `title ''` → normaliza a `'Sin título'`
  - `categories null` → normaliza a `['General']`
  - `categories []` → normaliza a `['General']`
- `ScrapingCache`: nuevos métodos `syncFromDb()` y `saveToDb()` — mockeados en pipeline.test.ts

## Cambios respecto a v0.9.2 (v0.9.3)

- Sin cambios en tests — mismos 795/53 archivos
- npm audit fix: Vite vuln (high) → 0 vulnerabilidades

## Cambios respecto a v0.9.1

- **+3 tests** (792 → 795)
- **+1 archivo de test** (52 → 53):
  - `lib/__tests__/ratings.test.ts` (3 tests) — recalcProviderRating, null avg, propagación errores
- `lib/ratings.ts`: cobertura 0% → 100%
- Branches: 84.91% → 85.18% ✅ (recovery del umbral por ratings.ts sin cobertura)
