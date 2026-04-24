-- Migration: add_pqrs_response_tracking
-- Date: 2026-04-24
-- Reason: SIC Ley 1581 — demostrar primera respuesta al usuario ante auditoría
--
-- firstRespondedAt: cuándo respondió el equipo por primera vez
-- responseChannel : canal usado (email, phone, whatsapp, manual, platform)

ALTER TABLE "contact_requests"
  ADD COLUMN IF NOT EXISTS "first_responded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "response_channel"   VARCHAR(50);
