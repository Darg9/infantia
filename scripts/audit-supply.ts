import { prisma } from '../src/lib/db';

async function main() {
  console.log('📊 AUDITORÍA DE SUMINISTRO - HABITAPLAN\n');

  const activities = await prisma.activity.groupBy({
    by: ['status'],
    _count: { _all: true }
  });

  console.log('--- Distribución de Actividades ---');
  if (activities.length === 0) {
    console.log('⚠️ No hay actividades en la base de datos.');
  } else {
    activities.forEach(a => {
      const label = a.status === 'ACTIVE' ? '🟢 ACTIVE (Público)' : 
                    a.status === 'PAUSED' ? '🟡 PAUSED (Cuarentena)' : 
                    a.status === 'EXPIRED' ? '⚪ EXPIRED' : 
                    a.status === 'DRAFT'  ? '🔵 DRAFT' : `⚪ ${a.status}`;
      console.log(`${label}: ${a._count._all}`);
    });
  }

  const pqrs = await prisma.contactRequest.count();
  console.log(`\n--- Volumen de PQRS ---`);
  console.log(`Total solicitudes: ${pqrs}`);

  // Alerta de Salud del Pipeline
  const activeCount = activities.find(a => a.status === 'ACTIVE')?._count._all || 0;
  if (activeCount === 0) {
    console.log('\n🚨 ALERTA: 0 actividades públicas. El inventario está vacío o todo está en cuarentena.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
