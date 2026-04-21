import { prisma } from '../src/lib/db';
import 'dotenv/config';
async function main() {
  const activeCount = await prisma.activity.count({ where: { status: 'ACTIVE' } });
  const expiredCount = await prisma.activity.count({ where: { status: 'EXPIRED' } });
  
  const activeBySource = await prisma.activity.groupBy({
    by: ['sourceUrl'],
    where: { status: 'ACTIVE' },
    _count: true,
  });
  
  console.log('TOTAL ACTIVE:', activeCount);
  console.log('TOTAL EXPIRED:', expiredCount);
  console.log('\n--- ACTIVE BY SOURCE ---');
  activeBySource.forEach(item => console.log(item.sourceUrl, item._count));
}
main().catch(console.error).finally(() => prisma.$disconnect());
