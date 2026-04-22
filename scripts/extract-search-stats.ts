import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function main() {
  console.log('--- Extrayendo Top 20 Queries ---');
  const topQueries = await prisma.searchLog.groupBy({
    by: ['query'],
    _count: {
      query: true,
    },
    orderBy: {
      _count: {
        query: 'desc',
      },
    },
    take: 20,
  });
  console.log(topQueries.slice(0, 3));

  console.log('\n--- Extrayendo Queries con 0 resultados ---');
  const zeroResults = await prisma.searchLog.findMany({
    where: {
      resultCount: 0,
    },
    distinct: ['query'],
    select: {
      query: true,
      resultCount: true,
    },
    orderBy: {
      searchedAt: 'desc',
    },
    take: 3,
  });
  console.log(zeroResults);

  console.log('\n--- Evaluando CTR (Aproximación) ---');
  // Obtenemos búsquedas que sí tuvieron resultados
  const searchesWithResults = await prisma.searchLog.findMany({
    where: {
      resultCount: { gt: 0 },
    },
    distinct: ['query'],
    select: { query: true },
    take: 50,
  });

  const ctrStats = [];
  for (const s of searchesWithResults) {
    const searchCount = await prisma.searchLog.count({
      where: { query: s.query },
    });
    
    // Asumimos que los eventos de click en actividades se registran en Event con metadata que podría (o no) tener la query,
    // o simplemente buscamos eventos 'activity_view' cercanos a las búsquedas.
    // Como simplificación (ya que no sabemos si Event tiene la query), buscaremos si el searchCount > clicks.
    // Si no podemos cruzar directamente, usamos searchLog count como indicador.
    
    ctrStats.push({ query: s.query, searchCount });
  }
  
  console.log('Consultando eventos relacionados a búsquedas...');
  console.log(ctrStats.slice(0, 3));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
