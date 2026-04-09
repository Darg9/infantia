# 🛡️ Estrategia de Deduplicación - HabitaPlan

## Resumen Ejecutivo

**3 Niveles de Protección:**
- **Nivel 1** ✅: Deduplicación en real-time (en cada scraper)
- **Nivel 2** ✅: Validación diaria + limpieza automática
- **Nivel 3** ⚠️: Revisión manual de similares 70-90%

**Estado Actual (v0.9.8-S40 — 2026-04-09):**
- ~296 actividades (~44 activas / ~252 expiradas — 0% duplicados exactos)
- Protección automática integrada en `ScrapingStorage`
- 20 web + 12 Instagram (10 Bogotá + 2 Medellín) + 1 Telegram — sistema de canales (`web`, `instagram`, `telegram`, `tiktok`, `facebook`)
- **Caché dual:** `ScrapingCache` persiste URLs en BD (`scraping_cache`) + disco — evita re-scrapear entre máquinas

---

## Nivel 1: Deduplicación en Real-Time

### Implementación
Integrada en `src/modules/scraping/storage.ts`:

```typescript
async saveActivity() {
  // Busca duplicados similares antes de guardar
  const potentialDuplicate = await this.findPotentialDuplicate(
    data.title,
    data.schedules?.[0]?.startDate
  );

  if (potentialDuplicate) {
    // Reutiliza ID existente en lugar de crear duplicado
    return potentialDuplicate.id;
  }
}
```

### Criterios de Deduplicación
- **Similitud:** >75%
- **Ventana de fechas:** ±30 días
- **Búsqueda:** Últimas 100 actividades (rápida)

### Logs Automáticos
```
[STORAGE] ⚠️ Duplicado detectado: "Título nuevo" es similar a "Título existente"
          Reutilizando ID existente: [UUID]
```

---

## Nivel 2: Validación Diaria + Limpieza

### Ejecución
**Comando:**
```bash
npx tsx scripts/daily-dedup-check.ts
```

**Frecuencia:** Diariamente a las 2:15 AM (UTC)

**Configuración para Producción (Vercel Cron):**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/admin/daily-dedup",
      "schedule": "15 2 * * *"
    }
  ]
}
```

Crear endpoint:
```typescript
// src/app/api/admin/daily-dedup/route.ts
import { exec } from 'child_process';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  exec('npx tsx scripts/daily-dedup-check.ts', (err, stdout, stderr) => {
    if (err) console.error('Dedup error:', err);
    console.log(stdout);
  });

  return NextResponse.json({ status: 'running' });
}
```

### Qué hace
1. **Detecta exactos** (100% similitud)
   - Mantiene el primero
   - Elimina copias automáticamente

2. **Lista similares** (70-90%)
   - Los reporta para revisión manual
   - NO los elimina

3. **Genera reporte**
   - JSON con estadísticas
   - Enumera pares a revisar

### Ejemplo de Salida
```
[DAILY] 2026-03-24T02:15:00Z - Verificación diaria de duplicados

1️⃣  Buscando duplicados exactos...
✅ No hay duplicados exactos

2️⃣  Buscando similares para revisión (70-90%)...
⚠️  3 similares requieren revisión manual

  [1] 85% similar:
     A: "Salones de baile: Ritmos folclóricos"
     B: "Salones de baile: Ritmos folclóricos - Chapinero"

📊 RESUMEN DIARIO
Total actividades: 277
Títulos únicos: 277
Duplicados eliminados hoy: 0
Similares para revisar: Sí
Salud de datos: 100.0%
```

---

## Nivel 3: Revisión Manual (70-90% similitud)

### Cuándo revisar
El script diario reporta similares entre 70-90%. **NO se eliminan automáticamente** porque pueden ser actividades legítimas diferentes.

### Ejemplos de Falsos Positivos
```
"Salones de baile: Ritmos folclóricos"           ← Centro Felicidad Chapinero
"Salones de baile: Ritmos folclóricos - Fontanar" ← Centro Felicidad Fontanar
→ 85% similar PERO son ubicaciones diferentes ✅ (MANTENER AMBAS)

