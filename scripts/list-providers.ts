import { prisma } from '../src/lib/db';

async function main() {
  const providers = await prisma.provider.findMany({
    select: { id: true, name: true, website: true, instagram: true },
  });
  console.log(JSON.stringify(providers, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
