import { prisma } from '../src/lib/db';
import { createLogger } from '../src/lib/logger';

const log = createLogger('admin:overdue-pqrs');

// Utilidad para calcular días hábiles (ignora sábados y domingos)
// Nota: No incluye festivos colombianos. Para precisión 100% legal se requiere API de festivos.
function getBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  // Normalizar a medianoche para evitar desajustes de horas
  curDate.setHours(0, 0, 0, 0);
  const endNormalized = new Date(endDate.getTime());
  endNormalized.setHours(0, 0, 0, 0);

  while (curDate <= endNormalized) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  
  // Si startDate y endDate son el mismo día hábil, cuenta 1. 
  // Para días "transcurridos" restamos 1.
  return Math.max(0, count - 1);
}

async function main() {
  log.info('Generando reporte de PQRS vencidas (Auditoría SIC - Días Hábiles)...');

  const now = new Date();
  
  const openRequests = await prisma.contactRequest.findMany({
    where: { status: { not: 'closed' } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      category: true,
      status: true,
      email: true
    }
  });

  const alerts: any[] = [];

  openRequests.forEach(req => {
    const businessDays = getBusinessDays(req.createdAt, now);
    
    let isWarning = false;
    let isDueToday = false;
    let isOverdue = false;
    let limit = 0;

    if (req.category === 'data_access') {
      limit = 10;
      if (businessDays > 10) isOverdue = true;
      else if (businessDays === 10) isDueToday = true;
      else if (businessDays >= 8) isWarning = true;
    } else if (req.category === 'data_claim') {
      limit = 15;
      if (businessDays > 15) isOverdue = true;
      else if (businessDays === 15) isDueToday = true;
      else if (businessDays >= 13) isWarning = true;
    } else {
      // SLA interno para generales
      limit = 5;
      if (businessDays > 5) isOverdue = true;
      else if (businessDays === 5) isDueToday = true;
      else if (businessDays >= 3) isWarning = true;
    }

    if (isWarning || isDueToday || isOverdue) {
      let estado = '⚠️ WARNING';
      if (isDueToday) estado = '⏱️ VENCE HOY';
      if (isOverdue) estado = '🚨 VENCIDO';

      alerts.push({
        ID: req.id.slice(0, 8),
        Creado: req.createdAt.toISOString().split('T')[0],
        'Días Hábiles': businessDays,
        Límite: limit,
        Estado: estado,
        Categoría: req.category,
        Email: req.email
      });
    }
  });

  if (alerts.length === 0) {
    log.info('✅ Todo al día. No hay solicitudes PQRS vencidas ni en riesgo (hábiles).');
  } else {
    log.warn(`Se encontraron ${alerts.length} solicitudes que requieren atención inmediata.`);
    console.table(alerts);
  }
}

main()
  .catch((e) => {
    log.error('Error consultando PQRS', { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
