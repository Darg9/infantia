-- AlterTable: añadir columna expirationHoursAfterStart en locations
-- Configurable por lugar: cuántas horas tras startDate expira la actividad si no tiene endDate
-- null = usar config de la fuente (ScrapingSource.config) o default (3 horas)
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "expirationHoursAfterStart" INTEGER;
