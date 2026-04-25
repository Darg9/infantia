# HabitaPlan — Estado de Pruebas

Actualizado: 25 de abril de 2026 | Version: v0.17.0-beta

## Resumen Actual (v0.17.0-beta / SIC Compliance & Phase 3 Audit)
- **Archivos de Test:** 78
- **Tests Totales:** 1245 (1243 pasan ✅, 2 skipped)
- **Estado:** 100% pasando ✅
- **Framework:** Vitest 4.1 (+ React Testing Library + Playwright E2E)
- **Cobertura:** >91% stmts / >85% branches / >88% funcs / >91% lines

## 🛡️ Deuda Técnica UI (Design System Enforcement)
*Baseline medido al activar el enforcement mecánico (ESLint)*

- **UI Debt (Tailwind directo / Elementos Nativos):** 1344 warnings (baseline)
- **Objetivo:** 0 warnings
- **Estrategia (Boy Scout Rule):** Limpieza progresiva al tocar el archivo.

**Prioridad de Limpieza:**
1. Componentes en `src/components/ui/*`
2. Layouts principales (`Header`, `MobileNav`, `Footer`)
3. Páginas de primer nivel
4. Resto del árbol de renderizado

## Resumen

| Metrica | Valor |
|---------|-------|
| Archivos de test | 76 |
| Tests totales | 1220 |
| Pasados | 1218 |
| Skipped | 2 |
| Fallidos | 0 |
| Threshold configurado | 85% branches (cap desde día 33) |
| Statements | >91% ✅ |
| Branches | >85% ✅ |
| Functions | >88% ✅ |
| Lines | >91% ✅ |

## Archivos de test (76 total)

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
| geocoding.test.ts | 19 | OK ← NUEVO v0.16.1 (venue dict, Nominatim, fallbacks, rate limit) |
| push.test.ts | 16 | OK ← NUEVO v0.16.1 (sendPushNotification, sendPushToMany, 410/404/500) |
| ratings.test.ts | 3 | OK ← NUEVO v0.16.1 (recalcProviderRating, null avg, error propagation) |
| source-scoring.test.ts | 22 | OK ← NUEVO S32 (calcSourceScore, formatReach, TIER_LABEL/COLOR) |

### lib/supabase/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| client.test.ts | 2 | OK |
| server.test.ts | 4 | OK |
| middleware.test.ts | 5 | OK |

### lib/email/templates/__tests__/ (NUEVO v0.16.1+)
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
| date-preflight.test.ts | 36 | OK ← +19 S50 (matchedText, extractFirstRawDateText, evaluatePreflight matchedText) |
| preflight-db.test.ts | 8 | OK ← NUEVO S50 (savePreflightLog, used_fallback, fire-and-forget, vi.hoisted) |

### modules/activities/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| schemas.test.ts | 24 | OK |
| service.test.ts | 32 | OK — incluye relevance sort con isPremium |
| ranking.test.ts | +7 | OK ← NUEVO S44 (ctrBoost default=0, tiers, score addition) |
| price-normalization.test.ts | — | OK ← normalizePrice, edge cases |

### modules/analytics/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| metrics.test.ts | 11 | OK ← NUEVO S44 (getCTRByDomain, ctrToBoost, cache TTL 5min, fail-safe, domain join) |

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
| activities/suggestions/__tests__/ | 13 | OK ← ACTUALIZADO S40 (+6 tests, mocks categorías+ciudades, nuevo formato SuggestionItem) |
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
| admin/sponsors/__tests__/sponsors.test.ts | 16 | OK — GET/POST/PATCH/DELETE (NUEVO v0.16.1+) |
| ratings/__tests__/ratings.test.ts | 15 | OK — GET/POST list+detail, DELETE, upsert, validaciones (ACTUALIZADO v0.16.1+) |

### components/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| FavoriteButton.test.tsx | — | OK |

### hooks/__tests__/
| Archivo | Tests | Estado |
|---------|-------|--------|
| useActivityHistory.test.ts | — | OK |

