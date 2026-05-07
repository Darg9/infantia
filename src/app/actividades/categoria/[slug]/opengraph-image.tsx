// =============================================================================
// OG Image dinámica para landings de categoría — /actividades/categoria/[slug]
// Generada con Next.js ImageResponse. Tamaño estándar 1200×630.
// =============================================================================

import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const alt = 'Actividades para niños y familias';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Paleta de colores por categoría (fallback verde-esmeralda)
const CATEGORY_COLORS: Record<string, { from: string; to: string; accent: string }> = {
  talleres:      { from: '#1e3a5f', to: '#0f5a8a', accent: '#7dd3fc' },
  arte:          { from: '#4a1c5f', to: '#7c3aed', accent: '#c4b5fd' },
  musica:        { from: '#1c3a4a', to: '#0e7490', accent: '#67e8f9' },
  deportes:      { from: '#1a3a1a', to: '#166534', accent: '#86efac' },
  teatro:        { from: '#4a2c1a', to: '#9a3412', accent: '#fdba74' },
  literatura:    { from: '#1a1a3a', to: '#1e3a8a', accent: '#93c5fd' },
  ciencia:       { from: '#1a3a3a', to: '#0f766e', accent: '#5eead4' },
  danza:         { from: '#3a1a3a', to: '#86198f', accent: '#f0abfc' },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;

  const category = await prisma.category.findFirst({
    where: { slug },
    select: {
      name: true,
      _count: { select: { activities: { where: { activity: { status: 'ACTIVE' } } } } },
    },
  });

  const categoryName = category?.name ?? 'Actividades';
  const count = category?._count.activities ?? 0;
  const countLabel = count > 0 ? `${count} actividades` : 'Actividades';

  // Color por slug o fallback brand
  const colors = CATEGORY_COLORS[slug] ?? { from: '#1e4a2a', to: '#166534', accent: '#86efac' };

  // Emoji representativo por categoría
  const EMOJIS: Record<string, string> = {
    talleres: '🎨', arte: '🖌️', musica: '🎵', deportes: '⚽',
    teatro: '🎭', literatura: '📚', ciencia: '🔬', danza: '💃',
  };
  const emoji = EMOJIS[slug] ?? '✨';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
          padding: '60px 72px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Círculos decorativos */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 60, right: 160, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex' }} />

        {/* Badge de categoría */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 50, padding: '10px 24px', marginBottom: 24 }}>
          <span style={{ fontSize: 28, marginRight: 10 }}>{emoji}</span>
          <span style={{ color: '#ffffff', fontSize: 26, fontWeight: 600, letterSpacing: '-0.3px' }}>
            {categoryName}
          </span>
        </div>

        {/* Titular */}
        <div style={{ color: '#ffffff', fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20, display: 'flex', flexDirection: 'column' }}>
          <span>Actividades para</span>
          <span style={{ color: colors.accent }}>niños y familias</span>
        </div>

        {/* Conteo */}
        <div style={{ color: 'rgba(255,255,255,0.80)', fontSize: 30, fontWeight: 500, marginBottom: 40, display: 'flex' }}>
          {countLabel} verificadas · HabitaPlan
        </div>

        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 24px' }}>
          <span style={{ color: colors.accent, fontSize: 22, fontWeight: 700 }}>HabitaPlan</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>habitaplan.com</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
