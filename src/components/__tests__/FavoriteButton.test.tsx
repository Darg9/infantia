// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/current-path',
}));

vi.mock('@/lib/require-auth', () => ({ requireAuth: vi.fn() }));
vi.mock('@/modules/favorites/toggle-favorite', () => ({ toggleFavorite: vi.fn() }));

import { FavoriteButton } from '../FavoriteButton';
import { requireAuth } from '@/lib/require-auth';
import { toggleFavorite } from '@/modules/favorites/toggle-favorite';
import { ToastProvider } from '@/components/ui/toast';

// Helper: wraps component in required providers
function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(true);
  vi.mocked(toggleFavorite).mockResolvedValue({ ok: true, status: 200 } as Response);
});

describe('FavoriteButton', () => {
  describe('estado inicial', () => {
    it('muestra aria-label correcto cuando NO es favorito', () => {
      renderWithProviders(<FavoriteButton targetId="a1" initialIsFavorited={false} />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Guardar en favoritos');
    });

    it('muestra aria-label correcto cuando SÍ es favorito', () => {
      renderWithProviders(<FavoriteButton targetId="a1" initialIsFavorited={true} />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Quitar de favoritos');
    });

    it('renderiza el ícono SVG', () => {
      const { container } = renderWithProviders(<FavoriteButton targetId="a1" initialIsFavorited={false} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('interacción — agregar favorito', () => {
    it('llama toggleFavorite con expectLike=true al hacer clic cuando no es favorito', async () => {
      renderWithProviders(<FavoriteButton targetId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(toggleFavorite).toHaveBeenCalledWith({
          targetId: 'abc', type: 'activity', expectLike: true
        });
      });
    });

    it('cambia aria-label a "Quitar" optimistamente al hacer clic', async () => {
      renderWithProviders(<FavoriteButton targetId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Quitar de favoritos');
      });
    });
  });

  describe('interacción — quitar favorito', () => {
    it('llama toggleFavorite con expectLike=false al hacer clic cuando ya es favorito', async () => {
      renderWithProviders(<FavoriteButton targetId="abc" initialIsFavorited={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(toggleFavorite).toHaveBeenCalledWith({
          targetId: 'abc', type: 'activity', expectLike: false
        });
      });
    });
  });

  describe('manejo de errores', () => {
    it('revierte estado optimista si la API devuelve error', async () => {
      vi.mocked(toggleFavorite).mockResolvedValue({ ok: false, status: 500 } as Response);
      renderWithProviders(<FavoriteButton targetId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Guardar en favoritos');
      });
    });

    it('revierte optimistamente si requireAuth devuelve false (redirige al login)', async () => {
      vi.mocked(requireAuth).mockResolvedValue(false);
      renderWithProviders(<FavoriteButton targetId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Guardar en favoritos');
      });
    });

    it('revierte estado si hay error de red', async () => {
      vi.mocked(toggleFavorite).mockRejectedValue(new Error('Network error'));
      renderWithProviders(<FavoriteButton targetId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Guardar en favoritos');
      });
    });
  });

  describe('tamaño', () => {
    it('usa iconSize 16 para size=sm', () => {
      const { container } = renderWithProviders(<FavoriteButton targetId="a1" initialIsFavorited={false} size="sm" />);
      expect(container.querySelector('svg')).toHaveAttribute('width', '16');
    });

    it('usa iconSize 20 para size=md (default)', () => {
      const { container } = renderWithProviders(<FavoriteButton targetId="a1" initialIsFavorited={false} />);
      expect(container.querySelector('svg')).toHaveAttribute('width', '20');
    });
  });
});
