# HabitaPlan — Runbook Operativo

Procedimientos estándar para operaciones de ingest, mantenimiento y diagnóstico.
No requiere nueva versión del Documento Fundacional cuando se actualiza.

---

## 1. Preflight de Ingest (OBLIGATORIO)

Ejecutar antes de cualquier run costoso (Playwright / Gemini / multi-fuente).

**Tiempo estimado: ~60 segundos. Si falla uno → NO lanzar el run.**

### 1.1 Verificar quota Gemini

```bash
cd /c/Users/denys/Projects/infantia
node -e "import('./src/lib/quota-tracker.js').then(m => m.quota.getRemaining().then(n => console.log('Quota disponible:', n, 'requests')))"
```

O verificar en Redis (Upstash dashboard): buscar keys `quota:*`.

- ✅ >0 → proceder
- ❌ 0 → esperar reset (8am UTC = 3am COL). No lanzar runs con Gemini.

### 1.2 Verificar VPN apagado

```powershell
# PowerShell
Resolve-DnsName banrepcultural.org
Resolve-DnsName idartes.gov.co
```

```bash
# Bash
nslookup banrepcultural.org
```

- ✅ Responde con IP → VPN apagada, OK
- ❌ `ERR_NAME_NOT_RESOLVED` o `SERVFAIL` → VPN activa, APAGAR antes de continuar

**VPN bloquea:** banrepcultural.org, idartes.gov.co, y posiblemente otras fuentes .gov.co

### 1.3 Verificar DNS + acceso web (opcional pero recomendado para Banrep)

Abrir en navegador: `https://www.banrepcultural.org` — debe cargar normalmente.

### 1.4 Identificar si fuente es SPA

| Fuente | Tipo | Parser recomendado |
|--------|------|--------------------|
| Banrep | SPA (React) | Playwright obligatorio |
| Idartes | HTML estático | Cheerio + Gemini |
| BibloRed | HTML estático | Cheerio + Gemini |
| FCE | HTML estático | Cheerio + Gemini |
| Instagram | SPA | Playwright |

Cheerio es insuficiente para SPAs → siempre falla en Banrep.

---

## 2. Cadencia de Ingest por Fuente

| Fuente | Frecuencia | Razón |
|--------|-----------|-------|
| **Idartes** | Diario | Alta productividad, motor de crecimiento actual |
| **Banrep** | Cada 2 días | SPA/Playwright, requiere entorno limpio (sin VPN) |
| **BibloRed** | Cada 2-3 días | Caché madura (~400/600 URLs recientes), no necesita run diario ciego |
| **FCE ×3** | Semanal | Bajo volumen de novedades |
| **Cinemateca** | Semanal | Bajo volumen |
| **JBB** | Semanal | Bajo volumen |
| **Parque Explora** | Semanal | 73 URLs en reparse queue (Gemini) |
| **Instagram** | Semanal | Bajo volumen, requiere sesión activa |
| **Sec. Cultura** | Suspendida | Confianza 0.4, extractor HTML pendiente revisión |
| **Biblioteca Piloto** | PAUSADA | 0 yield confirmado |
| **@distritojovenbta** | PAUSADA | 0 yield confirmado |
| **Banrep Ibagué** | PAUSADA | Score 13/100 |

### Orden óptimo de ejecución diaria

1. Preflight (60s)
2. **Banrep** — mayor incertidumbre técnica + mayor upside pendiente
3. **Idartes** — motor de crecimiento
4. **BibloRed** — solo si detectas URLs nuevas o han pasado 2+ días

---

## 3. Secuencia de Run (paso a paso)

```bash
# 0. Asegurarse de estar en el directorio correcto
cd /c/Users/denys/Projects/infantia

# 1. Run fuente individual (modo guardado en BD)
npx tsx scripts/ingest-sources.ts --source=banrep --save-db
npx tsx scripts/ingest-sources.ts --source=idartes --save-db
npx tsx scripts/ingest-sources.ts --source=biblored --save-db

# 2. Run por canal completo
npx tsx scripts/ingest-sources.ts --channel=web --save-db

# 3. Ver estado de fuentes
npx tsx scripts/ingest-sources.ts --list

# 4. Verificar BD después del run
npx tsx scripts/verify-db.ts
```

---

## 4. Backfill Temporal — force-reparse-source.ts (S72)

Herramienta para re-parsear actividades existentes cuando el parser mejora (sin pasar por el pipeline completo de discovery).

