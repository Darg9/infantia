# Riesgos de seguridad aceptados

Última revisión: 2026-05-16

Este documento registra vulnerabilidades conocidas que no tienen fix disponible
sin introducir cambios breaking, junto con su justificación de riesgo aceptado.

---

## 1. `@hono/node-server` < 1.19.13 — MODERATE

**CVE:** GHSA-92pp-h63x-v22m — Middleware bypass vía slashes repetidos en `serveStatic`

**Cómo entra:** Es una dependencia interna de `@prisma/dev`, herramienta de desarrollo de Prisma.
HabitaPlan **no usa hono directamente** ni expone `serveStatic` en producción.

**Fix disponible:** `npm audit fix --force` → instala `prisma@6.19.3` (breaking change — migración de schema).

**Decisión:** Riesgo aceptado. Blast radius = 0 en producción. Revisar cuando Prisma publique una versión limpia de su dependencia.

---

## 2. `postcss` < 8.5.10 — MODERATE (dentro de Next.js)

**CVE:** GHSA-qx2v-qp2m-jg93 — XSS vía `</style>` sin escapar en salida CSS Stringify

**Cómo entra:** PostCSS está vendorizado dentro de `node_modules/next/node_modules/postcss`.
HabitaPlan **no procesa CSS controlado por el usuario** en tiempo de ejecución — PostCSS solo se usa en build time.

**Fix disponible:** `npm audit fix --force` → requiere downgrade a `next@9.3.3` (incompatible con Next.js 16).

**Decisión:** Riesgo aceptado. Sin superficie de ataque en runtime. Se resolverá automáticamente cuando Next.js actualice su bundled PostCSS.

---

## 3. `xlsx` (SheetJS) — HIGH (sin fix disponible)

**CVEs:**
- GHSA-4r6h-8v6p-xvw6 — Prototype Pollution
- GHSA-5pgg-2g8v-p4x9 — ReDoS

**Cómo entra:** Usado en `scripts/export-activities.ts` para generar reportes Excel locales.
**No está en el bundle de producción** — es una dependencia de scripts operacionales.

**Fix disponible:** Ninguno. SheetJS (versión OSS) está abandonada.

**Decisión:** Riesgo aceptado a corto plazo dado el uso local/admin. El ReDoS solo aplica
a hojas Excel generadas desde fuentes no confiables, lo que no ocurre en este script.

**Acción futura:** Migrar a `exceljs` (mantenido, sin CVEs) cuando se toque `export-activities.ts`
la próxima vez. Issue: reemplazar `xlsx` por `exceljs` en `scripts/export-activities.ts`.
