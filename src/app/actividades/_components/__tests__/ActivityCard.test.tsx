import { Button } from '@/components/ui';
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mocks para dependencias de cliente
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/FavoriteButton', () => ({
  FavoriteButton: ({ activityId, initialIsFavorited }: { activityId: string; initialIsFavorited: boolean }) => (
    <Button aria-label={initialIsFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'} data-activity-id={activityId} />
  ),
}));
// SHOW_AUDIENCE_LABEL=true en tests — los tests de audiencia verifican la lógica
// aunque el flag esté OFF en producción (datos incompletos). Al reactivar el flag,
// estos tests seguirán siendo válidos sin modificación.
vi.mock('@/config/feature-flags', () => ({
  FEATURE_FLAGS: {
    SHOW_AUDIENCE_LABEL: true,
    DATE_FILTER_ENABLED: false,
    PARSER_FALLBACK_ENABLED: true,
    DISCOVERY_RANKING_ENABLED: true,
    DISCOVERY_RANKING_MODE: 'shadow',
    DISCOVERY_RANKING_MODE_BY_SOURCE: {},
  },
}));

import ActivityCard from '../ActivityCard';

const baseActivity = {
  id: 'act-1',
  title: 'Taller de Pintura',
  description: 'Aprende técnicas de pintura con acuarelas.',
  type: 'WORKSHOP',
  status: 'ACTIVE',
  audience: 'KIDS',
  ageMin: 5,
  ageMax: 12,
  price: 0,
  priceCurrency: 'COP',
  pricePeriod: 'FREE',
  imageUrl: null,
  sourceUrl: 'https://example.com',
  sourceDomain: 'example.com',
  duplicatesCount: 0,
  createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  startDate: null,
  endDate: null,
  schedule: null,
  provider: { name: 'BibloRed', isVerified: true, isPremium: false },
  location: { name: 'Biblioteca Tintal', neighborhood: 'Tintal', city: { name: 'Bogotá' } },
  categories: [{ category: { id: 'c1', name: 'Arte y Creatividad', slug: 'arte-y-creatividad' } }],
};

