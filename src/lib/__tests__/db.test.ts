import { describe, it, expect, vi } from 'vitest';

const { mockPrismaInstance } = vi.hoisted(() => ({
  mockPrismaInstance: { $connect: vi.fn() },
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(function () { return {}; }),
}));

vi.mock('../../generated/prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function () {
    return mockPrismaInstance;
  }),
}));

import { prisma } from '../db';

describe('lib/db', () => {
  it('exporta prisma como instancia de PrismaClient', () => {
    expect(prisma).toBeDefined();
    expect(prisma).toBe(mockPrismaInstance);
  });

  it('crea PrismaClient con PrismaPg adapter', async () => {
    const { PrismaClient } = await import('../../generated/prisma/client');
    expect(PrismaClient).toHaveBeenCalled();
  });

  it('crea PrismaPg con DATABASE_URL', async () => {
    const { PrismaPg } = await import('@prisma/adapter-pg');
    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: process.env.DATABASE_URL,
    });
  });

  it('singleton pattern: guarda en globalThis en desarrollo', () => {
    // In non-production (test), prisma should be set on globalThis
    const g = globalThis as unknown as { prisma: unknown };
    expect(g.prisma).toBe(prisma);
  });
});
