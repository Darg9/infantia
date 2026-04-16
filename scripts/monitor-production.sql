-- =============================================================================
-- HabitaPlan — Queries de monitoreo de producción
-- Ejecutar en Supabase SQL Editor al final del día 1 y día 3 de cron activo.
-- Comparar ambas lecturas para detectar tendencias, no valores absolutos.
-- =============================================================================

-- ── 1. SCHEDULER — distribución y detección de starvation ────────────────────
-- Muestra fuentes activas procesadas en las últimas 72h.
-- Nulls primero = nunca procesadas = mayor prioridad.

SELECT name, platform, last_run_at, last_run_status, last_run_items
FROM scraping_sources
WHERE is_active = true
  AND (last_run_at IS NULL OR last_run_at > NOW() - INTERVAL '72 hours')
ORDER BY last_run_at ASC NULLS FIRST;

-- Detección de starvation: ¿las mismas 3 fuentes dominan siempre?
-- Si pos 1-3 son siempre las mismas en cada snapshot → activar round-robin.

WITH ranked AS (
  SELECT name, last_run_at,
         ROW_NUMBER() OVER (ORDER BY last_run_at ASC NULLS FIRST) AS pos
  FROM scraping_sources
  WHERE is_active = true
)
SELECT * FROM ranked WHERE pos <= 3;


-- ── 2. EFICACIA DEL SCRAPING — por fuente (últimas 72h) ──────────────────────
-- fail_rate > 0.50 con ≥ 3 runs → pausar fuente o bajar prioridad
-- avg_new < 1 en TODAS las fuentes → problema upstream (Gemini quota o fuentes muertas)

SELECT
  ss.name,
  COUNT(*) FILTER (WHERE sl.status = 'FAILED') * 1.0 / COUNT(*) AS fail_rate,
  COUNT(*)                                                        AS runs,
  SUM(sl.items_new)                                               AS total_new,
  ROUND(COALESCE(AVG(sl.items_new), 0), 1)                        AS avg_new
FROM scraping_logs sl
JOIN scraping_sources ss ON ss.id = sl.source_id
WHERE sl.started_at > NOW() - INTERVAL '72 hours'
GROUP BY sl.source_id, ss.name
HAVING COUNT(*) >= 3
ORDER BY total_new DESC;


-- ── 3. SEARCH — queries con 0 resultados ─────────────────────────────────────
-- Filtra queries < 3 chars (ruido de autocomplete, normal).
-- >40% de estas queries como % del total → bajar threshold similarity (0.25 → 0.20)

SELECT query, COUNT(*) AS veces
FROM events
WHERE type = 'search_applied'
  AND created_at > NOW() - INTERVAL '72 hours'
  AND metadata->>'results' = '0'
  AND LENGTH(query) >= 3
GROUP BY query
ORDER BY veces DESC
LIMIT 20;

-- Tasa global de 0 resultados vs total de búsquedas
WITH t AS (
  SELECT
    COUNT(*) FILTER (WHERE metadata->>'results' = '0') AS zeros,
    COUNT(*)                                            AS total
  FROM events
  WHERE type = 'search_applied'
    AND created_at > NOW() - INTERVAL '72 hours'
    AND LENGTH(query) >= 3
)
SELECT
  zeros                                            AS zero_results,
  total                                            AS total_searches,
  ROUND(zeros::numeric / NULLIF(total, 0) * 100, 1) AS zero_pct
FROM t;


-- ── 4. CTR — señal de engagement ─────────────────────────────────────────────
-- CTR < 0.01 con views reales → problema UX (no de ranking)
-- CTR > 0.05 → sistema funcionando, ranking tiene sentido estadístico

WITH agg AS (
  SELECT
    COUNT(*) FILTER (WHERE type = 'activity_view')   AS views,
    COUNT(*) FILTER (WHERE type = 'outbound_click')  AS clicks,
    COUNT(*) FILTER (WHERE type = 'page_view')       AS page_views,
    COUNT(*) FILTER (WHERE type = 'search_applied')  AS searches
  FROM events
  WHERE created_at > NOW() - INTERVAL '72 hours'
)
SELECT
  page_views,
  searches,
  views,
  clicks,
  CASE WHEN views > 0 THEN ROUND(clicks::numeric / views, 3) ELSE 0 END AS ctr
FROM agg;


-- ── 5. LOW-YIELD SOURCES — candidatas a pausa ────────────────────────────────
-- Condición: avg_new < 1 con ≥ 3 runs → fuente sin retorno real de cuota Gemini.
-- No pausar en día 1. Confirmar en día 3 antes de actuar.

SELECT
  ss.name,
  ss.platform,
  COUNT(*)                                                        AS runs,
  SUM(sl.items_new)                                               AS total_new,
  ROUND(COALESCE(AVG(sl.items_new), 0), 2)                        AS avg_new,
  COUNT(*) FILTER (WHERE sl.status = 'FAILED') * 1.0 / COUNT(*) AS fail_rate
FROM scraping_logs sl
JOIN scraping_sources ss ON ss.id = sl.source_id
WHERE sl.started_at > NOW() - INTERVAL '72 hours'
  AND ss.is_active = true
GROUP BY sl.source_id, ss.name, ss.platform
HAVING COUNT(*) >= 3 AND AVG(sl.items_new) < 1
ORDER BY avg_new ASC, fail_rate DESC;

-- Si aparece una fuente aquí en día 1 Y día 3 → candidata a pausa.
-- Acción: toggle is_active = false en /admin/sources (no borrar — puede reactivarse).


-- ── TABLA DE DECISIÓN ─────────────────────────────────────────────────────────
--
-- Señal                  | OK       | Revisar
-- -----------------------|----------|---------------------------
-- Fuentes procesadas/día | ≥ 15     | < 10
-- avg_new por fuente     | ≥ 3      | < 1
-- Fail rate por source   | < 30%    | > 50%
-- Queries 0 resultados   | < 20%    | > 40%
-- CTR (outbound/view)    | > 0.05   | < 0.01
-- Low-yield (avg_new<1)  | 0 fuente | ≥ 1 sostenida día 1+3
--
-- Decisiones:
--   starvation confirmado  → round-robin (cursor persistente, no random)
--   fail_rate alto         → pausar fuente o bajar prioridad en SourceHealth
--   avg_new bajo global    → revisar Gemini quota o fuentes muertas
--   low-yield sostenida    → toggle is_active=false en /admin/sources
--   muchos 0 resultados    → similarity threshold: 0.25 → 0.20
--   CTR bajo con views     → problema UX, no de ranking
--
-- Metodología: día 1 = baseline (ruido esperado, no sobre-reaccionar)
--              día 3 = tendencia clara → tomar decisiones
--
-- Guardrails operativos:
--   1. No pausar en primer match — confirmar en día 1 Y día 3
--   2. Aplicar cambios uno a uno — pausar 1-2 fuentes, esperar 24-48h, luego siguiente
--   3. Registrar decisiones — comentario en scraping_sources.notes o log de admin
