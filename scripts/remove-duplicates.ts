import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

// IDs de las actividades duplicadas a eliminar (mantienen la primera, eliminan las demás)
const IDS_TO_DELETE = [
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

async function removeDuplicates() {
  console.log('\n[CLEANUP] Iniciando eliminación de duplicados...\n');

  try {
    // Obtener info de las actividades a eliminar
    const toDelete = await p.activity.findMany({
      where: { id: { in: IDS_TO_DELETE } },
      select: { id: true, title: true },
    });

    console.log(`📋 Actividades a eliminar: ${toDelete.length}\n`);
    toDelete.forEach((a, i) => {
      console.log(`  [${i + 1}] "${a.title}" (${a.id})`);
    });

    console.log('\n⚠️  Procediendo con la eliminación...\n');

    // Eliminar en transacción
    const result = await p.activity.deleteMany({
      where: { id: { in: IDS_TO_DELETE } },
    });

    console.log(`✅ Eliminadas ${result.count} actividades duplicadas\n`);

    // Verificar resultado
    const remaining = await p.activity.count();
    console.log(`📊 Actividades restantes: ${remaining}`);
    console.log(`   (Antes: 229 → Ahora: ${remaining})`);

    // Listar las que quedaron (una de cada grupo)
    const survivors = [
      'bb674a3b-1a4a-4bb7-86bf-cd681e2efc2d', // "Lecturas y cantos para bebés"
      '1105526f-09e7-48d5-ac26-fd19ad21a53f', // "Club de crítica cinematográfica"
      '1e97e12e-0115-4491-9cf8-291c8d1d93c1', // "Resoyá: cuerpo, respiración"
      '24313dbe-1931-44a4-886e-294765e62c4a', // "¡Lecturas y texturas para bebés!"
      'ca037d53-5ace-486a-80e9-835aaadea9e5', // "¿Existe el oficio doméstico?"
      '0b4adf5d-44cf-409c-9d5e-6a53d45ed3c6', // "Escuelas LEO"
      '6e20a968-cc42-4fa3-9b18-221fcc76d0d9', // "Festival Estéreo Picnic"
      '75d2bfb2-bbf8-45da-ae93-5e3f5f784c94', // "Laboratorio de Hipótesis"
      'ee1719b4-82cc-4e99-9f1b-f6f39c042319', // "Lecturas y texturas para bebés"
      '322916ed-313d-413f-9c96-0c726fae8add', // "Leo con mi Bebé"
      'f511c4f1-96e1-4c28-8334-8ce0210cf79d', // "LEO Contigo"
      '9a9f2c47-2398-4682-9cd2-d18131f4baec', // "Mitos y leyendas de espanto"
    ];

    console.log(`\n✨ Actividades únicas que se mantienen:\n`);
    const kept = await p.activity.findMany({
      where: { id: { in: survivors } },
      select: { id: true, title: true },
    });

    kept.forEach((a) => {
      console.log(`  ✓ "${a.title}"`);
    });

    console.log(`\n[CLEANUP] ✅ Proceso completado\n`);

    await p.$disconnect();
  } catch (err) {
    console.error('\n[CLEANUP] ❌ Error:', err);
    process.exit(1);
  }
}

removeDuplicates().catch(console.error);
