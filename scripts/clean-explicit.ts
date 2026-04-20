import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const badIds = [
  '0d7d1912-1410-4623-81be-a36308d15b81',
  '0b4adf5d-44cf-409c-9d5e-6a53d45ed3c6',
  '06683995-6389-437b-ac4e-8d9251f27e1b',
  'f26b3c31-eb73-48c9-9511-148f63ea494d',
  '0d2b9c04-e283-4943-bd33-90974af32fc2',
  '96976ff3-59ee-4c55-8a01-827cf9b42215',
  'dd43ebef-bd18-4697-80e6-acbc51f3b9c2',
  'e6be9db3-f345-419b-99d5-d431879ff352',
  '08f99783-370f-4aaa-8ad8-365aefbc2112',
  '20ec3e13-fcd4-4dd3-a51f-a4413797f61f',
  'ce8784cc-d381-4517-820b-90e180004bf2',
  '5a0851e2-0821-4aab-9bd7-1b521bac34b6',
  '11485ff6-37d9-49c4-ac32-8f97d765b752',
  'cac87b55-8477-4c69-87e2-c2a17bfa568e'
];

async function main() {
  const result = await prisma.activity.deleteMany({
    where: { id: { in: badIds } }
  });
  console.log(`Deleted explicit bad IDs: ${result.count}`);
}

main().finally(async () => await prisma.$disconnect());
