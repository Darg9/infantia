// Quick test script for Activities API
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API = 'http://localhost:3000/api';

async function main() {
  // Get IDs from DB
  const vertical = await prisma.vertical.findFirstOrThrow({ where: { slug: 'kids' } });
  const city = await prisma.city.findFirstOrThrow({ where: { name: 'Bogotá' } });

  // Create a test provider
  const provider = await prisma.provider.create({
    data: {
      name: 'Academia de Fútbol Test',
      type: 'ACADEMY',
      description: 'Academia de prueba',
    },
  });

  // Create a test location
  const location = await prisma.location.create({
    data: {
      name: 'Parque Simón Bolívar',
      address: 'Calle 63 # 59A-06',
      neighborhood: 'Teusaquillo',
      cityId: city.id,
      latitude: 4.6584,
      longitude: -74.0937,
    },
  });

  const category = await prisma.category.findFirstOrThrow({
    where: { slug: 'futbol', verticalId: vertical.id },
  });

  console.log('\n=== TEST 1: POST /api/activities (Create) ===');
  const createRes = await fetch(`${API}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Escuela de Fútbol para Niños',
      description: 'Clases de fútbol para niños de 5 a 12 años. Entrenadores certificados.',
      type: 'RECURRING',
      status: 'ACTIVE',
      ageMin: 5,
      ageMax: 12,
      price: 150000,
      pricePeriod: 'MONTHLY',
      capacity: 25,
      providerId: provider.id,
      locationId: location.id,
      verticalId: vertical.id,
      categoryIds: [category.id],
      schedule: { days: ['mon', 'wed', 'fri'], start: '15:00', end: '17:00' },
    }),
  });
  const created = await createRes.json();
  console.log('Status:', createRes.status);
  console.log('Response:', JSON.stringify(created, null, 2));

  if (!created.success) {
    console.error('Create failed, aborting tests');
    return;
  }

  const activityId = created.data.id;

  console.log('\n=== TEST 2: GET /api/activities (List) ===');
  const listRes = await fetch(`${API}/activities`);
  const list = await listRes.json();
  console.log('Status:', listRes.status);
  console.log('Total:', list.pagination?.total);
  console.log('First title:', list.data?.[0]?.title);

  console.log('\n=== TEST 3: GET /api/activities/[id] ===');
  const getRes = await fetch(`${API}/activities/${activityId}`);
  const single = await getRes.json();
  console.log('Status:', getRes.status);
  console.log('Title:', single.data?.title);
  console.log('Provider:', single.data?.provider?.name);
  console.log('Favorites:', single.data?._count?.favorites);

  console.log('\n=== TEST 4: PUT /api/activities/[id] (Update) ===');
  const updateRes = await fetch(`${API}/activities/${activityId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Escuela de Fútbol Actualizada', price: 180000 }),
  });
  const updated = await updateRes.json();
  console.log('Status:', updateRes.status);
  console.log('New title:', updated.data?.title);

  console.log('\n=== TEST 5: GET /api/activities?search=fútbol ===');
  const searchRes = await fetch(`${API}/activities?search=fútbol`);
  const searchResult = await searchRes.json();
  console.log('Status:', searchRes.status);
  console.log('Found:', searchResult.pagination?.total);

  console.log('\n=== TEST 6: DELETE /api/activities/[id] (Soft delete) ===');
  const deleteRes = await fetch(`${API}/activities/${activityId}`, { method: 'DELETE' });
  const deleted = await deleteRes.json();
  console.log('Status:', deleteRes.status);
  console.log('Response:', JSON.stringify(deleted));

  console.log('\n=== TEST 7: GET after delete (should not appear) ===');
  const afterDeleteRes = await fetch(`${API}/activities`);
  const afterDelete = await afterDeleteRes.json();
  console.log('Total after delete:', afterDelete.pagination?.total);

  console.log('\n=== TEST 8: GET /api/activities/invalid-id (400) ===');
  const invalidRes = await fetch(`${API}/activities/not-a-uuid`);
  console.log('Status:', invalidRes.status);

  console.log('\n=== TEST 9: POST validation error ===');
  const badRes = await fetch(`${API}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'x' }),
  });
  console.log('Status:', badRes.status);

  // Cleanup
  await prisma.activityCategory.deleteMany({ where: { activityId } });
  await prisma.activity.delete({ where: { id: activityId } });
  await prisma.location.delete({ where: { id: location.id } }).catch(() => {});
  await prisma.provider.delete({ where: { id: provider.id } }).catch(() => {});
  console.log('\n✅ Cleanup done. All tests completed!');

  await prisma.$disconnect();
}

main().catch(console.error);
