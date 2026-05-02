// =============================================================================
// Tests: lib/track.ts
// Mockea fetch global — no toca APIs reales
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch before importing the module
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

import { trackEvent } from '../track';

describe('trackEvent', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('llama fetch con POST a /api/events', async () => {
    await trackEvent({ type: 'page_view', path: '/actividades' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }),
    );
  });

  it('incluye type, activityId, path y metadata en el body', async () => {
    await trackEvent({
      type: 'activity_view',
      activityId: 'abc-123',
      path: '/actividades/abc-123',
      metadata: { source: 'search' },
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      type: 'activity_view',
      activityId: 'abc-123',
      path: '/actividades/abc-123',
      metadata: { source: 'search' },
    });
  });

  it('no aplica throttle (delay=0) para eventos no configurados', async () => {
    await trackEvent({ type: 'page_view' });
    await trackEvent({ type: 'page_view' });
    // Sin throttle → fetch debe llamarse 2 veces
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('aplica throttle a activity_click (delay=500ms)', async () => {
    await trackEvent({ type: 'activity_click', activityId: 'x1' });
    await trackEvent({ type: 'activity_click', activityId: 'x1' });
    // Segundo call dentro de 500ms → bloqueado
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('aplica throttle a outbound_click (delay=1000ms)', async () => {
    await trackEvent({ type: 'outbound_click', activityId: 'y1' });
    await trackEvent({ type: 'outbound_click', activityId: 'y1' });
    // Segundo call dentro de 1000ms → bloqueado
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throttle es por key (type:activityId) — keys distintas no se bloquean entre sí', async () => {
    await trackEvent({ type: 'activity_click', activityId: 'a1' });
    await trackEvent({ type: 'activity_click', activityId: 'a2' }); // key distinta
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('no propaga errores de fetch (fail silently)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    await expect(trackEvent({ type: 'page_view' })).resolves.not.toThrow();
  });
});

// =============================================================================
// Tests: trackFilterApplied — contrato del evento filter_applied (FEAT-6.8-3)
// =============================================================================

import { trackFilterApplied } from '../track';

describe('trackFilterApplied', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('dispara trackEvent con el payload correcto (categoría + query)', async () => {
    await trackFilterApplied({
      filterType: 'category',
      filterValue: 'Arte',
      resultsCount: 42,
      query: 'taller',
      path: '/actividades?categoryId=abc',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('filter_applied');
    expect(body.metadata).toMatchObject({
      filterType: 'category',
      filterValue: 'Arte',
      resultsCount: 42,
      query: 'taller',
    });
  });

  it('query es null en el payload cuando no se proporciona', async () => {
    await trackFilterApplied({
      filterType: 'city',
      filterValue: 'Bogotá',
      resultsCount: 87,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.metadata.query).toBeNull();
  });

  it('NO dispara cuando filterValue está vacío (reset de filtro)', async () => {
    await trackFilterApplied({
      filterType: 'category',
      filterValue: '',
      resultsCount: 100,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('usa keepalive: true en el fetch subyacente', async () => {
    await trackFilterApplied({
      filterType: 'age',
      filterValue: '4-6 años',
      resultsCount: 23,
      path: '/actividades?age=4-6',  // path único para aislar la key de throttle
    });

    expect(mockFetch.mock.calls[0][1].keepalive).toBe(true);
  });

  it('es fail-silent: no lanza si fetch falla', () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    // trackFilterApplied es void — llama a trackEvent internamente (que es fail-silent)
    // No debe lanzar en ninguna circunstancia
    expect(() =>
      trackFilterApplied({ filterType: 'price', filterValue: 'free-fail', resultsCount: 5 })
    ).not.toThrow();
  });

  it('aplica throttle de 2000ms (segunda llamada igual es bloqueada)', async () => {
    // path único para que la key de throttle sea independiente de otros tests
    const unique = 'paid-throttle-test';
    const throttlePath = '/actividades?throttle-test=1';
    await trackFilterApplied({ filterType: 'price', filterValue: unique, resultsCount: 10, path: throttlePath });
    await trackFilterApplied({ filterType: 'price', filterValue: unique, resultsCount: 10, path: throttlePath });
    // Segunda llamada dentro del throttle de 2000ms → bloqueada
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

