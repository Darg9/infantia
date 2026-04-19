import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { quota } from '../quota-tracker';
import { getAvailableKey } from '../quota-tracker';

describe('QuotaTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calcula correctamente el reset para las 08:00 UTC (medianoche PST) si aun no son las 8', async () => {
    // 07:00 UTC (1 hora antes del reset)
    const mockDate = new Date(Date.UTC(2026, 3, 19, 7, 0, 0));
    vi.setSystemTime(mockDate);

    // Mock Redis
    const setMock = vi.fn().mockResolvedValue('OK');
    const getRedisMock = vi.spyOn(quota as any, 'getRedis' as any).mockReturnValue({
      set: setMock,
    } as any);

    await quota.markExhausted('test-key');

    // Expected reset is today at 8:00 UTC
    const expectedReset = new Date(Date.UTC(2026, 3, 19, 8, 0, 0));
    const ttlSeconds = Math.ceil((expectedReset.getTime() - mockDate.getTime()) / 1000);

    expect(setMock).toHaveBeenCalledWith(
      'quota:gemini:test-key',
      expectedReset.toISOString(),
      'EX',
      ttlSeconds
    );
  });

  it('calcula correctamente el reset para el día siguiente si ya pasaron las 8:00 UTC', async () => {
    // 09:00 UTC (1 hora después del reset)
    const mockDate = new Date(Date.UTC(2026, 3, 19, 9, 0, 0));
    vi.setSystemTime(mockDate);

    const setMock = vi.fn().mockResolvedValue('OK');
    const getRedisMock = vi.spyOn(quota as any, 'getRedis' as any).mockReturnValue({
      set: setMock,
    } as any);

    await quota.markExhausted('test-key');

    // Expected reset is TOMORROW at 8:00 UTC
    const expectedReset = new Date(Date.UTC(2026, 3, 20, 8, 0, 0));
    const ttlSeconds = Math.ceil((expectedReset.getTime() - mockDate.getTime()) / 1000);

    expect(setMock).toHaveBeenCalledWith(
      'quota:gemini:test-key',
      expectedReset.toISOString(),
      'EX',
      ttlSeconds
    );
  });

  it('isAvailable limpia la key si el reset ya pasó', async () => {
    const mockDate = new Date(Date.UTC(2026, 3, 19, 10, 0, 0));
    vi.setSystemTime(mockDate);

    const delMock = vi.fn().mockResolvedValue(1);
    
    // Key mock expirada (08:00 UTC del día actual, o sea, hace 2h)
    const getMock = vi.fn().mockResolvedValue(new Date(Date.UTC(2026, 3, 19, 8, 0, 0)).toISOString());
    const getRedisMock = vi.spyOn(quota as any, 'getRedis' as any).mockReturnValue({
      get: getMock,
      del: delMock,
    } as any);

    const available = await quota.isAvailable('test-key');
    expect(available).toBe(true);
    expect(delMock).toHaveBeenCalledWith('quota:gemini:test-key');
  });

  it('getAvailableKey retorna null si todas las llaves están agotadas', async () => {
    process.env.GEMINI_KEYS = 'key1,key2';
    
    // Forzamos isAvailable a false siempre
    vi.spyOn(quota, 'isAvailable').mockResolvedValue(false);

    const key = await getAvailableKey();
    expect(key).toBeNull();
  });

  it('clearAll borra todas las llaves del pool', async () => {
    process.env.GEMINI_KEYS = 'keyA,keyB';
    
    const delMock = vi.fn().mockResolvedValue(1);
    const getRedisMock = vi.spyOn(quota as any, 'getRedis' as any).mockReturnValue({
      del: delMock,
    } as any);

    const cleared = await quota.clearAll();
    
    expect(cleared).toBe(2);
    expect(delMock).toHaveBeenCalledWith('quota:gemini:keyA');
    expect(delMock).toHaveBeenCalledWith('quota:gemini:keyB');
  });
});
