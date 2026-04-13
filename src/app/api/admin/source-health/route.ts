import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const data = await prisma.sourceHealth.findMany({
      where,
      orderBy: { score: 'asc' }, // Ordenar crítico primero
      take: 100,
      select: {
        id: true,
        source: true,
        successCount: true,
        errorCount: true,
        lastSuccessAt: true,
        lastErrorAt: true,
        avgResponseMs: true,
        score: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error procesando api/admin/source-health:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
