import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

// IDs a eliminar (versiones con puntuación/minúscula)
const TO_DELETE = [
  {
    id: '24313dbe-1931-44a4-886e-294765e62c4a',
    title: '¡Lecturas y texturas para bebés!',
    reason: 'Mantener versión sin puntuación',
  },
  {
    id: 'a599e641-187c-4391-9ff1-9296768fe36e',
    title: 'Laboratorio gráfico infantil: mamarracho',
    reason: 'Mantener versión con capitalización estándar',
  },
];

async function removeResiduals() {
  console.log('\n[CLEANUP] Eliminando duplicados residuales...\n');

  try {
    console.log('A eliminar:');
    TO_DELETE.forEach((item, i) => {
      console.log(`  [${i + 1}] "${item.title}"`);
      console.log(`      ID: ${item.id}`);
      console.log(`      Razón: ${item.reason}\n`);
    });

    const result = await p.activity.deleteMany({
      where: { id: { in: TO_DELETE.map(d => d.id) } },
    });

    console.log(`✅ Eliminadas ${result.count} actividades residuales\n`);

    // Verificar resultado
    const remaining = await p.activity.count();
    console.log(`📊 Actividades restantes: ${remaining}`);
    console.log(`   (229 → 213 → ${remaining})\n`);

    // Verificar que las versiones preferidas aún existen
    const kept = await p.activity.findMany({
      where: {
        title: {
          in: [
            'Lecturas y texturas para bebés',
            'Laboratorio Gráfico Infantil: Mamarracho',
          ],
        },
      },
      select: { id: true, title: true },
    });

    console.log('✨ Versiones preferidas mantienen:');
    kept.forEach(a => {
      console.log(`  ✓ "${a.title}"`);
    });

    console.log('\n[CLEANUP] ✅ Proceso completado\n');

    await p.$disconnect();
  } catch (err) {
    console.error('\n[CLEANUP] ❌ Error:', err);
    process.exit(1);
  }
}

removeResiduals().catch(console.error);
