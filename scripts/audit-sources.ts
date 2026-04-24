import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. Verificar campo isGov en fuentes
  console.log('\n══ CAMPO isGov en ScrapingSource ══')
  const sources = await prisma.scrapingSource.findMany({
    select: { id: true, name: true, url: true, isActive: true, config: true },
    orderBy: { name: 'asc' },
  })

  let hasIsGov = false
  for (const s of sources) {
    const cfg = s.config as Record<string, unknown> | null
    const isGov = cfg?.isGov
    if (isGov !== undefined) hasIsGov = true
    if (s.isActive) {
      console.log(`  ${String(isGov ?? 'NOT SET').padEnd(8)} | ${s.name.slice(0,40).padEnd(40)} | ${s.url?.slice(0,60) ?? ''}`)
    }
  }
  if (!hasIsGov) {
    console.log('\n  ⚠️  El campo isGov NO existe en ningún registro (config=null o sin clave)')
  }

  // 2. Auditar allowlists vs URLs actuales
  console.log('\n══ AUDIT ALLOWLISTS vs URLs activas (WEBSITE) ══')
  const webSources = sources.filter(s => s.isActive)

  // Allowlist actual en activity-gate.ts
  const ALLOWLIST: { domain: string; allowed: string[] }[] = [
    {
      domain: 'bogota.gov.co',
      allowed: ['/que-hacer/agenda-cultural', '/programate', '/cultura', '/parques'],
    },
    {
      domain: 'fce.com.co',
      allowed: ['/eventos', '/conferencias', '/presentaciones', '/lanzamiento'],
    },
  ]

  for (const s of webSources) {
    if (!s.url || !s.url.startsWith('http')) continue
    try {
      const parsed = new URL(s.url)
      const hostname = parsed.hostname.replace('www.', '')
      const path = parsed.pathname

      const rule = ALLOWLIST.find(r => hostname.includes(r.domain))
      if (!rule) continue // dominio no restringido = ok

      const passes = rule.allowed.some(allowed => path.startsWith(allowed))
      const status = passes ? '✅ PASA' : '❌ BLOQUEADA'
      console.log(`\n  ${status} | ${s.name}`)
      console.log(`    URL   : ${s.url}`)
      console.log(`    Path  : ${path}`)
      console.log(`    Regla : ${rule.domain} → [${rule.allowed.join(', ')}]`)
    } catch {
      // URL inválida
    }
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