"Lecturas y texturas para bebés"          ← BibloRed
"Laboratorio gráfico infantil: mamarracho" ← BibloRed
→ 0% similar, no aparecerían ✅
```

### Ejemplos de Verdaderos Positivos
```
"Club de crítica cinematográfica"           ← bogota.gov.co
"Club de Crítica Cinematográfica"           ← biblored.gov.co
→ 100% similar pero diferente fuente = DUPLICADO ❌ (ELIMINAR)
```

### Proceso Manual
1. Leer el reporte diario (mañana siguiente, 9 AM)
2. Para cada par 70-90%:
   - Verificar **fechas** (¿qué tan cercanas?)
   - Verificar **ubicación** (¿mismo lugar?)
   - Verificar **fuente** (¿múltiples fuentes del mismo evento?)
3. Si es duplicado → ejecutar:
   ```bash
   npx tsx scripts/remove-duplicates.ts
   # (actualizar IDs en el script)
   ```
4. Loguear decisión en `DEDUP-LOG.md`

---

## Configuración por Fuente

### BibloRed (biblored.gov.co)
```
Propensión: ALTA
Similitud umbral: 80%
Acción: Auto-eliminar >90%
Revisión: Semanal
```

### Centro Felicidad (CEFEs)
```
Propensión: MEDIA
Similitud umbral: 75%
Acción: Usar ubicación para diferenciar
Nota: Varían por localidad → OK si diferentes localidades
```

### Bogotá.gov.co
```
Propensión: BAJA
Similitud umbral: 70%
Acción: Revisar manualmente
Nota: Eventos grandes pueden ser legítimos en múltiples fechas
```

---

## Métricas & Alertas

### Dashboard Diario
```
HABITAPLAN DEDUP REPORT - 2026-03-24

Total actividades: 277
Títulos únicos: 211
Duplicados exactos hoy: 0
Similares reportados: 3
Limpieza automática: 0 eliminadas
Salud de datos: 100%

SIMILARES A REVISAR:
1. "Salones de baile..." (85%) - Revisar ubicación
2. "Leo Contigo" (92%) - Revisar fecha
3. "Laboratorio gráfico..." (78%) - Revisar fuente
```

### Alertas
- ❌ Si duplicados exactos > 5 → INVESTIGAR (problema en scrapers)
- ⚠️ Si similares reportados > 10 → REVISAR (nueva fuente problemática)
- ✅ Si similares < 3 → Normal (buenos datos)

---

## Mantenimiento

### Semanal
```bash
# Revisar reporte del día anterior
# Ejecutar Nivel 3 (manual review)
# Documentar decisiones
```

### Mensual
```bash
# Análisis exhaustivo
npx tsx scripts/find-all-duplicates.ts
# Genera reporte completo con todos los pares
```

### Trimestral
```bash
# Revisar configuración de similitud umbral
# ¿Hay fuentes nuevas problemáticas?
# Actualizar DEDUP-CONFIG por fuente
```

---

## Archivos Clave

| Archivo | Propósito | Ejecución |
|---------|-----------|-----------|
| `src/modules/scraping/deduplication.ts` | Algoritmos de similitud | Cada scraper |
| `src/modules/scraping/storage.ts` | Integración Nivel 1 | Cada scraper |
| `scripts/daily-dedup-check.ts` | Validación Nivel 2 | Diario (2:15 AM) |
| `scripts/find-all-duplicates.ts` | Análisis exhaustivo | Manual (mensual) |
| `scripts/remove-duplicates.ts` | Limpieza batch | Manual (Nivel 3) |

---

## Comandos de Referencia Rápida

```bash
# Ejecutar validación hoy
npx tsx scripts/daily-dedup-check.ts

# Análisis exhaustivo
npx tsx scripts/find-all-duplicates.ts

# Encontrar pares específicos
npx tsx scripts/find-residuals.ts

# Validar que la limpieza fue correcta
npx tsx scripts/validate-cleanup.ts

# Eliminar duplicados (batch)
npx tsx scripts/remove-duplicates.ts
```

---

## FAQ

**P: ¿Qué pasa si se elimina una actividad legítima?**
A: Todas las elimaciones son soft-deletes (se logean). Se puede recuperar en la BD en las últimas 30 días.

**P: ¿Por qué 75% de similitud y no 90%?**
A: 75% captura bien duplicados reales sin eliminar actividades diferentes. Se puede ajustar por fuente.

**P: ¿Qué pasa en Nivel 1 si hay conflicto?**
A: Mantiene la actividad más antigua (más datos) y reutiliza su ID para la nueva fuente.

**P: ¿Se puede deshabilitar algún nivel?**
A: Sí, basta comentar la lógica en `storage.ts` para Nivel 1, o desactivar el cron para Nivel 2.

---

## Histórico

- **2026-03-24**: Limpieza inicial (229 → 211). Integración Nivel 1 & 2.
- **2026-03-31 (v0.9.0)**: 277 actividades. Nuevas fuentes: Cinemateca (+13), JBB (+3), Banrep Cartagena (+1). Sistema de canales en ingest-sources.ts. Pre-filtro de binarios en Gemini (ahorra cuota). 0 duplicados exactos.
- **[Futuro]**: Reportes semanales, alertas automáticas, dashboard web.
