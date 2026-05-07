// =============================================================================
// OG Image dinámica para landings de ciudad — /actividades/[citySlug]
// Generada con Next.js ImageResponse (sin dependencias externas).
// Tamaño: 1200×630 (estándar OpenGraph / WhatsApp / Twitter).
// =============================================================================

import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slugify';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const alt = 'Actividades para niños y familias';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ citySlug: string }>;
}

export default async function Image({ params }: Props) {
  const { citySlug } = await params;

  // Buscar ciudad por slug
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: {
      name: true,
      _count: { select: { locations: { where: { activities: { some: { status: 'ACTIVE' } } } } } },
    },
  });

  const city = cities.find((c) => slugify(c.name) === citySlug);
  const cityName = city?.name ?? 'Colombia';

  // Contar actividades activas en la ciudad
  const count = city
    ? await prisma.activity.count({
        where: {
          status: 'ACTIVE',
          location: { city: { name: cityName } },
        },
      })
    : 0;

  const countLabel = count > 0 ? `${count} actividades` : 'Actividades';

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
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f5a8a 60%, #0ea5e9 100%)',
          padding: '60px 72px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Círculos decorativos */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 60,
            right: 160,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            display: 'flex',
          }}
        />

        {/* Badge de ciudad */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 50,
            padding: '10px 24px',
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 28, marginRight: 10 }}>📍</span>
          <span style={{ color: '#ffffff', fontSize: 26, fontWeight: 600, letterSpacing: '-0.3px' }}>
            {cityName}
          </span>
        </div>

        {/* Titular principal */}
        <div
          style={{
            color: '#ffffff',
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>Actividades para</span>
          <span style={{ color: '#7dd3fc' }}>niños y familias</span>
        </div>

        {/* Conteo */}
        <div
          style={{
            color: 'rgba(255,255,255,0.80)',
            fontSize: 30,
            fontWeight: 500,
            marginBottom: 40,
            display: 'flex',
          }}
        >
          {countLabel} verificadas · HabitaPlan
        </div>

        {/* Barra inferior: branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 14,
            padding: '12px 24px',
          }}
        >
          <span style={{ color: '#7dd3fc', fontSize: 22, fontWeight: 700 }}>HabitaPlan</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>habitaplan.com</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