```bash
# Dry run — ver qué haría sin ejecutar
npx tsx scripts/force-reparse-source.ts --source=idartes --only-missing-dates --limit=30 --dry-run

# Run real — solo actividades sin fecha
npx tsx scripts/force-reparse-source.ts --source=idartes --only-missing-dates --limit=50

# Run real — todas las actividades del dominio
npx tsx scripts/force-reparse-source.ts --source=biblored --limit=100
```

**Parámetros:**
- `--source`: dominio (ej: `idartes.gov.co`) o keyword (`idartes`)
- `--limit=N`: máximo de actividades a procesar (default: 50)
- `--dry-run`: sin guardar, solo reporta
- `--only-missing-dates`: solo actividades con `startDate=null`

**Flujo interno:** verificar quota → `prisma.activity.findMany()` por sourceDomain LIKE → `native fetch()` → Gemini → `prisma.activity.update()` (solo campos temporales) → dual cache update.

**Referencia validada:** dry-run Idartes S72 → 49/50 OK, 1 × 404. Run real pendiente.

---

## 5. Limpieza de Reparse Queue

Si el scheduler excluye una fuente porque el costo de reparse supera el 30% del budget diario:

```bash
# Ver estado actual de la cola de reparse
npx tsx scripts/inspect-biblored-reparse.ts

# Limpiar manualmente la cola de una fuente (reemplazar 'dominio.com' con el real)
node -e "
const fs = require('fs');
const path = 'data/scraping-cache.json';
const cache = JSON.parse(fs.readFileSync(path, 'utf8'));
let cleared = 0;
for (const [url, entry] of Object.entries(cache.entries)) {
  if (url.includes('dominio.com') && entry.needsReparse) {
    delete entry.needsReparse;
    cleared++;
  }
}
fs.writeFileSync(path, JSON.stringify(cache, null, 2));
console.log('Limpiadas:', cleared, 'URLs');
"
```

**Precedentes:**
- BibloRed S57: 270 URLs limpiadas (caída Gemini 2026-04-22)
- Banrep S58: 728 URLs limpiadas (acumulación progresiva)

---

## 5. Gestión de Quota Gemini

**Reset:** 8am UTC diario = 3am COL = medianoche PST

**Budget total:** 4 API keys × 100 req/día = 400 req

**Cron automático de Vercel:** se ejecuta a las 6am UTC — puede consumir quota antes del reset de medianoche UTC del día anterior.

```bash
# Limpiar todas las keys manualmente (usar solo si sabes que ya reseteó)
node -e "import('./src/lib/quota-tracker.js').then(m => m.quota.clearAll().then(n => console.log('Keys liberadas:', n)))"
```

---

## 6. Diagnóstico de Fuentes Problemáticas

### Banrep no resuelve DNS
→ VPN activa. Apagar VPN, verificar con `nslookup banrepcultural.org`, reintentar.

### Cheerio retorna "insuficient logic"
→ Fuente es SPA. Requiere Playwright. Verificar que `PARSER_FALLBACK_ENABLED=false` no esté bloqueando el fallback a Playwright.

### 0 actividades en BibloRed
→ Verificar si hay publicaciones nuevas en el sitio. Si caché reciente es >400/600 URLs, es caché madura, no error.

### Gemini 429 durante run
→ Quota agotada en esa API key. El sistema rota a la siguiente key automáticamente. Si todas están agotadas, cae a Cheerio fallback con `needsReparse=true`.

### Actividades guardadas como `needsReparse=true`
→ Fueron procesadas por Cheerio fallback con confidencia <0.5. Se reprocessarán cuando haya quota Gemini disponible en el scheduler predictivo.

---

## 7. Post-Run Review

Llenar después de cada run significativo (~2 minutos). Registrar en el `CHANGELOG.md` bajo la entrada `[ops/...]` correspondiente.

### Template

```
Fuente:
Fecha/hora:
Duración (aprox):
Nuevas:
Fallidas:
Quota usada:
Bloqueador (si aplica):
Acción siguiente:
ROI estimado:          [Alto / Medio / Bajo / Nulo]
```

