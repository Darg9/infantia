// =============================================================================
// ratings.ts — Helper para recalcular ratingAvg/ratingCount del provider
// =============================================================================

import { prisma } from '@/lib/db';

/**
 * Recalcula y persiste ratingAvg + ratingCount en el provider
 * a partir de TODOS los ratings de sus actividades.
 * Llamar después de crear, actualizar o eliminar un rating.
 */
export async function recalcProviderRating(providerId: string): Promise<void> {
  const result = await prisma.rating.aggregate({
    where: { activity: { providerId } },
    _avg:   { score: true },
    _count: { score: true },
  });

  await prisma.provider.update({
    where: { id: providerId },
    data: {
      ratingAvg:   result._avg.score ?? null,
      ratingCount: result._count.score,
    },
  });
}
