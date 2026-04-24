import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as cheerio from 'cheerio'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function fetchLinks(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) { console.log(`  HTTP ${res.status}`); return [] }
    const html = await res.text()
    const $ = cheerio.load(html)
    const links: string[] = []
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? ''
      if (href.startsWith('http') && href.includes('fce.com.co')) links.push(href)
      else if (href.startsWith('/') && href.length > 1) links.push(`https://fce.com.co${href}`)
    })
    return [...new Set(links)]
  } catch (e) {
    console.log(`  Error: ${(e as Error).message}`)
    return []
  }
}

async function main() {
  // ── Estado actual en BD ──────────────────────────────────────────────────
  const fceSources = await prisma.scrapingSource.findMany({
    where: { url: { contains: 'fce' } },
    select: { id: true, name: true, url: true, isActive: true, lastRunStatus: true, lastRunAt: true, lastRunItems: true },
  })
  console.log('\n══ FCE en BD ══')
  for (const s of fceSources) {
    console.log(`  ID: ${s.id}`)
    console.log(`  Nombre: ${s.name}`)
    console.log(`  URL: ${s.url}`)
    console.log(`  Activa: ${s.isActive} | Último status: ${s.lastRunStatus} | Items: ${s.lastRunItems}`)
    console.log(`  Último run: ${s.lastRunAt?.toISOString().slice(0,16) ?? 'nunca'}`)
  }

  // ── Testear URLs nuevas ──────────────────────────────────────────────────
  const urls = [
    'https://fce.com.co/talleres-a-fondo/',
    'https://fce.com.co/concursos/',
    'https://fce.com.co/programacion-cultural/',
  ]

  console.log('\n══ TEST DE URLs NUEVAS ══')
  for (const url of urls) {
    console.log(`\n🔍 ${url}`)
    const links = await fetchLinks(url)
    const relevant = links.filter(l =>
      !l.match(/\.(jpg|png|pdf|gif|mp4|svg|webp|ico)$/i) &&
      !l.includes('#') &&
      !l.includes('?') || l.includes('fce.com.co')
    ).slice(0, 15)
    console.log(`  Links encontrados: ${links.length} | Relevantes (muestra): ${relevant.length}`)
    for (const l of relevant.slice(0, 8)) console.log(`    ${l}`)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
