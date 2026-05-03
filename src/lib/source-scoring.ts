// source-scoring.ts
// Lógica de scoring compartida entre el script CLI y la página de admin.
// 3 criterios:
//   Producción (50%): % actividades guardadas / posts analizados
//   Volumen (30%): actividades nuevas por semana
//   Alcance (20%): seguidores (Instagram) o actividades históricas totales (Web)

export interface SourceRankData {
  id: string;
  name: string;
  platform: string;
  url: string;
  isActive: boolean;
  // Logs del periodo
  totalRuns: number;
  totalItemsFound: number;
  totalItemsNew: number;
  // Histórico total (todas las semanas)
  historicalTotal: number;
  // Alcance
  reach: number | null;        // seguidores (IG) o actividades históricas (web)
  reachLabel: string;          // "53K seg" o "150 actividades"
  // Calculados
  productionRate: number;      // 0-1
  newPerWeek: number;
  // Score
  prodScore: number;           // 0-50
  volScore: number;            // 0-30
  reachScore: number;          // 0-20
  score: number;               // 0-100
  tier: 'A' | 'B' | 'C' | 'D';
}

export function calcSourceScore(data: {
  totalItemsFound: number;
  totalItemsNew: number;
  historicalTotal: number;
  platform: string;
  reach: number | null;
  weeks: number;
}): { prodScore: number; volScore: number; reachScore: number; score: number; tier: 'A' | 'B' | 'C' | 'D'; productionRate: number; newPerWeek: number } {
  const productionRate = data.totalItemsFound > 0 ? data.totalItemsNew / data.totalItemsFound : 0;
  const newPerWeek = data.totalItemsNew / Math.max(data.weeks, 1);

  const prodScore  = Math.min(productionRate * 100, 100) * 0.5;
  const volScore   = Math.min((newPerWeek / 5) * 100, 100) * 0.3;

  let reachScore: number;
  if (data.platform === 'INSTAGRAM' || data.platform === 'TIKTOK' || data.platform === 'FACEBOOK') {
    // Redes sociales: benchmark 50K seguidores
    reachScore = data.reach ? Math.min((data.reach / 50_000) * 100, 100) * 0.2 : 10;
  } else {
    // Web/Telegram: benchmark 200 actividades históricas
    reachScore = data.historicalTotal > 0 ? Math.min((data.historicalTotal / 200) * 100, 100) * 0.2 : 5;
  }

  const score = Math.round(prodScore + volScore + reachScore);
  const tier: 'A' | 'B' | 'C' | 'D' =
    score >= 70 ? 'A' :
    score >= 40 ? 'B' :
    score >= 20 ? 'C' : 'D';

  return { prodScore: Math.round(prodScore * 10) / 10, volScore: Math.round(volScore * 10) / 10, reachScore: Math.round(reachScore * 10) / 10, score, tier, productionRate, newPerWeek };
}

export function formatReach(platform: string, reach: number | null, historicalTotal: number): string {
  if (platform === 'INSTAGRAM' || platform === 'TIKTOK' || platform === 'FACEBOOK') {
    if (!reach) return '? seg';
    return reach >= 1000 ? `${(reach / 1000).toFixed(0)}K seg` : `${reach} seg`;
  }
  return `${historicalTotal} acts`;
}

export const TIER_LABEL: Record<string, string> = {
  A: '🥇 A',
  B: '🥈 B',
  C: '🥉 C',
  D: '❌ D',
};

export const TIER_COLOR: Record<string, string> = {
  A: 'bg-warning-50 text-warning-800 border-warning-200',
  B: 'bg-info-50 text-info-800 border-info-200',
  C: 'bg-[var(--hp-bg-page)] text-[var(--hp-text-primary)] border-[var(--hp-border)]',
  D: 'bg-error-50 text-error-700 border-error-200',
};