> **Campo pendiente (añadir cuando Pendiente #4 esté completo):** `Modo: Manual / Scheduler / Retry` — solo tiene valor cuando el scheduler predictivo (`buildPredictivePlan()`) esté conectado al cron route y existan múltiples modos reales en uso. Hasta entonces todos los runs son Manual = ruido sin señal.

**Guía para "ROI estimado":**
- **Alto** — Run limpio, múltiples actividades nuevas, sin bloqueadores
- **Medio** — Actividades nuevas pero con fallback o bloqueos parciales
- **Bajo** — 0-2 actividades nuevas, entorno subóptimo, cuota mal aprovechada
- **Nulo** — Run abortado o 0 actividades por causas externas (VPN, DNS, quota agotada)

### Ejemplos de referencia

**Run exitoso (referencia):**
```
Fuente:            Idartes
Fecha/hora:        2026-04-25 ~20:00 COL
Duración (aprox):  ~12 min
Nuevas:            50
Fallidas:          0
Quota usada:       ~50 requests Gemini
Bloqueador:        —
Acción siguiente:  Mantener frecuencia diaria
ROI estimado:      Alto
```

**Run fallido por entorno (referencia):**
```
Fuente:            Banrep
Fecha/hora:        2026-04-26 ~18:00 COL
Duración (aprox):  ~3 min (abortado)
Nuevas:            0
Fallidas:          ~20 URLs (todas ERR_NAME_NOT_RESOLVED)
Quota usada:       0 (Gemini agotada + Playwright bloqueado)
Bloqueador:        VPN activa bloqueó DNS banrepcultural.org + quota Gemini agotada
Acción siguiente:  Apagar VPN, esperar reset quota 3am COL, relanzar
ROI estimado:      Nulo
```

---

## 8. Rollback de Producción

HabitaPlan corre en Vercel (frontend/API) + Supabase (DB) + Upstash Redis (cache/queues). El rollback tiene dos niveles:

### 8.1 Rollback de código — Vercel (1 clic)

1. Ir a [vercel.com/dashboard](https://vercel.com/dashboard) → proyecto `habitaplan`
2. Tab **Deployments** → localizar el último deployment estable
3. Botón ⋯ → **Promote to Production**

Vercel redirige el tráfico en ~10 segundos sin downtime. No requiere git revert.

**Cuándo usarlo:** bug en producción detectado post-deploy, degradación de Core Web Vitals, error 500 nuevo en rutas críticas.

### 8.2 Rollback de migración de BD — Supabase

Supabase/PostgreSQL **no tiene rollback automático** de migraciones DDL. El flujo seguro:

1. **Antes de migrar:** tomar snapshot manual en Supabase Dashboard → **Database → Backups → Take snapshot**
2. **Si la migración falla:** restaurar snapshot desde el mismo panel (tarda ~5 min, implica downtime)
3. **Si solo son datos:** `psql` con `BEGIN; ... ROLLBACK;` o query directa en Supabase SQL Editor

**Política actual:** todas las migraciones son aditivas (ADD COLUMN, CREATE TABLE, CREATE INDEX). No hay DROP en el historial activo. El riesgo de migración es bajo.

### 8.3 Rollback de Redis / Queues

No hay rollback de estado Redis. Si BullMQ acumula jobs corruptos:

```bash
# Ver estado de queues en Upstash Dashboard (Redis Insight)
# O limpiar queue específica:
node -e "const { Queue } = require('bullmq'); const q = new Queue('scraping', { connection: ... }); q.drain();"
```

### 8.4 Checklist post-incidente

```
□ Rollback aplicado (Vercel o Supabase)
□ Causa raíz identificada
□ Fix en rama nueva (no directo a master)
□ Tests pasan localmente antes de re-deploy
□ Verificar /api/health post-deploy
□ Registrar en CHANGELOG.md bajo [ops/incident-YYYY-MM-DD]
```

---

## 9. Gobernanza Documental

### Cuándo generar nueva versión del Documento Fundacional

**SÍ genera nueva versión (cambio "material"):**
- Nuevo módulo o feature pública en producción
- Nueva ciudad, segmento o mercado
- Cambio de monetización, pricing o modelo de negocio
- Cambio de stack, proveedor o infra core
- Crecimiento de catálogo >20% (ej: 357 → 430+)
- Rename, dominio, repositorio oficial o identidad visual estratégica

**NO genera nueva versión:**
- Protocolos operativos o runbooks (este documento)
- Ajustes de cadencia de scraping
- Limpieza de deuda técnica o fixes menores
- Runs de ingest (incluso exitosos con nuevas actividades)
- Actualizaciones incrementales de documentación

**Comando para generar nueva versión:**
```bash
node scripts/generate_v28.mjs   # actualizar número antes de ejecutar
```

---

*Última actualización: 2026-05-19 (S76)*
