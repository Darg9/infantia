import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  normalizeString,
  calculateSimilarity,
} from '../src/modules/scraping/deduplication';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

// Los 16 IDs que fueron eliminados
const DELETED_IDS = [
  'b28203fd-aaee-4314-8655-7095f26fdd06',
  '779c7171-1786-4af7-a193-640854bc1735',
  '9b2745d3-a186-4b3c-9585-e7e852ff680c',
  '9a5ceff3-6fea-4763-9a6f-2f594971e14c',
  '9eb7111d-8394-468b-88bd-b27f6b9a7425',
  '3213c340-1376-46b3-a03d-e242388b5bf0',
  '9d209cdd-1765-49c1-8a42-aad939806810',
  '0eb806d7-b49f-4267-9293-e842fae82bd4',
  'c4b23929-615c-4f89-9b77-ec72762e745b',
  'cb968edc-f156-484f-9f8a-50c42565f8f5',
  '794bc56e-86b1-4bdf-ab72-783487a21751',
  'd62ba5b2-34bb-401f-842e-a79068e4cb0b',
  'ca3aeaa8-d18d-4cbb-ab72-0e1c26d5ab82',
  'd1f283a5-96de-4f48-962b-af834f854887',
  'e6bacb6a-d6d9-4a8e-81c0-179f771b50c9',
  'd5c19c36-1c11-4215-9ad4-3452343cbd9b',
];

// Pares de duplicados que deberían existir (original → eliminado)
const EXPECTED_DUPLICATES = [
  {
    kept: 'bb674a3b-1a4a-4bb7-86bf-cd681e2efc2d',
    deleted: ['b28203fd-aaee-4314-8655-7095f26fdd06', '779c7171-1786-4af7-a193-640854bc1735', '9b2745d3-a186-4b3c-9585-e7e852ff680c'],
    title: 'Lecturas y cantos para bebés',
  },
  {
    kept: '1105526f-09e7-48d5-ac26-fd19ad21a53f',
    deleted: ['9a5ceff3-6fea-4763-9a6f-2f594971e14c', '9eb7111d-8394-468b-88bd-b27f6b9a7425'],
    title: 'Club de crítica cinematográfica',
  },
  {
    kept: '1e97e12e-0115-4491-9cf8-291c8d1d93c1',
    deleted: ['3213c340-1376-46b3-a03d-e242388b5bf0', '9d209cdd-1765-49c1-8a42-aad939806810'],
    title: 'Resoyá: cuerpo, respiración y relajación',
  },
  {
    kept: '24313dbe-1931-44a4-886e-294765e62c4a',
    deleted: ['0eb806d7-b49f-4267-9293-e842fae82bd4', 'ca3aeaa8-d18d-4cbb-ab72-0e1c26d5ab82'],
    title: 'Lecturas y texturas para bebés',
  },
  {
    kept: 'ca037d53-5ace-486a-80e9-835aaadea9e5',
    deleted: ['c4b23929-615c-4f89-9b77-ec72762e745b'],
    title: '¿Existe el oficio doméstico?',
  },
  {
    kept: '0b4adf5d-44cf-409c-9d5e-6a53d45ed3c6',
    deleted: ['cb968edc-f156-484f-9f8a-50c42565f8f5'],
    title: 'Escuelas LEO',
  },
  {
    kept: '6e20a968-cc42-4fa3-9b18-221fcc76d0d9',
    deleted: ['794bc56e-86b1-4bdf-ab72-783487a21751'],
    title: 'Festival Estéreo Picnic',
  },
  {
    kept: '75d2bfb2-bbf8-45da-ae93-5e3f5f784c94',
    deleted: ['d62ba5b2-34bb-401f-842e-a79068e4cb0b'],
    title: 'Laboratorio de Hipótesis',
  },
  {
    kept: '322916ed-313d-413f-9c96-0c726fae8add',
    deleted: ['d1f283a5-96de-4f48-962b-af834f854887'],
    title: 'Leo con mi Bebé',
  },
  {
    kept: 'f511c4f1-96e1-4c28-8334-8ce0210cf79d',
    deleted: ['e6bacb6a-d6d9-4a8e-81c0-179f771b50c9'],
    title: 'LEO Contigo',
  },
  {
    kept: '9a9f2c47-2398-4682-9cd2-d18131f4baec',
    deleted: ['d5c19c36-1c11-4215-9ad4-3452343cbd9b'],
    title: 'Mitos y leyendas',
  },
];

