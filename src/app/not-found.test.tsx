// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFound from './not-found';

describe('NotFound (404)', () => {
  it('muestra el número 404', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('muestra el headline correcto', () => {
    render(<NotFound />);
    expect(screen.getByText('Esta página no existe')).toBeInTheDocument();
  });

  it('tiene enlace a /actividades', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: /Ver actividades/i });
    expect(link).toHaveAttribute('href', '/actividades');
  });

  it('tiene enlace a / (home)', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: /Ir al inicio/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('muestra el emoji de ilustración', () => {
    render(<NotFound />);
    expect(screen.getByText('🗺️')).toBeInTheDocument();
  });
});
