-- Migration: add_missing_telemetry_tables
-- Date: 2026-05-13
-- Reason: date_preflight_logs y source_run_metrics nunca fueron migradas a producción.
--   Ambas tablas existen en código (preflight-db.ts, storage.ts) pero no en Supabase.
--   Resultado: inserts non-fatal fallan con 42P01 "relation does not exist".
--   Consecuencia real: sin trazabilidad de Date Preflight ni métricas de run por fuente.
--   Crítico ahora que DATE_FILTER_ENABLED=true: DateCov y calidad temporal son señales
--   de producción, no métricas opcionales.

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: date_preflight_logs
-- Persiste el resultado de cada evaluación Date Preflight (fire-and-forget).
-- Vocabulario reason: process | datetime_past | text_date_past | past_year_only | keyword_past
-- TTL recomendado: 14 días (DELETE WHERE created_at < now() - interval '14 days')
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS date_preflight_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       TEXT,
  url             TEXT        NOT NULL,
  raw_date_text   TEXT,
  parsed_date     TIMESTAMPTZ,
  reason          TEXT        NOT NULL,
  used_fallback   BOOLEAN     NOT NULL DEFAULT false,
  skip            BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preflight_source_id  ON date_preflight_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_preflight_created_at ON date_preflight_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preflight_skip        ON date_preflight_logs(skip) WHERE skip = true;

COMMENT ON TABLE  date_preflight_logs IS 'Telemetría de Date Preflight: una fila por URL evaluada. TTL 14d.';
COMMENT ON COLUMN date_preflight_logs.reason        IS 'process|datetime_past|text_date_past|past_year_only|keyword_past';
COMMENT ON COLUMN date_preflight_logs.used_fallback IS 'true si se usó capa 2 o 3 (menos precisa que capa 1 datetime)';
COMMENT ON COLUMN date_preflight_logs.skip          IS 'true si la URL fue descartada antes de Gemini';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: source_run_metrics
-- Registra métricas de funnel por fuente y por run del pipeline.
-- Permite medir coverage drift, dedupe growth y eficiencia del parser por fuente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS source_run_metrics (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id            TEXT    NOT NULL,
  urls_scraped         INTEGER NOT NULL DEFAULT 0,
  urls_after_preflight INTEGER NOT NULL DEFAULT 0,
  gemini_ok            INTEGER NOT NULL DEFAULT 0,
  fallback_count       INTEGER NOT NULL DEFAULT 0,
  activities_saved     INTEGER NOT NULL DEFAULT 0,
  run_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_run_metrics_source_id ON source_run_metrics(source_id);
CREATE INDEX IF NOT EXISTS idx_run_metrics_run_at    ON source_run_metrics(run_at DESC);

COMMENT ON TABLE  source_run_metrics IS 'Métricas de funnel por run de pipeline: una fila por source por run.';
COMMENT ON COLUMN source_run_metrics.fallback_count IS 'Actividades parseadas por Cheerio en lugar de Gemini';
