import { PrismaClient } from '../../../generated/prisma/client';
import { createLogger } from '../../../lib/logger';

const log = createLogger('quality:category-skew');

export type CategoryStat = {
  name: string;
  count: number;
  percentage: number;
};

export function computeCategoryDistribution(rows: { name: string; count: number }[]): CategoryStat[] {
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  if (total === 0) return [];

  return rows.map(r => ({
    name: r.name,
    count: r.count,
    percentage: r.count / total
  }));
}

export function detectAnomalies(stats: CategoryStat[]) {
  return stats
    .filter(s => s.percentage > 0.25)
    .map(s => ({
      category: s.name,
      percentage: s.percentage, // float 0-1
      level: s.percentage > 0.4 ? 'critical' : 'warning'
    }));
}

import { prisma } from '../../../lib/db';

/**
 * Hook to be fired post-ingestion.
 * Evaluates DB categories directly.
 */
export async function runCategorySkewGuardrail(): Promise<void> {
  try {
    const rawCategories = await prisma.category.findMany({
      select: {
        name: true,
        _count: { select: { activities: true } }
      }
    });

    const rows = rawCategories.map(c => ({
      name: c.name,
      count: c._count.activities
    }));

    const stats = computeCategoryDistribution(rows);
    const anomalies = detectAnomalies(stats);

    if (anomalies.length > 0) {
      log.warn('CATEGORY_SKEW_DETECTED', { anomalies });

      // Optional: Store this signal in DB (e.g. ContentQualityMetric) or alert system
      // We will leave the warning log which Vercel/Datadog picks up instantly.
    } else {
      log.info('Distribución de categorías en niveles saludables (<25%).');
    }
  } catch (err: any) {
    log.error('Error in runCategorySkewGuardrail', { error: err.message });
  }
}
