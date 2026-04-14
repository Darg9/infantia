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
