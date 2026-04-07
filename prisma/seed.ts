// =============================================================================
// HabitaPlan - Database Seed
// Populates: Cities, Verticals, Categories
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // =========================================================================
  // Cities - Colombia
  // =========================================================================
  const cityNames = [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
    'Bucaramanga', 'Pereira', 'Manizales', 'Santa Marta', 'Ibagué',
  ];

  const cities = await Promise.all(
    cityNames.map((name) =>
      prisma.city.upsert({
        where: { name_countryCode: { name, countryCode: 'CO' } },
        update: {},
        create: { name, countryCode: 'CO', countryName: 'Colombia', timezone: 'America/Bogota', currency: 'COP' },
      })
    )
  );

  console.log(`✅ ${cities.length} cities created`);

  // =========================================================================
  // Vertical - Kids Activities (first vertical)
  // =========================================================================
  const kidsVertical = await prisma.vertical.upsert({
    where: { slug: 'kids' },
    update: {},
    create: {
      slug: 'kids',
      name: 'Actividades Infantiles',
      description: 'Descubre las mejores actividades para niños: deportes, arte, música, idiomas, campamentos y más.',
      targetAudience: 'Familias con niños de 0 a 17 años',
      icon: 'baby',
      color: '#FF6B6B',
      config: {
        ageRange: { min: 0, max: 17 },
        defaultFilters: ['age', 'category', 'price', 'location', 'schedule'],
        features: ['age-matching', 'sibling-discount-tag', 'trial-class-tag'],
      },
    },
  });

  console.log(`✅ Vertical "${kidsVertical.name}" created`);

  // =========================================================================
  // Categories - Kids Activities
  // =========================================================================
  const categoriesData = [
    { name: 'Deportes', slug: 'deportes', icon: 'trophy', children: [
      { name: 'Fútbol', slug: 'futbol', icon: 'football' },
      { name: 'Natación', slug: 'natacion', icon: 'waves' },
      { name: 'Baloncesto', slug: 'baloncesto', icon: 'basketball' },
      { name: 'Tenis', slug: 'tenis', icon: 'tennis' },
      { name: 'Gimnasia', slug: 'gimnasia', icon: 'gymnastics' },
      { name: 'Artes Marciales', slug: 'artes-marciales', icon: 'martial-arts' },
      { name: 'Patinaje', slug: 'patinaje', icon: 'skate' },
    ]},
    { name: 'Arte y Creatividad', slug: 'arte-creatividad', icon: 'palette', children: [
      { name: 'Pintura y Dibujo', slug: 'pintura-dibujo', icon: 'brush' },
      { name: 'Manualidades', slug: 'manualidades', icon: 'scissors' },
      { name: 'Teatro', slug: 'teatro', icon: 'theater' },
      { name: 'Cerámica', slug: 'ceramica', icon: 'pottery' },
    ]},
    { name: 'Música', slug: 'musica', icon: 'music', children: [
      { name: 'Piano', slug: 'piano', icon: 'piano' },
      { name: 'Guitarra', slug: 'guitarra', icon: 'guitar' },
      { name: 'Canto', slug: 'canto', icon: 'microphone' },
      { name: 'Batería', slug: 'bateria', icon: 'drum' },
      { name: 'Violín', slug: 'violin', icon: 'violin' },
    ]},
    { name: 'Danza', slug: 'danza', icon: 'dance', children: [
      { name: 'Ballet', slug: 'ballet', icon: 'ballet' },
      { name: 'Danza Moderna', slug: 'danza-moderna', icon: 'dance-modern' },
      { name: 'Hip Hop', slug: 'hip-hop', icon: 'hiphop' },
      { name: 'Danzas Folclóricas', slug: 'danzas-folcloricas', icon: 'folklore' },
    ]},
    { name: 'Idiomas', slug: 'idiomas', icon: 'languages', children: [
      { name: 'Inglés', slug: 'ingles', icon: 'english' },
      { name: 'Francés', slug: 'frances', icon: 'french' },
      { name: 'Mandarín', slug: 'mandarin', icon: 'chinese' },
    ]},
    { name: 'Tecnología', slug: 'tecnologia', icon: 'laptop', children: [
      { name: 'Programación', slug: 'programacion', icon: 'code' },
      { name: 'Robótica', slug: 'robotica', icon: 'robot' },
      { name: 'Diseño Digital', slug: 'diseno-digital', icon: 'design' },
    ]},
    { name: 'Ciencias', slug: 'ciencias', icon: 'flask', children: [
      { name: 'Experimentos', slug: 'experimentos', icon: 'experiment' },
      { name: 'Astronomía', slug: 'astronomia', icon: 'telescope' },
      { name: 'Naturaleza', slug: 'naturaleza', icon: 'leaf' },
    ]},
    { name: 'Campamentos', slug: 'campamentos', icon: 'tent', children: [
      { name: 'Campamentos de Día', slug: 'campamentos-dia', icon: 'sun' },
      { name: 'Campamentos Vacacionales', slug: 'campamentos-vacacionales', icon: 'camp' },
    ]},
    { name: 'Desarrollo Personal', slug: 'desarrollo-personal', icon: 'heart', children: [
      { name: 'Yoga Infantil', slug: 'yoga-infantil', icon: 'yoga' },
      { name: 'Mindfulness', slug: 'mindfulness', icon: 'meditation' },
      { name: 'Cocina para Niños', slug: 'cocina-ninos', icon: 'chef' },
    ]},
    { name: 'Apoyo Académico', slug: 'apoyo-academico', icon: 'book', children: [
      { name: 'Tutorías', slug: 'tutorias', icon: 'tutor' },
      { name: 'Lectura', slug: 'lectura', icon: 'reading' },
      { name: 'Matemáticas', slug: 'matematicas', icon: 'math' },
    ]},
  ];

  let categoryCount = 0;

  for (let i = 0; i < categoriesData.length; i++) {
    const cat = categoriesData[i];
    const parent = await prisma.category.upsert({
      where: { verticalId_slug: { verticalId: kidsVertical.id, slug: cat.slug } },
      update: {},
      create: {
        verticalId: kidsVertical.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        sortOrder: i,
      },
    });
    categoryCount++;

    if (cat.children) {
      for (let j = 0; j < cat.children.length; j++) {
        const child = cat.children[j];
        await prisma.category.upsert({
          where: { verticalId_slug: { verticalId: kidsVertical.id, slug: child.slug } },
          update: {},
          create: {
            verticalId: kidsVertical.id,
            parentId: parent.id,
            name: child.name,
            slug: child.slug,
            icon: child.icon,
            sortOrder: j,
          },
        });
        categoryCount++;
      }
    }
  }

  console.log(`✅ ${categoryCount} categories created`);
  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
