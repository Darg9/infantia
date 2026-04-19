/**
 * backfill-source-domain.ts
 * Rellena sourceDomain para actividades que lo tienen NULL (creadas antes del fix en storage.ts).
 * Extrae el dominio de sourceUrl (sin www.) igual que storage.ts.
 *
 * Uso: npx tsx scripts/backfill-source-domain.ts [--dry-run]
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Backfill sourceDomain ${DRY_RUN ? '(DRY-RUN)' : '(REAL)'} ===\n`);

  const nullDomain = await prisma.activity.findMany({
    where: { sourceDomain: null },
    select: { id: true, sourceUrl: true },
  });

  console.log(`Actividades con sourceDomain=null: ${nullDomain.length}`);

  const updates: { id: string; domain: string }[] = [];
  const skipped: string[] = [];

  for (const act of nullDomain) {
    try {
      if (!act.sourceUrl) { skipped.push(act.id); continue; }
      const domain = new URL(act.sourceUrl).hostname.replace(/^www\./, '');
      updates.push({ id: act.id, domain });
    } catch {
      skipped.push(act.id);
    }
  }

  console.log(`  ✔ Con dominio computable: ${updates.length}`);
  console.log(`  ✗ Sin URL válida (skip): ${skipped.length}`);

  // Preview por dominio
  const byDomain: Record<string, number> = {};
  for (const u of updates) byDomain[u.domain] = (byDomain[u.domain] ?? 0) + 1;
  console.log('\n  Distribución:');
  Object.entries(byDomain).sort((a, b) => b[1] - a[1]).forEach(([d, n]) =>
    console.log(`    ${d.padEnd(45)} ${n}`)
  );

  if (!DRY_RUN && updates.length > 0) {
    // Actualización en lotes de 100 para no saturar la conexión
    const BATCH = 100;
    let done = 0;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await Promise.all(batch.map((u) =>
        prisma.activity.update({ where: { id: u.id }, data: { sourceDomain: u.domain } })
      ));
      done += batch.length;
      process.stdout.write(`\r  Actualizadas: ${done}/${updates.length}`);
    }
    console.log('\n\n  ✅ Backfill completo.');
  } else if (DRY_RUN) {
    console.log('\n  [DRY-RUN] No se realizaron cambios.');
  }

  await prisma.$disconnect();
}
main().catch(console.error);
