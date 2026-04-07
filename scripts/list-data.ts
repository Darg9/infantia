import { prisma } from '@/lib/db'
async function main() {
  const cities = await prisma.city.findMany({ select: { id: true, name: true, countryCode: true }, where: { isActive: true }, orderBy: { name: 'asc' } })
  const cats = await prisma.category.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } })
  console.log('CITIES:', JSON.stringify(cities))
  console.log('CATEGORIES:', JSON.stringify(cats))
  await prisma.$disconnect()
}
main()