describe('ActivityCard', () => {
  describe('contenido básico', () => {
    it('muestra el título de la actividad', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('Taller de Pintura')).toBeInTheDocument();
    });

    it('muestra la descripción', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText(/técnicas de pintura/i)).toBeInTheDocument();
    });

    it('enlaza a la página de detalle con URL canónica (uuid-slug)', () => {
      const { container } = render(<ActivityCard activity={baseActivity} />);
      const link = container.querySelector('a');
      expect(link?.getAttribute('href')).toMatch(/^\/actividad\/act-1-taller-de-pintura/);
    });

    it('muestra el nombre del proveedor', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('BibloRed')).toBeInTheDocument();
    });

    it('muestra el barrio/location', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText(/Tintal/i)).toBeInTheDocument();
    });

    it('muestra la categoría', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('Arte y Creatividad')).toBeInTheDocument();
    });
  });

  describe('label temporal (overlay izquierdo)', () => {
    it('NO muestra label cuando no hay startDate', () => {
      render(<ActivityCard activity={{ ...baseActivity, startDate: null }} />);
      // No debe aparecer ningún label de fecha
      expect(screen.queryByText(/^Hoy/)).not.toBeInTheDocument();
      expect(screen.queryByText('Mañana')).not.toBeInTheDocument();
    });

    it('muestra "Hoy" cuando startDate es medianoche Colombia de hoy', () => {
      // Medianoche COT = 05:00 UTC del mismo día Colombia
      const now = new Date();
      const COL_OFFSET_MS = 5 * 60 * 60 * 1000;
      const nowCOL = new Date(now.getTime() - COL_OFFSET_MS);
      const midnightCOT = new Date(
        Date.UTC(nowCOL.getUTCFullYear(), nowCOL.getUTCMonth(), nowCOL.getUTCDate()) + COL_OFFSET_MS
      );
      render(<ActivityCard activity={{ ...baseActivity, startDate: midnightCOT.toISOString() }} />);
      expect(screen.getByText('Hoy')).toBeInTheDocument();
    });

    it('muestra "Hoy · X PM" cuando startDate es hoy con hora', () => {
      const COL_OFFSET_MS = 5 * 60 * 60 * 1000;
      const now = new Date();
      const nowCOL = new Date(now.getTime() - COL_OFFSET_MS);
      // Fija la hora a las 3 PM COT = 20:00 UTC
      const startCOT = new Date(
        Date.UTC(nowCOL.getUTCFullYear(), nowCOL.getUTCMonth(), nowCOL.getUTCDate(), 20, 0, 0)
      );
      render(<ActivityCard activity={{ ...baseActivity, startDate: startCOT.toISOString() }} />);
      expect(screen.getByText(/^Hoy · /)).toBeInTheDocument();
    });

    it('muestra "Mañana" cuando startDate es mañana', () => {
      const COL_OFFSET_MS = 5 * 60 * 60 * 1000;
      const now = new Date();
      const nowCOL = new Date(now.getTime() - COL_OFFSET_MS);
      const tomorrowCOT = new Date(
        Date.UTC(nowCOL.getUTCFullYear(), nowCOL.getUTCMonth(), nowCOL.getUTCDate() + 1) + COL_OFFSET_MS
      );
      render(<ActivityCard activity={{ ...baseActivity, startDate: tomorrowCOT.toISOString() }} />);
      expect(screen.getByText('Mañana')).toBeInTheDocument();
    });

    it('muestra label de día para eventos dentro de la semana (ej. "Mar 19")', () => {
      const COL_OFFSET_MS = 5 * 60 * 60 * 1000;
      const now = new Date();
      const nowCOL = new Date(now.getTime() - COL_OFFSET_MS);
      // 4 días en el futuro en hora Colombia
      const futureCOT = new Date(
        Date.UTC(nowCOL.getUTCFullYear(), nowCOL.getUTCMonth(), nowCOL.getUTCDate() + 4) + COL_OFFSET_MS
      );
      const { container } = render(<ActivityCard activity={{ ...baseActivity, startDate: futureCOT.toISOString() }} />);
      // Verificamos que el overlay izquierdo (temporal label) existe y tiene algún texto
      // El texto exacto depende del día actual — no lo fijamos para evitar flakiness
      const overlay = container.querySelector('.absolute.top-1\\.5.left-2');
      expect(overlay).not.toBeNull();
      expect(overlay?.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('muestra "Este fin de semana" cuando startDate es sábado dentro de 7 días', () => {
      const COL_OFFSET_MS = 5 * 60 * 60 * 1000;
      // Construimos un sábado en el futuro próximo (dentro de 7 días)
      const now = new Date();
      const nowCOL = new Date(now.getTime() - COL_OFFSET_MS);
      const dow = nowCOL.getUTCDay();
      // Días hasta el próximo sábado (si hoy es sáb, avanzamos 7 días para el siguiente)
      const toNextSat = dow === 6 ? 7 : (6 - dow) % 7 || 7;
      if (toNextSat > 6 || toNextSat === 1) {
        // Skip si: sábado a 7 días (hoy es sáb) o a 1 día (hoy es vie → "Mañana", no "Este fin de semana")
        return;
      }
      const satCOT = new Date(
        Date.UTC(nowCOL.getUTCFullYear(), nowCOL.getUTCMonth(), nowCOL.getUTCDate() + toNextSat) + COL_OFFSET_MS
      );
      render(<ActivityCard activity={{ ...baseActivity, startDate: satCOT.toISOString() }} />);
      expect(screen.getByText('Este fin de semana')).toBeInTheDocument();
    });

    it('muestra rango "D1–D2 Mes" para eventos multi-día del mismo mes', () => {
      // Fecha futura > 7 días, con endDate
      const futureStart = new Date('2030-08-18T05:00:00Z'); // 18 ago 2030 medianoche COT
      const futureEnd   = new Date('2030-08-20T05:00:00Z'); // 20 ago 2030
      render(<ActivityCard activity={{ ...baseActivity, startDate: futureStart.toISOString(), endDate: futureEnd.toISOString() }} />);
      expect(screen.getByText('18–20 Ago')).toBeInTheDocument();
    });

    it('muestra "D Mes" para eventos futuros (> 7 días, sin rango)', () => {
      const futureDate = new Date('2030-09-05T05:00:00Z'); // 5 sep 2030 medianoche COT
      render(<ActivityCard activity={{ ...baseActivity, startDate: futureDate.toISOString() }} />);
      expect(screen.getByText('5 Sep')).toBeInTheDocument();
    });
  });

  describe('badge derecho (Gratis | Destacado)', () => {
    it('muestra "Gratis" cuando price=0', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('Gratis')).toBeInTheDocument();
    });

    it('muestra "Gratis" cuando pricePeriod=FREE', () => {
      render(<ActivityCard activity={{ ...baseActivity, price: null, pricePeriod: 'FREE' }} />);
      expect(screen.getByText('Gratis')).toBeInTheDocument();
    });

    it('muestra "Destacado" cuando actividad multi-fuente y no es gratis', () => {
      render(<ActivityCard activity={{ ...baseActivity, price: 50000, pricePeriod: 'MONTHLY', duplicatesCount: 2 }} />);
      expect(screen.getByText(/Destacado/i)).toBeInTheDocument();
    });

    it('Gratis tiene prioridad sobre Destacado', () => {
      render(<ActivityCard activity={{ ...baseActivity, price: 0, pricePeriod: 'FREE', duplicatesCount: 3 }} />);
      expect(screen.getByText('Gratis')).toBeInTheDocument();
      expect(screen.queryByText(/Destacado/i)).not.toBeInTheDocument();
    });

    it('NO muestra badge derecho cuando es de pago y no es destacado', () => {
      render(<ActivityCard activity={{ ...baseActivity, price: 50000, pricePeriod: 'MONTHLY', duplicatesCount: 0 }} />);
      expect(screen.queryByText('Gratis')).not.toBeInTheDocument();
      expect(screen.queryByText(/Destacado/i)).not.toBeInTheDocument();
    });
  });

  describe('badge de audiencia', () => {
    it('muestra "Niños" para KIDS', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('Niños')).toBeInTheDocument();
    });

    it('muestra "Familia" para FAMILY', () => {
      render(<ActivityCard activity={{ ...baseActivity, audience: 'FAMILY' }} />);
      expect(screen.getByText('Familia')).toBeInTheDocument();
    });
  });

  describe('badge de expirada', () => {
    it('muestra aviso cuando status=EXPIRED', () => {
      render(<ActivityCard activity={{ ...baseActivity, status: 'EXPIRED' }} />);
      expect(screen.getByText(/Verificar disponibilidad/i)).toBeInTheDocument();
    });

    it('NO muestra aviso cuando status=ACTIVE', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.queryByText(/Verificar disponibilidad/i)).not.toBeInTheDocument();
    });
  });

  describe('rango de edad (editorial)', () => {
    it('muestra "Niños" en lugar de "5-12 años" para el target medio', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('Niños')).toBeInTheDocument();
      expect(screen.queryByText('5–12 años')).not.toBeInTheDocument();
    });

    it('muestra "Bebés" si minAge es <= 2', () => {
      render(<ActivityCard activity={{ ...baseActivity, ageMin: 1, ageMax: null }} />);
      expect(screen.getByText('Bebés')).toBeInTheDocument();
    });

    it('muestra "Familia" como fallback si ageMin y ageMax son null y no es familia', () => {
      render(<ActivityCard activity={{ ...baseActivity, ageMin: null, ageMax: null, audience: 'ALL' }} />);
      expect(screen.getByText('Familia')).toBeInTheDocument();
    });
  });

  describe('FavoriteButton', () => {
    it('pasa isFavorited=false por defecto', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toBeInTheDocument();
    });

    it('pasa isFavorited=true cuando se indica', () => {
      render(<ActivityCard activity={baseActivity} isFavorited={true} />);
      expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toBeInTheDocument();
    });
  });

  describe('imagen', () => {
    it('muestra emoji cuando no hay imageUrl', () => {
      const { container } = render(<ActivityCard activity={baseActivity} />);
      const emojiSpan = container.querySelector('span.text-4xl.select-none');
      expect(emojiSpan).toBeInTheDocument();
    });

    it('muestra img cuando hay imageUrl', () => {
      render(<ActivityCard activity={{ ...baseActivity, imageUrl: 'https://example.com/img.jpg' }} />);
      const img = screen.getByRole('img', { name: 'Taller de Pintura' });
      expect(img).toBeInTheDocument();
      // next/image transforma la URL a /_next/image?url=... — verificamos que contiene el dominio original
      expect(img).toHaveAttribute('src', expect.stringContaining('example.com'));
    });
  });

  describe('badges eliminados (regresión)', () => {
    it('NO muestra "Verificado" como badge de overlay', () => {
      render(<ActivityCard activity={{ ...baseActivity, sourceDomain: 'idartes.gov.co' }} />);
      // El proveedor verificado muestra "✓" en el footer, NO como badge de overlay
      expect(screen.queryByText('✓ Verificado')).not.toBeInTheDocument();
    });

    it('NO muestra "Nuevo" aunque la actividad sea reciente', () => {
      render(<ActivityCard activity={{ ...baseActivity, createdAt: new Date() }} />);
      expect(screen.queryByText(/🆕 Nuevo/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\bNuevo\b/i)).not.toBeInTheDocument();
    });

    it('NO muestra badge de tipo "Recurrente" ni "Única vez"', () => {
      const { rerender } = render(<ActivityCard activity={{ ...baseActivity, type: 'RECURRING' }} />);
      expect(screen.queryByText('Recurrente')).not.toBeInTheDocument();
      rerender(<ActivityCard activity={{ ...baseActivity, type: 'ONE_TIME' }} />);
      expect(screen.queryByText('Única vez')).not.toBeInTheDocument();
    });
  });
});
