import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockQuit = vi.fn().mockResolvedValue('OK');

vi.mock('ioredis', () => ({
  default: vi.fn(function (this: Record<string, unknown>) {
    this.quit = mockQuit;
  }),
}));

// Reset module state between tests (singleton isolation)
import { getRedisConnection, closeRedisConnection } from '../queue/connection';

describe('queue/connection — getRedisConnection', () => {
  beforeEach(async () => {
    await closeRedisConnection(); // reset singleton first
    vi.clearAllMocks();           // then clear mock counts
  });

  it('devuelve una instancia de IORedis', () => {
    const conn = getRedisConnection();
    expect(conn).toBeDefined();
    expect(typeof conn.quit).toBe('function');
  });

  it('devuelve la misma instancia (singleton)', () => {
    const c1 = getRedisConnection();
    const c2 = getRedisConnection();
    expect(c1).toBe(c2);
  });

  it('crea la conexión con el constructor de IORedis', async () => {
    const { default: IORedis } = await import('ioredis');
    getRedisConnection();
    expect(vi.mocked(IORedis)).toHaveBeenCalled();
  });
});

describe('queue/connection — closeRedisConnection', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await closeRedisConnection();
  });

  it('llama quit al cerrar la conexión', async () => {
    getRedisConnection(); // asegura que hay conexión
    const callsBefore = mockQuit.mock.calls.length;
    await closeRedisConnection();
    expect(mockQuit.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('no hace nada si no hay conexión activa', async () => {
    await closeRedisConnection(); // ya nula
    await closeRedisConnection(); // segunda vez, no debería fallar
    expect(mockQuit).not.toHaveBeenCalled();
  });

  it('permite crear nueva conexión después de cerrar', async () => {
    const c1 = getRedisConnection();
    await closeRedisConnection();
    const c2 = getRedisConnection();
    // c2 debe ser una nueva instancia
    expect(c2).toBeDefined();
  });
});