## Cobertura por módulo clave (v0.16.1)

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
| v0.16.1 | 236 | 16 | ~85% | ~76% |
| v0.16.1 | 294 | 20 | ~88% | ~79% |
| v0.16.1 | 314 | 21 | ~95% | ~88% |
| v0.16.1 | 473 | 35 | 86.85% | 78.57% |
| v0.16.1 | 531 | 36 | 90.53% | 82.9% |
| v0.16.1 | 581 | 38 | 98.32% | 93.07% |
| v0.16.1 | 636 | 40 | 97.41% | 92.5% |
| v0.16.1 | 695 | 46 | ~97% | ~93% |
| v0.16.1 | 721 | 47 | ~97% | ~93% |
| v0.16.1+ | 748 | 49 | ~97% | ~93% |
| **v0.16.1** | **783** | **51** | **91.76%** | **86.98%** |
| **v0.16.1** | **792** | **52** | **91.73%** | **86.70%** |
| **v0.16.1** | **795** | **53** | **90.66%** | **85.18%** |
| **v0.16.1** | **795** | **53** | **90.66%** | **85.18%** |
| **v0.16.1-S31** | **797** | **53** | **90.66%** | **85.18%** |
| **v0.16.1-S32** | **832** | **54** | **90.95%** | **85.69%** |
| **v0.16.1-S33** | **838** | **54** | **90.95%** | **85.69%** |
| **v0.16.1-S34** | **835** | **55** | **90.95%** | **85.69%** |
| **v0.16.1-S35** | **876** | **56** | **91.39%** | **85.90%** |
| **v0.16.1-S37** | **876** | **56** | **91.39%** | **85.90%** |
| **v0.16.1-S38** | **876** | **56** | **91.39%** | **85.90%** |
| **v0.16.1-S39** | **876** | **56** | **91.39%** | **85.90%** |
| **v0.16.1-S40** | **882** | **56** | **91.39%** | **85.90%** |
| **v0.16.1-S41** | **882** | **56** | **91.39%** | **85.90%** |
| **v0.16.1-S42** | **889** | **58** | **91.39%** | **85.90%** |
| **v0.16.1-S43** | **898** | **59** | **>91%** | **>85%** |
| **v0.16.1-S44** | **916** | **60** | **>91%** | **>85%** |
| **v0.16.1-S45** | **916** | **60** | **>91%** | **>85%** |
| **v0.16.1-S47** | **1039** | **68** | **>91%** | **>85%** |
| **v0.16.1-S48** | **1056** | **69** | **>91%** | **>85%** |
| **v0.16.1-S48b** | **1070** | **69** | **>91%** | **>85%** |
| **v0.16.1-S49** | **1082** | **69** | **>91%** | **>85%** |
| **v0.16.1-S50** | **1101** | **70** | **>91%** | **>85%** |
| **v0.16.1-S51** | **1105** | **70** | **>91%** | **>85%** |
| **v0.16.1-S52** | **1123** | **71** | **>91%** | **>85%** |
| **v0.16.1-S53** | **1155** | **73** | **>91%** | **>85%** |
| **v0.16.1-S54** | **1191** | **73** | **>91%** | **>85%** |
| **v0.16.1-S55** | **1203** | **73** | **>91%** | **>85%** |
| **v0.12.x** | **1215** | **75** | **>91%** | **>85%** |
| **v0.16.1** | **1214** | **75** | **>91%** | **>85%** |
| **v0.17.0** | **1245** | **78** | **>91%** | **>85%** |

## Cambios en v0.16.1 (Multi-City Map Architecture)

- **Sin tests nuevos** — nuevos archivos son Server/Client Components UI-only:
  - `src/app/actividades/layout.tsx` (Server Component, no lógica testeable unitariamente)
  - `src/components/providers/CityProvider.tsx` (Client Component con useSearchParams — requiere browser env)
  - `src/lib/city/resolveCity.ts` — **candidato a test futuro** (función pura `resolveCityId`)
- `MapInner.tsx` modificado: `useCity()` + ramas `markers.length === 0 && city` — cubierta por render paths existentes
- TypeScript: 0 errores ✅ | `tsc --noEmit` clean ✅

## Cambios en S54 y S55 (v0.16.1-S55 / Pipeline Optimization)

- **+48 tests** (1155 → 1203):
  - **S54**: `cache.test.ts` +7 tests por el nuevo filtro SPI (Sitemap Pre-Index) basado en lastmod.
  - **S55**: `cache.test.ts` +9 tests de cobertura completa para `needsReparse`, `isMarkedForReparse` y `getReparseUrls` en el Scheduler Inteligente. `pipeline.test.ts` con mock de reparseUrls.
- TypeScript: 0 errores ✅ | Coverage: >85% branches ✅

## Cambios en S48 (v0.16.1-S48 / Observabilidad Confiable v2)

- **+17 tests** (1039 → 1056): date preflight filter + nuevos archivos de test
  - **S48** +17: `date-preflight.test.ts` NUEVO — `isPastEventContent`, 3 formatos fecha, buffer 14d, fecha fija REF
- Nuevo archivo de test: `src/modules/scraping/__tests__/date-preflight.test.ts`
- Nuevo archivo E2E: `e2e/health.spec.ts` (Playwright, 5 tests `/api/health`)
- TypeScript: 0 errores ✅ | Coverage: >85% branches ✅

## Cambios en S47 (v0.16.1-S47 / Sources CRUD · pg_trgm · Scheduler)

- **+123 tests** (916 → 1039): suites existentes ampliadas, nuevos archivos
- Nuevos archivos: `suggestions.test.ts` ampliado, `queue/producer.test.ts`, varios módulos admin

## Cambios en S43-S44 (v0.16.1-S43 / v0.16.1-S44)

