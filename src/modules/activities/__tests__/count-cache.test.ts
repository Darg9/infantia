import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedCount } from '../activities.service';
import { prisma } from '../../../lib/db';

vi.mock('../../../lib/db', () => ({
  prisma: {
    activity: {
      count: vi.fn(),
    },
  },
}));

describe('Count TTL Cache Engine', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Vaciamos el entorno o forzamos tiempos (Vitest fake timers seria ideal aquí si lo usáramos globalmente).
    vi.useFakeTimers();
  });

  const sampleWhere = { 
    status: 'ACTIVE', 
    AND: [{ NOT: { sourceDomain: { in: ['bad.com'] } } }] 
  };

  it('debería calcular el total consultando la BD e ignorar hit de caché la primera vez', async () => {
    vi.mocked(prisma.activity.count).mockResolvedValueOnce(500);

    const count = await getCachedCount(sampleWhere);
    
    expect(count).toBe(500);
    expect(prisma.activity.count).toHaveBeenCalledTimes(1);
    expect(prisma.activity.count).toHaveBeenCalledWith({ where: sampleWhere });
  });

  it('debería saltarse la llamada a BD si el payload/where está en caché', async () => {
    // Primera llamada (arrastra caché)
    vi.mocked(prisma.activity.count).mockResolvedValueOnce(150);
    await getCachedCount({ test: 'hit' });

    // Segunda llamada inmediata
    const count = await getCachedCount({ test: 'hit' });
    
    expect(count).toBe(150);
    expect(prisma.activity.count).toHaveBeenCalledTimes(1); // No subió a 2.
  });

  it('debería rehacer la consulta si expiró el tiempo del TTL (60s)', async () => {
    vi.mocked(prisma.activity.count)
       .mockResolvedValueOnce(200)
       .mockResolvedValueOnce(205); // Simulated updated total items

    const wherePattern = { dynamic: true };
    await getCachedCount(wherePattern);
    
    // Saltamos 61 segundos hacia el futuro
    vi.advanceTimersByTime(61000); 

    const countAfterExpire = await getCachedCount(wherePattern);

    expect(countAfterExpire).toBe(205);
    expect(prisma.activity.count).toHaveBeenCalledTimes(2);
  });

});
