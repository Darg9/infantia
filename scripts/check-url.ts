import { prisma } from '../src/lib/db';
async function main() {
  const a = await prisma.activity.findFirst({
    where: { sourceUrl: { contains: 'ingenieras-de-vida' } },
  });
  console.log(a ? `✅ ENCONTRADA: ${a.title} - ${a.dateStart}` : '❌ NO ENCONTRADA EN LA BD');
}
main();
