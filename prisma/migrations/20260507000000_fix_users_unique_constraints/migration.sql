-- Migration: fix_users_unique_constraints
-- Date: 2026-05-07
-- Reason: phone y email NO deben ser @unique en users.
--   Supabase Auth es la fuente de verdad de identidad.
--   Un mismo teléfono puede asociarse a múltiples providers (Google + Magic Link + OTP).
--   Restricciones únicas en phone/email rompen el registro cuando phone=null o email duplicado.

-- Eliminar UNIQUE constraint en phone (si existe)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_key";

-- Eliminar UNIQUE constraint en email (si existe — prevención)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";

-- Hacer email nullable (el schema actual lo define como String?, producción puede tenerlo NOT NULL)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
