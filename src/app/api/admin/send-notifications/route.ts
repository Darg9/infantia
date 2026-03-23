import { NextRequest, NextResponse } from 'next/server';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { sendWelcomeEmail, sendActivityDigest } from '@/lib/email/resend';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * POST /api/admin/send-notifications
 *
 * Endpoint called by Vercel Cron at 9 AM UTC daily
 * Sends activity digests to users with email notifications enabled
 *
 * Query params:
 * - period: 'daily' (default) | 'weekly'
 * - dryRun: 'true' to skip actual sending
 */
export async function POST(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'test-secret';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const period = (searchParams.get('period') || 'daily') as 'daily' | 'weekly';
  const dryRun = searchParams.get('dryRun') === 'true';

  console.log(`[NOTIFICATIONS] Starting send-notifications cron (period: ${period}, dryRun: ${dryRun})`);

  try {
    // Get all users (email and notificationPrefs are always present per schema)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        notificationPrefs: true,
      },
    });

    // Get children for each user (separate query to avoid relation type issues)
    const allChildren = await prisma.child.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { userId: true, birthDate: true },
    });
    const childrenByUser: Record<string, Date[]> = {};
    for (const child of allChildren) {
      if (!childrenByUser[child.userId]) childrenByUser[child.userId] = [];
      childrenByUser[child.userId].push(child.birthDate);
    }

    console.log(`[NOTIFICATIONS] Found ${users.length} users with notification prefs`);

    let sentCount = 0;
    let skippedCount = 0;
    const errors: any[] = [];

    for (const user of users) {
      if (!user.email) {
        skippedCount++;
        continue;
      }

      try {
        const prefs = user.notificationPrefs as any;

        // Skip if email disabled
        if (!prefs?.email) {
          skippedCount++;
          continue;
        }

        // Skip if frequency doesn't match period
        if (period === 'daily' && prefs?.frequency === 'weekly') {
          skippedCount++;
          continue;
        }

        // Skip if newActivities category disabled
        if (!prefs?.categories?.newActivities) {
          skippedCount++;
          continue;
        }

        // Get min/max age from user's children (if any), calculated from birthDate
        let minAge = 0;
        let maxAge = 18;
        const userChildren = childrenByUser[user.id] ?? [];
        if (userChildren.length > 0) {
          const now = new Date();
          const childAges = userChildren.map((birthDate) => {
            const birth = new Date(birthDate);
            let age = now.getFullYear() - birth.getFullYear();
            const m = now.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
            return age;
          });
          if (childAges.length > 0) {
            minAge = Math.min(...childAges);
            maxAge = Math.max(...childAges);
          }
        }

        // Fetch recent activities (last 24 hours for daily, last 7 days for weekly)
        const hoursAgo = period === 'daily' ? 24 : 7 * 24;
        const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

        const activities = await prisma.activity.findMany({
          where: {
            status: 'ACTIVE',
            createdAt: { gte: since },
            OR: [
              { ageMin: null },
              { ageMin: { lte: maxAge } },
            ],
            AND: [
              {
                OR: [
                  { ageMax: null },
                  { ageMax: { gte: minAge } },
                ],
              },
            ],
          },
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            ageMin: true,
            ageMax: true,
          },
          take: 10, // Limit to 10 most recent
          orderBy: { createdAt: 'desc' },
        });

        if (activities.length === 0) {
          console.log(`[NOTIFICATIONS] No new activities for ${user.email}`);
          skippedCount++;
          continue;
        }

        // Format activities with price label
        const formattedActivities = activities.map((act) => {
          const priceNum = act.price ? Number(act.price) : null;
          return {
            id: act.id,
            title: act.title,
            description: act.description || undefined,
            price: priceNum,
            priceLabel:
              priceNum === null || priceNum === 0
                ? 'Gratis'
                : `$${priceNum.toLocaleString('es-CO')}`,
            minAge: act.ageMin,
            maxAge: act.ageMax,
          };
        });

        // Send digest (or just log in dry run)
        if (dryRun) {
          console.log(
            `[NOTIFICATIONS] DRY-RUN: Would send ${activities.length} activities to ${user.email}`
          );
          sentCount++;
        } else {
          const result = await sendActivityDigest({
            to: user.email,
            userName: user.name || user.email,
            activities: formattedActivities,
            period,
          });

          if (result.success) {
            sentCount++;
          } else {
            errors.push({ email: user.email, error: result.error });
          }
        }
      } catch (error: any) {
        console.error(`[NOTIFICATIONS] Error processing user ${user.email}:`, error.message);
        errors.push({ email: user.email, error: error.message });
      }
    }

    console.log(`[NOTIFICATIONS] ========== RESULTADO ==========`);
    console.log(`[NOTIFICATIONS] Total usuarios: ${users.length}`);
    console.log(`[NOTIFICATIONS] Enviados: ${sentCount}`);
    console.log(`[NOTIFICATIONS] Omitidos: ${skippedCount}`);
    console.log(`[NOTIFICATIONS] Errores: ${errors.length}`);

    if (errors.length > 0) {
      console.error('[NOTIFICATIONS] Error details:', errors);
    }

    return NextResponse.json(
      {
        success: true,
        total: users.length,
        sent: sentCount,
        skipped: skippedCount,
        errors: errors.length,
        dryRun,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[NOTIFICATIONS] Catastrophic error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
