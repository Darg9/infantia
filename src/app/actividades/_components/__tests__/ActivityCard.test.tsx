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
  // createdAt hace 1 día → entra dentro de los 7 días
  createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
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
      // URL canónica: /actividades/{uuid}-{slug-del-titulo}
      expect(link?.getAttribute('href')).toMatch(/^\/actividades\/act-1-taller-de-pintura/);
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

  describe('badge de tipo', () => {
    it('muestra "Taller" para WORKSHOP', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('Taller')).toBeInTheDocument();
    });

    it('muestra "Recurrente" para RECURRING', () => {
      render(<ActivityCard activity={{ ...baseActivity, type: 'RECURRING' }} />);
      expect(screen.getByText('Recurrente')).toBeInTheDocument();
    });

    it('muestra "Campamento" para CAMP', () => {
      render(<ActivityCard activity={{ ...baseActivity, type: 'CAMP' }} />);
      expect(screen.getByText('Campamento')).toBeInTheDocument();
    });
  });

  describe('badge de precio', () => {
    it('muestra "Gratis" cuando price=0', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('Gratis')).toBeInTheDocument();
    });

    it('NO muestra badge de precio cuando price=null (No disponible)', () => {
      render(<ActivityCard activity={{ ...baseActivity, price: null }} />);
      expect(screen.queryByText('No disponible')).not.toBeInTheDocument();
    });

    it('muestra precio formateado cuando tiene valor', () => {
      render(<ActivityCard activity={{ ...baseActivity, price: 50000, pricePeriod: 'MONTHLY' }} />);
      expect(screen.getByText(/50\.000|50,000/)).toBeInTheDocument();
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

  describe('rango de edad', () => {
    it('muestra rango completo cuando hay ageMin y ageMax', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText('5–12 años')).toBeInTheDocument();
    });

    it('muestra "Desde X años" cuando solo hay ageMin', () => {
      render(<ActivityCard activity={{ ...baseActivity, ageMin: 3, ageMax: null }} />);
      expect(screen.getByText('Desde 3 años')).toBeInTheDocument();
    });

    it('NO muestra rango si ageMin y ageMax son null', () => {
      render(<ActivityCard activity={{ ...baseActivity, ageMin: null, ageMax: null }} />);
      expect(screen.queryByText(/años/)).not.toBeInTheDocument();
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

  describe('badge Nuevo', () => {
    it('muestra "Nuevo" cuando createdAt < 7 días y status=ACTIVE', () => {
      render(<ActivityCard activity={baseActivity} />);
      expect(screen.getByText(/Nuevo/i)).toBeInTheDocument();
    });

    it('NO muestra "Nuevo" cuando createdAt > 7 días', () => {
      const oldActivity = {
        ...baseActivity,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      };
      render(<ActivityCard activity={oldActivity} />);
      expect(screen.queryByText(/Nuevo/i)).not.toBeInTheDocument();
    });

    it('NO muestra "Nuevo" cuando status=EXPIRED aunque sea reciente', () => {
      const expiredNew = { ...baseActivity, status: 'EXPIRED' };
      render(<ActivityCard activity={expiredNew} />);
      expect(screen.queryByText(/🆕 Nuevo/i)).not.toBeInTheDocument();
    });

    it('muestra "Nuevo" exactamente en el límite de 7 días (< threshold)', () => {
      const borderActivity = {
        ...baseActivity,
        // 6 días y 23 horas → dentro del umbral
        createdAt: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 - 3600_000)),
      };
      render(<ActivityCard activity={borderActivity} />);
      expect(screen.getByText(/Nuevo/i)).toBeInTheDocument();
    });
  });

  describe('imagen', () => {
    it('muestra emoji cuando no hay imageUrl', () => {
      const { container } = render(<ActivityCard activity={baseActivity} />);
      // Sin imagen, se muestra un span con emoji y gradiente en el strip
      const emojiSpan = container.querySelector('span.drop-shadow-sm');
      expect(emojiSpan).toBeInTheDocument();
    });

    it('muestra img cuando hay imageUrl', () => {
      render(<ActivityCard activity={{ ...baseActivity, imageUrl: 'https://example.com/img.jpg' }} />);
      const img = screen.getByRole('img', { name: 'Taller de Pintura' });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
    });
  });
});
