// =============================================================================
// Paso 1 — Pausar fuentes zero-yield
//
// Criterio: fuentes activas con 5+ runs exitosos y 0 items nuevos en total.
// Acción: isActive = false + notes con motivo y fecha.
//
// Excluidos deliberadamente:
// - parqueexplora.org: tiene valor bajo (2 new / 2037 found) pero no es cero.
//   Se deja activa para que el planner (Paso 2) la maneje en modo PING.
// =============================================================================

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const TODAY = new Date().toISOString().slice(0, 10)

async function main() {
  // ── 1. Histórico completo de itemsNew por fuente (sin límite de tiempo) ────
  const allTime = await prisma.scrapingLog.groupBy({
    by: ['sourceId'],
    where: { status: { in: ['SUCCESS', 'PARTIAL'] } },
    _sum: { itemsNew: true, itemsFound: true },
    _count: { id: true },
  })

  const sources = await prisma.scrapingSource.findMany({
    where: { isActive: true },
    select: { id: true, name: true, url: true, platform: true, notes: true },
  })

  const byId = Object.fromEntries(sources.map(s => [s.id, s]))

  console.log('\n══ ANÁLISIS ZERO-YIELD (histórico completo) ══')
  console.log('Fuente'.padEnd(40) + 'Runs'.padEnd(6) + 'Found'.padEnd(8) + 'New'.padEnd(6) + 'Decisión')
  console.log('─'.repeat(80))

  // Clasificar fuentes
  type Decision = 'PAUSAR' | 'PING_PASO2' | 'OK'
  const decisions: { source: (typeof sources)[0]; runs: number; found: number; newItems: number; decision: Decision; reason: string }[] = []

  for (const l of allTime) {
    const s = byId[l.sourceId]
    if (!s) continue
    const runs = l._count.id
    const found = l._sum.itemsFound ?? 0
    const newItems = l._sum.itemsNew ?? 0

    let decision: Decision = 'OK'
    let reason = ''

    if (runs >= 5 && newItems === 0) {
      decision = 'PAUSAR'
      reason = `zero_yield — ${runs} runs exitosos, 0 items nuevos en toda la historia`
    } else if (runs >= 5 && newItems > 0 && newItems / Math.max(found, 1) < 0.002) {
      // saveRate < 0.2% con mínimo 5 runs → candidato PING en planner
      decision = 'PING_PASO2'
      reason = `low_yield — saveRate ${((newItems / Math.max(found, 1)) * 100).toFixed(3)}% (${newItems} new / ${found} found)`
    }

    decisions.push({ source: s, runs, found, newItems, decision, reason })
  }

  // Ordenar: PAUSAR primero, luego PING, luego OK
  const order: Record<Decision, number> = { PAUSAR: 0, PING_PASO2: 1, OK: 2 }
  decisions.sort((a, b) => order[a.decision] - order[b.decision] || b.runs - a.runs)

  for (const d of decisions) {
    const icon = d.decision === 'PAUSAR' ? '🔴' : d.decision === 'PING_PASO2' ? '🟡' : '🟢'
    const name = d.source.name.slice(0, 39).padEnd(40)
    const runs = String(d.runs).padEnd(6)
    const found = String(d.found).padEnd(8)
    const newI = String(d.newItems).padEnd(6)
    console.log(`${icon} ${name}${runs}${found}${newI}${d.decision}`)
    if (d.reason) console.log(`   └─ ${d.reason}`)
  }

  // Fuentes activas sin ningún run en histórico
  const withRuns = new Set(allTime.map(l => l.sourceId))
  const neverRan = sources.filter(s => !withRuns.has(s.id))
  if (neverRan.length > 0) {
    console.log('\n══ Activas sin ningún run exitoso (nunca ran) ══')
    for (const s of neverRan) {
      console.log(`  ⚪ ${s.name} (${s.platform}) — ${s.url?.slice(0, 60)}`)
    }
  }

  // ── 2. Aplicar pausas ─────────────────────────────────────────────────────
  const toPause = decisions.filter(d => d.decision === 'PAUSAR')
  const toPing  = decisions.filter(d => d.decision === 'PING_PASO2')

  if (toPause.length === 0) {
    console.log('\n✅ No hay fuentes candidatas a pausa en este momento.')
    await prisma.$disconnect()
    return
  }

  console.log(`\n══ APLICANDO PAUSAS (${toPause.length} fuentes) ══`)

  for (const d of toPause) {
    const updated = await prisma.scrapingSource.update({
      where: { id: d.source.id },
      data: {
        isActive: false,
        notes: [
          d.source.notes,
          `[PAUSADA ${TODAY}] Motivo: ${d.reason}. Revisar en 30 días si el sitio actualiza su contenido.`,
        ].filter(Boolean).join('\n'),
      },
      select: { id: true, name: true, isActive: true },
    })
    console.log(`  ❌ Pausada: ${updated.name}`)
  }

  // Anotar fuentes PING sin pausar
  if (toPing.length > 0) {
    console.log(`\n══ ANOTANDO PARA PING en Paso 2 (${toPing.length} fuentes) ══`)
    for (const d of toPing) {
      await prisma.scrapingSource.update({
        where: { id: d.source.id },
        data: {
          notes: [
            d.source.notes,
            `[FLAG PING ${TODAY}] ${d.reason}. Candidata a modo PING cuando se active el planner (Paso 2).`,
          ].filter(Boolean).join('\n'),
        },
      })
      console.log(`  🟡 Flagged PING: ${d.source.name}`)
    }
  }

  // ── 3. Resumen final de fuentes activas ───────────────────────────────────
  const remaining = await prisma.scrapingSource.count({ where: { isActive: true } })
  const paused    = await prisma.scrapingSource.count({ where: { isActive: false } })
  console.log(`\n══ Estado final ══`)
  console.log(`  Activas : ${remaining}`)
  console.log(`  Pausadas: ${paused}`)
  console.log(`  Slots liberados este run: ${toPause.length} → ~${Math.round(toPause.length / 20 * 100)}% más frecuencia para fuentes activas`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
