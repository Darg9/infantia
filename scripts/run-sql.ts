import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function run() {
  try {
    let url = process.env.DATABASE_URL!;
    // Change port 6543 to 5432 and remove pgbouncer to test direct connection if needed
    url = url.replace(':6543', ':5432').replace('?pgbouncer=true', '');
    
    console.log("Conectando con DB via:", url.split('@')[1]);
    const adapter = new PrismaPg({ connectionString: url });
    const prisma = new PrismaClient({ adapter });

    console.log("Running steps...");

    // Validation 1: Still Wrong before
    const c1: any = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS still_wrong
      FROM "ActivityCategory" ac
      JOIN "Category" c ON c.id = ac."categoryId"
      JOIN "Activity" a ON a.id = ac."activityId"
      WHERE c.slug = 'artes-marciales'
      AND a.title NOT ILIKE ANY (ARRAY[
        '%karate%','%taekwondo%','%jiu%','%judo%','%box%','%mma%','%kung fu%','%capoeira%','%marcial%'
      ]);
    `);
    console.log("still_wrong BEFORE:", Number(c1[0]?.still_wrong));

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_activity_category 
      ON "ActivityCategory" ("activityId", "categoryId");
    `);

    await prisma.$executeRawUnsafe('BEGIN;');

    await prisma.$executeRawUnsafe(`
      UPDATE "ActivityCategory" ac
      SET "categoryId" = (
        SELECT id FROM "Category" WHERE slug = 'arte-creatividad' LIMIT 1
      )
      FROM "Category" c, "Activity" a
      WHERE c.id = ac."categoryId"
      AND a.id = ac."activityId"
      AND c.slug = 'artes-marciales'
      AND a.title NOT ILIKE ANY (ARRAY[
        '%karate%','%taekwondo%','%jiu%','%judo%','%box%','%mma%','%kung fu%','%capoeira%','%marcial%'
      ])
      AND NOT EXISTS (
        SELECT 1 FROM "ActivityCategory" ac2
        JOIN "Category" c2 ON c2.id = ac2."categoryId"
        WHERE ac2."activityId" = ac."activityId"
        AND c2.slug = 'arte-creatividad'
      );
    `);

    await prisma.$executeRawUnsafe(`
      DELETE FROM "ActivityCategory" ac
      USING "Category" c, "Activity" a
      WHERE c.id = ac."categoryId"
      AND a.id = ac."activityId"
      AND c.slug = 'artes-marciales'
      AND a.title NOT ILIKE ANY (ARRAY[
        '%karate%','%taekwondo%','%jiu%','%judo%','%box%','%mma%','%kung fu%','%capoeira%','%marcial%'
      ])
      AND EXISTS (
        SELECT 1 FROM "ActivityCategory" ac2
        JOIN "Category" c2 ON c2.id = ac2."categoryId"
        WHERE ac2."activityId" = ac."activityId"
        AND c2.slug = 'arte-creatividad'
      );
    `);

    await prisma.$executeRawUnsafe('COMMIT;');

    const c2: any = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS still_wrong
      FROM "ActivityCategory" ac
      JOIN "Category" c ON c.id = ac."categoryId"
      JOIN "Activity" a ON a.id = ac."activityId"
      WHERE c.slug = 'artes-marciales'
      AND a.title NOT ILIKE ANY (ARRAY[
        '%karate%','%taekwondo%','%jiu%','%judo%','%box%','%mma%','%kung fu%','%capoeira%','%marcial%'
      ]);
    `);
    console.log("still_wrong AFTER:", Number(c2[0]?.still_wrong));

  } catch (error) {
    console.error("Execution failed:", error);
  }
}

run();