- **+27 tests** (889 → 916): filtro adaptativo + CTR feedback loop
  - **S43** +6: `storage.test.ts` — carga batch única, descartes globales/fuente, Math.max, neutral default
  - **S44** +11: `analytics/__tests__/metrics.test.ts` NUEVO — CTR computation, aggregation, cache, fail-safe
  - **S44** +7: `ranking.test.ts` — ctrBoost default, suma al score, tiers `ctrToBoost()`
- Nuevos archivos de test: `src/modules/analytics/__tests__/metrics.test.ts`
- TypeScript: 0 errores ✅ | Coverage: >85% branches ✅

## Cambios en S40 (v0.16.1-S40)

- **+6 tests** (876 → 882): `suggestions/__tests__/suggestions.test.ts` actualizado
  - Mocks añadidos: `mockCategoryFindMany`, `mockCityFindMany`
  - Nuevos tests: formato actividad (type/id/label/sublabel), formato categoría, formato ciudad, max 5, orden tipos, sublabel null

## Cambios en S38-S39 (v0.16.1/v0.16.1)

- **Sin nuevos tests** — cambios UI (Client Components sin lógica testeable en unit tests)
- TypeScript: 0 errores ✅ | Branches: 85.90% ✅

## Cambios en S37 (v0.16.1-S37)

- **Sin nuevos tests** — cambios UI-only (Server Components + un Client Component sin lógica testeable adicional)
- `ActivityCard` prop `compact` compatible con todos los 876 tests existentes (default `false`)
- TypeScript: 0 errores ✅ | Branches: 85.90% ✅ (sobre umbral 85%)

## Cambios en S35 (v0.16.1-S35)

- **+41 tests** (835 → 876): +13 `source-pause-manager.test.ts` (nuevo) + 28 `url-classifier.test.ts` (S34, contabilizados en S35)
- **2 archivos nuevos de test:** `source-pause-manager.test.ts` + `url-classifier.test.ts`
- Fix TS: `expire-activities.test.ts` — `makeActivity` con tipos `Date | null` explícitos
- Coverage branches: 85.69% → 85.90% ✅

## Cambios en S35 — nuevos archivos
| Archivo | Tests | Estado |
|---------|-------|--------|
| lib/__tests__/url-classifier.test.ts | 28 | OK ← NUEVO S34 (100% cobertura) |
| lib/__tests__/source-pause-manager.test.ts | 13 | OK ← NUEVO S35 (auto-pause logic) |

## Cambios en S32 (v0.16.1-S32)

- **+35 tests** (797 → 832): corrección de cobertura
  - `cache.test.ts` +11 tests: `syncFromDb()` (4 tests) + `saveToDb()` (4 tests) + `load()` (2) + refactor con `vi.hoisted()`
  - `source-scoring.test.ts` nuevo (22 tests): `calcSourceScore()`, `formatReach()`, `TIER_LABEL`, `TIER_COLOR`
- `cache.ts`: imports estáticos (antes dinámicos `await import()`) — requerido para que `vi.mock()` los intercepte en Vitest 4
- Coverage branches: 85.18% → 85.69% ✅

## Cambios en S31 (v0.16.1-S31)

- **+2 tests** (795 → 797): `types.test.ts` — 4 nuevos tests de normalización (reemplazan 2 existentes que cambiaron semántica)
  - `title null` → normaliza a `'Sin título'`
  - `title ''` → normaliza a `'Sin título'`
  - `categories null` → normaliza a `['General']`
  - `categories []` → normaliza a `['General']`
- `ScrapingCache`: nuevos métodos `syncFromDb()` y `saveToDb()` — mockeados en pipeline.test.ts

## Cambios respecto a v0.16.1 (v0.16.1)

- Sin cambios en tests — mismos 795/53 archivos
- npm audit fix: Vite vuln (high) → 0 vulnerabilidades

## Cambios respecto a v0.16.1

- **+3 tests** (792 → 795)
- **+1 archivo de test** (52 → 53):
  - `lib/__tests__/ratings.test.ts` (3 tests) — recalcProviderRating, null avg, propagación errores
- `lib/ratings.ts`: cobertura 0% → 100%
- Branches: 84.91% → 85.18% ✅ (recovery del umbral por ratings.ts sin cobertura)

## Cambios en v0.17.0 (SIC Compliance & Phase 3 Audit)

- **Restauración de Regresiones**:
    - `activity-gate.test.ts` (25 tests): Restaurados para prevenir el bug de hostname (EndsWith logic) y falsos positivos institucionales.
- **Validación de Persistencia**:
    - `smoke-test-phase3.ts` (NUEVO): Script de validación E2E para el refactor de `saveActivity` (objetos estructurados).
- **Compliance Audit**:
    - Manual Check: Verificación del Cron `/api/admin/check-overdue-pqrs` para SLAs de 3/15 días.
- **Instrumentación**:
    - Logs `[BATCH:SUMMARY]` y `[DEDUPE_HIT]` validados en `storage.ts`.
- TypeScript: 0 errores ✅ | Coverage: Mantenido >85% branches ✅