async function validateCleanup() {
  console.log('\n[VALIDATE] Verificando que la limpieza fue correcta...\n');

  // 1. Verificar que los eliminados realmente se fueron
  console.log('═'.repeat(80));
  console.log('1️⃣  VERIFICAR: Actividades eliminadas ya no existen');
  console.log('═'.repeat(80) + '\n');

  const stillExisting = await p.activity.findMany({
    where: { id: { in: DELETED_IDS } },
    select: { id: true, title: true },
  });

  if (stillExisting.length === 0) {
    console.log('✅ Confirmado: Los 16 duplicados fueron eliminados correctamente\n');
  } else {
    console.log(`❌ ERROR: ${stillExisting.length} actividades aún existen:\n`);
    stillExisting.forEach(a => {
      console.log(`   - ${a.id}: "${a.title}"`);
    });
    console.log('');
  }

  // 2. Verificar que los "mantener" aún existen
  console.log('═'.repeat(80));
  console.log('2️⃣  VERIFICAR: Las actividades originales se mantienen');
  console.log('═'.repeat(80) + '\n');

  const keptIds = EXPECTED_DUPLICATES.map(d => d.kept);
  const keptActivities = await p.activity.findMany({
    where: { id: { in: keptIds } },
    select: { id: true, title: true, startDate: true, provider: { select: { name: true } } },
  });

  if (keptActivities.length === EXPECTED_DUPLICATES.length) {
    console.log(`✅ Confirmado: ${EXPECTED_DUPLICATES.length} actividades originales se mantienen\n`);
    keptActivities.forEach(a => {
      console.log(`   ✓ "${a.title}" (${a.provider.name})`);
    });
    console.log('');
  } else {
    console.log(`❌ ERROR: Faltan ${EXPECTED_DUPLICATES.length - keptActivities.length} actividades\n`);
  }

  // 3. Análisis de similitud de los pares eliminados
  console.log('═'.repeat(80));
  console.log('3️⃣  ANÁLISIS: Similitud de pares eliminados');
  console.log('═'.repeat(80) + '\n');

  console.log('Verificando que los eliminados son realmente similares a los mantenidos:\n');

  for (const pair of EXPECTED_DUPLICATES) {
    const keptActivity = keptActivities.find(a => a.id === pair.kept);
    if (!keptActivity) continue;

    const keptTitle = keptActivity.title;
    const similarity = calculateSimilarity(keptTitle, pair.title);

    console.log(`  ${pair.title}`);
    console.log(`  ${'-'.repeat(70)}`);
    console.log(`  Mantenida: "${keptTitle}"`);
    console.log(`  Similitud: ${similarity}%`);
    console.log(`  Eliminadas: ${pair.deleted.length} copias`);
    console.log('');
  }

  // 4. Estadísticas finales
  console.log('═'.repeat(80));
  console.log('4️⃣  ESTADÍSTICAS');
  console.log('═'.repeat(80) + '\n');

  const totalNow = await p.activity.count();
  const uniqueTitles = await p.activity.findMany({
    select: { title: true },
    distinct: ['title'],
  });

  console.log(`Total de actividades: ${totalNow}`);
  console.log(`Títulos únicos (exactos): ${uniqueTitles.length}`);
  console.log(`Promedio de repetición: ${(totalNow / uniqueTitles.length).toFixed(2)}x\n`);

  // 5. Buscar si aún hay duplicados similares
  console.log('═'.repeat(80));
  console.log('5️⃣  BÚSQUEDA: Duplicados similares restantes (>90%)');
  console.log('═'.repeat(80) + '\n');

  const allActivities = await p.activity.findMany({
    select: { id: true, title: true },
  });

  let similarPairsFound = 0;

  for (let i = 0; i < allActivities.length; i++) {
    for (let j = i + 1; j < allActivities.length; j++) {
      const sim = calculateSimilarity(allActivities[i].title, allActivities[j].title);
      if (sim >= 90) {
        similarPairsFound++;
        console.log(`  ⚠️ ${sim}% similitud:`);
        console.log(`     A: "${allActivities[i].title}"`);
        console.log(`     B: "${allActivities[j].title}"\n`);
      }
    }
  }

  if (similarPairsFound === 0) {
    console.log('✅ No se encontraron duplicados similares (>90%)\n');
  } else {
    console.log(`⚠️ ${similarPairsFound} pares similares encontrados (revisar manualmente)\n`);
  }

  console.log('═'.repeat(80));
  console.log('✅ VALIDACIÓN COMPLETADA');
  console.log('═'.repeat(80) + '\n');

  await p.$disconnect();
}

validateCleanup().catch(console.error);
