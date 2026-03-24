// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

const popularCategories = [
  { id: '1', name: 'Música' },
  { id: '2', name: 'Arte' },
  { id: '3', name: 'Deportes' },
];

describe('EmptyState', () => {
  describe('sin filtros activos', () => {
    it('muestra mensaje genérico', () => {
      render(<EmptyState popularCategories={popularCategories} />);
      expect(screen.getByText('Sin resultados para esa combinación de filtros')).toBeInTheDocument();
    });

    it('NO muestra el botón limpiar (sin filtros activos)', () => {
      render(<EmptyState popularCategories={popularCategories} />);
      expect(screen.queryByRole('link', { name: /Limpiar filtros/i })).not.toBeInTheDocument();
    });
  });

  describe('con búsqueda activa', () => {
    it('muestra el término buscado en el headline', () => {
      render(<EmptyState search="yoga" popularCategories={popularCategories} />);
      expect(screen.getByText(/No encontramos resultados para "yoga"/i)).toBeInTheDocument();
    });

    it('muestra sugerencias de búsqueda', () => {
      render(<EmptyState search="yoga" popularCategories={popularCategories} />);
      // Puede aparecer en múltiples elementos (p + li); getAllByText verifica que exista al menos uno
      const matches = screen.getAllByText(/errores tipográficos/i);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('muestra el botón de limpiar filtros con href correcto', () => {
      render(<EmptyState search="yoga" popularCategories={popularCategories} />);
      const link = screen.getByRole('link', { name: /Limpiar filtros/i });
      expect(link).toHaveAttribute('href', '/actividades');
    });
  });

  describe('con categoría activa', () => {
    it('muestra el nombre de la categoría en el headline', () => {
      render(
        <EmptyState
          categoryId="1"
          categoryName="Música"
          popularCategories={popularCategories}
        />
      );
      expect(screen.getByText(/No hay actividades en "Música"/i)).toBeInTheDocument();
    });
  });

  describe('con rango de edad activo', () => {
    it('menciona el rango de edad en las sugerencias', () => {
      render(<EmptyState ageMin={5} ageMax={10} popularCategories={popularCategories} />);
      expect(screen.getByText(/5–10 años/i)).toBeInTheDocument();
    });

    it('menciona solo ageMin cuando no hay ageMax', () => {
      render(<EmptyState ageMin={3} popularCategories={popularCategories} />);
      expect(screen.getByText(/desde 3 años/i)).toBeInTheDocument();
    });
  });

  describe('categorías populares', () => {
    it('muestra las categorías como quick-links', () => {
      render(<EmptyState search="xyz" popularCategories={popularCategories} />);
      expect(screen.getByRole('link', { name: /Música/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Arte/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Deportes/i })).toBeInTheDocument();
    });

    it('los links apuntan a /actividades?categoryId=...', () => {
      render(<EmptyState search="xyz" popularCategories={popularCategories} />);
      const links = screen.getAllByRole('link');
      const categoryLink = links.find(l => l.getAttribute('href')?.includes('categoryId=1'));
      expect(categoryLink).toBeInTheDocument();
    });

    it('NO muestra sección de categorías si la lista está vacía', () => {
      render(<EmptyState search="xyz" popularCategories={[]} />);
      expect(screen.queryByText(/O explora estas categorías/i)).not.toBeInTheDocument();
    });

    it('muestra máximo 6 categorías', () => {
      const manyCats = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, name: `Cat ${i}` }));
      render(<EmptyState search="xyz" popularCategories={manyCats} />);
      const catLinks = screen.getAllByRole('link').filter(l =>
        l.getAttribute('href')?.includes('categoryId=')
      );
      expect(catLinks.length).toBeLessThanOrEqual(6);
    });
  });
});
