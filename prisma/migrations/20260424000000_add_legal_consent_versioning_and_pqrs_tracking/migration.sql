-- Migration: add_legal_consent_versioning_and_pqrs_tracking
-- Date: 2026-04-24
-- Reason: SIC Ley 1581 compliance
--   1. User: versioning of legal documents accepted at registration
--   2. ContactRequest: create table (was in schema but never migrated) + PQRS traceability

-- ── User: versionado de consentimientos legales ──────────────────────────────
-- NOTE: columns may already exist from apply-legal-migration.ts script run today
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "terms_version"       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "privacy_accepted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "privacy_version"     VARCHAR(50);

-- ── ContactRequest: tabla completa ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "contact_requests" (
  "id"                VARCHAR(255)  NOT NULL PRIMARY KEY,
  "created_at"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"              VARCHAR(255),
  "email"             VARCHAR(255)  NOT NULL,
  "category"          VARCHAR(50)   NOT NULL,
  "message"           TEXT          NOT NULL,
  "data_right_type"   VARCHAR(50),
  "status"            VARCHAR(50)   NOT NULL DEFAULT 'received',
  "status_changed_at" TIMESTAMP(3),
  "resolved_at"       TIMESTAMP(3),
  "resolved_by_user_id" VARCHAR(255),
  "email_status"      VARCHAR(50)   NOT NULL DEFAULT 'pending',
  "email_error"       TEXT,
  "ip"                VARCHAR(50),
  "user_agent"        TEXT
);

CREATE INDEX IF NOT EXISTS "contact_requests_email_idx"      ON "contact_requests" ("email");
CREATE INDEX IF NOT EXISTS "contact_requests_category_idx"   ON "contact_requests" ("category");
CREATE INDEX IF NOT EXISTS "contact_requests_created_at_idx" ON "contact_requests" ("created_at");
CREATE INDEX IF NOT EXISTS "contact_requests_status_idx"     ON "contact_requests" ("status");
