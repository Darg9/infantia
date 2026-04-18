// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ActividadesLoading from '../loading';

describe('ActividadesLoading (skeleton)', () => {
  it('renderiza sin errores', () => {
    const { container } = render(<ActividadesLoading />);
    expect(container).toBeTruthy();
  });

  it('muestra 12 tarjetas skeleton', () => {
    const { container } = render(<ActividadesLoading />);
    // Cada tarjeta tiene la clase animate-pulse
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(12);
  });

  it('tiene fondo bg-[var(--hp-bg-page)] (mismo que la página real)', () => {
    const { container } = render(<ActividadesLoading />);
    expect(container.firstChild).toHaveClass('bg-[var(--hp-bg-page)]');
  });

  it('contiene un div de grid responsivo', () => {
    const { container } = render(<ActividadesLoading />);
    // Tailwind genera clases con ":" que querySelector no puede parsear directamente
    const grid = container.querySelector('[class*="grid-cols"]');
    expect(grid).toBeInTheDocument();
  });
});
