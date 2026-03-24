// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { FavoriteButton } from '../FavoriteButton';

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
});

describe('FavoriteButton', () => {
  describe('estado inicial', () => {
    it('muestra aria-label correcto cuando NO es favorito', () => {
      render(<FavoriteButton activityId="a1" initialIsFavorited={false} />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Guardar en favoritos');
    });

    it('muestra aria-label correcto cuando SÍ es favorito', () => {
      render(<FavoriteButton activityId="a1" initialIsFavorited={true} />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Quitar de favoritos');
    });

    it('renderiza el ícono SVG', () => {
      const { container } = render(<FavoriteButton activityId="a1" initialIsFavorited={false} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('interacción — agregar favorito', () => {
    it('hace POST /api/favorites al hacer clic cuando no es favorito', async () => {
      render(<FavoriteButton activityId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/favorites', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ activityId: 'abc' }),
        }));
      });
    });

    it('cambia aria-label a "Quitar" optimistamente al hacer clic', async () => {
      render(<FavoriteButton activityId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Quitar de favoritos');
      });
    });
  });

  describe('interacción — quitar favorito', () => {
    it('hace DELETE /api/favorites/:id al hacer clic cuando ya es favorito', async () => {
      render(<FavoriteButton activityId="abc" initialIsFavorited={true} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/favorites/abc', expect.objectContaining({
          method: 'DELETE',
        }));
      });
    });
  });

  describe('manejo de errores', () => {
    it('revierte estado optimista si la API devuelve error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      render(<FavoriteButton activityId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Guardar en favoritos');
      });
    });

    it('redirige a /login si API responde 401', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });
      render(<FavoriteButton activityId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/login'));
      });
    });

    it('revierte estado si hay error de red', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      render(<FavoriteButton activityId="abc" initialIsFavorited={false} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Guardar en favoritos');
      });
    });
  });

  describe('tamaño', () => {
    it('usa iconSize 16 para size=sm', () => {
      const { container } = render(<FavoriteButton activityId="a1" initialIsFavorited={false} size="sm" />);
      expect(container.querySelector('svg')).toHaveAttribute('width', '16');
    });

    it('usa iconSize 20 para size=md (default)', () => {
      const { container } = render(<FavoriteButton activityId="a1" initialIsFavorited={false} />);
      expect(container.querySelector('svg')).toHaveAttribute('width', '20');
    });
  });
});
