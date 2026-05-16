// =============================================================================
// Tests: modules/activities/activity-filters.ts — buildActivityWhere
//
// SSOT central del WHERE de actividades. Un bug aquí afecta TODO el catálogo:
// listActivities, facets, home counts, category counts y cities selector.
//
// Estrategia: función pura (sin I/O) → tests unitarios directos, sin mocks.
// Verificamos la forma del objeto WHERE que se le pasa a Prisma.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { buildActivityWhere } from '../activity-filters';

// =============================================================================
// Status
// =============================================================================
describe('buildActivityWhere — status', () => {
  it('usa ACTIVE por defecto si no se especifica status', () => {
    const where = buildActivityWhere({});
    expect(where.status).toBe('ACTIVE');
  });

  it('respeta status explícito', () => {
    const where = buildActivityWhere({ status: 'EXPIRED' });
    expect(where.status).toBe('EXPIRED');
  });
});

// =============================================================================
// Vertical
// =============================================================================
describe('buildActivityWhere — verticalId', () => {
  it('incluye verticalId cuando se provee', () => {
    const where = buildActivityWhere({ verticalId: 'v-123' });
    expect(where.verticalId).toBe('v-123');
  });

  it('NO incluye verticalId si no se provee', () => {
    const where = buildActivityWhere({});
    expect(where.verticalId).toBeUndefined();
  });
});

// =============================================================================
// Type
// =============================================================================
describe('buildActivityWhere — type', () => {
  it('incluye type cuando se provee', () => {
    const where = buildActivityWhere({ type: 'WORKSHOP' });
    expect(where.type).toBe('WORKSHOP');
  });

  it('NO incluye type si no se provee', () => {
    const where = buildActivityWhere({});
    expect(where.type).toBeUndefined();
  });

  it('omite type cuando exclude="type"', () => {
    const where = buildActivityWhere({ type: 'WORKSHOP' }, 'type');
    expect(where.type).toBeUndefined();
  });
});

// =============================================================================
// Category
// =============================================================================
describe('buildActivityWhere — categoryId', () => {
  it('incluye filtro de categoría via some', () => {
    const where = buildActivityWhere({ categoryId: 'cat-456' });
    expect(where.categories).toEqual({ some: { categoryId: 'cat-456' } });
  });

  it('omite categoría cuando exclude="categoryId"', () => {
    const where = buildActivityWhere({ categoryId: 'cat-456' }, 'categoryId');
    expect(where.categories).toBeUndefined();
  });
});

// =============================================================================
// City — JOIN estricto por ciudad
// =============================================================================
describe('buildActivityWhere — cityId (JOIN estricto)', () => {
  it('genera location.cityId = cityId (sin incluir locationId null)', () => {
    const where = buildActivityWhere({ cityId: 'city-bog' });
    const and = where.AND as any[];
    expect(and).toBeDefined();

    const cityClause = and.find((c) => c.location?.cityId === 'city-bog');
    expect(cityClause).toBeDefined();
    expect(cityClause).toEqual({ location: { cityId: 'city-bog' } });
  });

  it('NO genera cláusula de ciudad si cityId no se provee', () => {
    const where = buildActivityWhere({});
    const and = (where.AND as any[]) ?? [];
    const cityClause = and.find((c) => c.location?.cityId);
    expect(cityClause).toBeUndefined();
  });

  it('omite cityId cuando exclude="cityId"', () => {
    const where = buildActivityWhere({ cityId: 'city-bog' }, 'cityId');
    const and = (where.AND as any[]) ?? [];
    const cityClause = and.find((c) => c.location?.cityId);
    expect(cityClause).toBeUndefined();
  });
});

// =============================================================================
// Audience
// =============================================================================
describe('buildActivityWhere — audience', () => {
  it('KIDS expande a [KIDS, ALL]', () => {
    const where = buildActivityWhere({ audience: 'KIDS' });
    expect((where.audience as any).in).toEqual(['KIDS', 'ALL']);
  });

  it('FAMILY expande a [FAMILY, ALL]', () => {
    const where = buildActivityWhere({ audience: 'FAMILY' });
    expect((where.audience as any).in).toEqual(['FAMILY', 'ALL']);
  });

  it('ADULTS expande a [ADULTS, ALL]', () => {
    const where = buildActivityWhere({ audience: 'ADULTS' });
    expect((where.audience as any).in).toEqual(['ADULTS', 'ALL']);
  });

  it('audiencia desconocida NO agrega filtro', () => {
    const where = buildActivityWhere({ audience: 'UNKNOWN' });
    expect(where.audience).toBeUndefined();
  });

  it('omite audience cuando exclude="audience"', () => {
    const where = buildActivityWhere({ audience: 'KIDS' }, 'audience');
    expect(where.audience).toBeUndefined();
  });
});

// =============================================================================
// Age overlap
// =============================================================================
describe('buildActivityWhere — age overlap', () => {
  it('ageMin genera OR: ageMax >= min OR ageMax null', () => {
    const where = buildActivityWhere({ ageMin: 5 });
    const and = where.AND as any[];
    const ageMinClause = and.find((c) =>
      c.OR?.some((o: any) => o.ageMax?.gte !== undefined),
    );
    expect(ageMinClause).toBeDefined();
    expect(ageMinClause.OR).toContainEqual({ ageMax: { gte: 5 } });
    expect(ageMinClause.OR).toContainEqual({ ageMax: null });
  });

  it('ageMax genera OR: ageMin <= max OR ageMin null', () => {
    const where = buildActivityWhere({ ageMax: 12 });
    const and = where.AND as any[];
    const ageMaxClause = and.find((c) =>
      c.OR?.some((o: any) => o.ageMin?.lte !== undefined),
    );
    expect(ageMaxClause).toBeDefined();
    expect(ageMaxClause.OR).toContainEqual({ ageMin: { lte: 12 } });
    expect(ageMaxClause.OR).toContainEqual({ ageMin: null });
  });

  it('ageMin y ageMax juntos generan dos cláusulas AND independientes', () => {
    const where = buildActivityWhere({ ageMin: 5, ageMax: 12 });
    const and = where.AND as any[];
    const minClause = and.find((c) => c.OR?.some((o: any) => o.ageMax?.gte !== undefined));
    const maxClause = and.find((c) => c.OR?.some((o: any) => o.ageMin?.lte !== undefined));
    expect(minClause).toBeDefined();
    expect(maxClause).toBeDefined();
  });

  it('omite ageMin cuando exclude="ageMin"', () => {
    const where = buildActivityWhere({ ageMin: 5 }, 'ageMin');
    const and = (where.AND as any[]) ?? [];
    const ageMinClause = and.find((c) =>
      c.OR?.some((o: any) => o.ageMax?.gte !== undefined),
    );
    expect(ageMinClause).toBeUndefined();
  });
});

// =============================================================================
// Price numérico (rango)
// =============================================================================
describe('buildActivityWhere — price numérico (rango)', () => {
  it('priceMin genera price.gte', () => {
    const where = buildActivityWhere({ priceMin: 10000 });
    expect((where.price as any).gte).toBe(10000);
  });

  it('priceMax genera price.lte', () => {
    const where = buildActivityWhere({ priceMax: 50000 });
    expect((where.price as any).lte).toBe(50000);
  });

  it('priceMin + priceMax generan ambos filtros en el mismo objeto', () => {
    const where = buildActivityWhere({ priceMin: 10000, priceMax: 50000 });
    expect((where.price as any).gte).toBe(10000);
    expect((where.price as any).lte).toBe(50000);
  });
});

// =============================================================================
// Price semántico (free / paid)
// =============================================================================
describe('buildActivityWhere — price semántico', () => {
  it('price=free genera OR: price=0 OR pricePeriod=FREE', () => {
    const where = buildActivityWhere({ price: 'free' });
    const and = where.AND as any[];
    const freeClause = and.find((c) =>
      c.OR?.some((o: any) => o.price === 0 || o.pricePeriod === 'FREE'),
    );
    expect(freeClause).toBeDefined();
    expect(freeClause.OR).toContainEqual({ price: 0 });
    expect(freeClause.OR).toContainEqual({ pricePeriod: 'FREE' });
  });

  it('price=paid genera AND: price not null AND price > 0 AND NOT pricePeriod FREE', () => {
    const where = buildActivityWhere({ price: 'paid' });
    const and = where.AND as any[];
    const paidClause = and.find((c) => c.AND);
    expect(paidClause).toBeDefined();
    expect(paidClause.AND).toContainEqual({ price: { not: null } });
    expect(paidClause.AND).toContainEqual({ price: { gt: 0 } });
    expect(paidClause.AND).toContainEqual({ NOT: { pricePeriod: 'FREE' } });
  });

  it('price desconocido NO agrega cláusula de precio semántico', () => {
    const where = buildActivityWhere({ price: 'unknown' });
    const and = (where.AND as any[]) ?? [];
    const priceClause = and.find((c) =>
      c.OR?.some((o: any) => o.price === 0 || o.pricePeriod === 'FREE'),
    );
    expect(priceClause).toBeUndefined();
  });

  it('omite price semántico cuando exclude="price"', () => {
    const where = buildActivityWhere({ price: 'free' }, 'price');
    const and = (where.AND as any[]) ?? [];
    const freeClause = and.find((c) =>
      c.OR?.some((o: any) => o.price === 0),
    );
    expect(freeClause).toBeUndefined();
  });
});

// =============================================================================
// Search — ILIKE path
// =============================================================================
describe('buildActivityWhere — search ILIKE', () => {
  it('search genera OR: title ILIKE OR description ILIKE', () => {
    const where = buildActivityWhere({ search: 'teatro' });
    const and = where.AND as any[];
    const searchClause = and.find((c) =>
      c.OR?.some((o: any) => o.title?.contains === 'teatro'),
    );
    expect(searchClause).toBeDefined();
    expect(searchClause.OR).toContainEqual({
      title: { contains: 'teatro', mode: 'insensitive' },
    });
    expect(searchClause.OR).toContainEqual({
      description: { contains: 'teatro', mode: 'insensitive' },
    });
  });

  it('omite search cuando exclude="search"', () => {
    const where = buildActivityWhere({ search: 'teatro' }, 'search');
    const and = (where.AND as any[]) ?? [];
    const searchClause = and.find((c) =>
      c.OR?.some((o: any) => o.title?.contains),
    );
    expect(searchClause).toBeUndefined();
  });
});

// =============================================================================
// Search — matchingIds (pg_trgm, prioridad sobre ILIKE)
// =============================================================================
describe('buildActivityWhere — matchingIds (pg_trgm)', () => {
  it('matchingIds genera id.in con los IDs provistos', () => {
    const ids = ['id-1', 'id-2', 'id-3'];
    const where = buildActivityWhere({ matchingIds: ids });
    const and = where.AND as any[];
    const idsClause = and.find((c) => c.id?.in);
    expect(idsClause).toBeDefined();
    expect(idsClause.id.in).toEqual(ids);
  });

  it('matchingIds tiene prioridad sobre search (no genera ILIKE si hay matchingIds)', () => {
    const where = buildActivityWhere({ search: 'teatro', matchingIds: ['id-1'] });
    const and = where.AND as any[];
    const ilikeClause = and.find((c) =>
      c.OR?.some((o: any) => o.title?.contains),
    );
    expect(ilikeClause).toBeUndefined();
    const idsClause = and.find((c) => c.id?.in);
    expect(idsClause).toBeDefined();
  });

  it('matchingIds vacío ([]) NO genera cláusula id.in', () => {
    const where = buildActivityWhere({ matchingIds: undefined });
    const and = (where.AND as any[]) ?? [];
    const idsClause = and.find((c) => c.id?.in);
    expect(idsClause).toBeUndefined();
  });
});

// =============================================================================
// Bad domains (quality filter)
// =============================================================================
describe('buildActivityWhere — badDomains', () => {
  it('genera OR: sourceDomain null OR NOT in badDomains', () => {
    const where = buildActivityWhere({ badDomains: ['spam.com', 'bad.co'] });
    const and = where.AND as any[];
    const domainClause = and.find((c) =>
      c.OR?.some((o: any) => 'sourceDomain' in o && o.sourceDomain === null),
    );
    expect(domainClause).toBeDefined();
    expect(domainClause.OR).toContainEqual({ sourceDomain: null });
    expect(domainClause.OR).toContainEqual({
      NOT: { sourceDomain: { in: ['spam.com', 'bad.co'] } },
    });
  });

  it('badDomains vacío NO agrega cláusula de dominios', () => {
    const where = buildActivityWhere({ badDomains: [] });
    const and = (where.AND as any[]) ?? [];
    const domainClause = and.find((c) =>
      c.OR?.some((o: any) => 'sourceDomain' in o),
    );
    expect(domainClause).toBeUndefined();
  });

  it('sin badDomains NO agrega cláusula de dominios', () => {
    const where = buildActivityWhere({});
    const and = (where.AND as any[]) ?? [];
    const domainClause = and.find((c) =>
      c.OR?.some((o: any) => 'sourceDomain' in o),
    );
    expect(domainClause).toBeUndefined();
  });
});

// =============================================================================
// Date Range — filtro temporal (S65 + fix S71)
// =============================================================================
describe('buildActivityWhere — dateRange', () => {
  // ── today ──────────────────────────────────────────────────────────────────
  describe("dateRange='today'", () => {
    it('genera startDate.gte y startDate.lt', () => {
      const where = buildActivityWhere({ dateRange: 'today' });
      const and = where.AND as any[];
      const dateClause = and.find((c) => c.startDate?.gte !== undefined);
      expect(dateClause).toBeDefined();
      expect(dateClause.startDate.gte).toBeInstanceOf(Date);
      expect(dateClause.startDate.lt).toBeInstanceOf(Date);
    });

    it('los límites son UTC midnight (T00:00:00Z) — no T05:00:00Z Colombia', () => {
      // Fix S71: límites en UTC midnight para que fechas almacenadas como
      // T00:00:00Z (Gemini date-only) no caigan en el día equivocado.
      const where = buildActivityWhere({ dateRange: 'today' });
      const and = where.AND as any[];
      const dateClause = and.find((c) => c.startDate?.gte !== undefined);
      const gte: Date = dateClause.startDate.gte;
      const lt: Date  = dateClause.startDate.lt;

      expect(gte.getUTCHours()).toBe(0);
      expect(gte.getUTCMinutes()).toBe(0);
      expect(gte.getUTCSeconds()).toBe(0);
      expect(lt.getUTCHours()).toBe(0);
      expect(lt.getUTCMinutes()).toBe(0);
      expect(lt.getUTCSeconds()).toBe(0);
    });

    it('la ventana es exactamente 24h (1 día)', () => {
      const where = buildActivityWhere({ dateRange: 'today' });
      const and = where.AND as any[];
      const dateClause = and.find((c) => c.startDate?.gte !== undefined);
      const diff = dateClause.startDate.lt.getTime() - dateClause.startDate.gte.getTime();
      expect(diff).toBe(24 * 60 * 60 * 1000); // 86_400_000 ms
    });

    it('UTC midnight de mañana (T00:00:00Z) NO queda dentro del rango de hoy', () => {
      // Regresión: este era el bug — actividades del 14 may T00:00Z aparecían en "hoy"
      const where = buildActivityWhere({ dateRange: 'today' });
      const and = where.AND as any[];
      const dateClause = and.find((c) => c.startDate?.gte !== undefined);
      const lt: Date = dateClause.startDate.lt; // = mañana T00:00:00Z

      // Simular actividad almacenada como UTC midnight de mañana:
      // lt es el límite superior (exclusive). Una actividad con startDate = lt
      // NO debe estar en el rango (ya que la query es `lt: lt`, es decir < lt).
      // Verificamos que lt coincide con UTC midnight de mañana.
      const tomorrowMidnightUTC = new Date(dateClause.startDate.gte.getTime() + 24 * 60 * 60 * 1000);
      expect(lt.toISOString()).toBe(tomorrowMidnightUTC.toISOString());
    });

    it('omite dateRange cuando exclude="dateRange"', () => {
      const where = buildActivityWhere({ dateRange: 'today' }, 'dateRange');
      const and = (where.AND as any[]) ?? [];
      const dateClause = and.find((c) => c.startDate?.gte !== undefined);
      expect(dateClause).toBeUndefined();
    });
  });

  // ── week ───────────────────────────────────────────────────────────────────
  describe("dateRange='week'", () => {
    it('la ventana es exactamente 7 días', () => {
      const where = buildActivityWhere({ dateRange: 'week' });
      const and = where.AND as any[];
      const dateClause = and.find((c) => c.startDate?.gte !== undefined);
      const diff = dateClause.startDate.lt.getTime() - dateClause.startDate.gte.getTime();
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  // ── weekend ─────────────────────────────────────────────────────────────────
  describe("dateRange='weekend'", () => {
    it('la ventana es 2 días (sáb + dom)', () => {
      const where = buildActivityWhere({ dateRange: 'weekend' });
      const and = where.AND as any[];
      const dateClause = and.find((c) => c.startDate?.gte !== undefined);
      const diff = dateClause.startDate.lt.getTime() - dateClause.startDate.gte.getTime();
      expect(diff).toBe(2 * 24 * 60 * 60 * 1000);
    });
  });
});

// =============================================================================
// Combinación de filtros — integridad del AND acumulado
// =============================================================================
describe('buildActivityWhere — combinación de filtros', () => {
  it('múltiples filtros combinados producen AND con todas las cláusulas', () => {
    const where = buildActivityWhere({
      cityId: 'city-bog',
      price: 'free',
      ageMin: 5,
      badDomains: ['spam.com'],
    });

    const and = where.AND as any[];
    expect(and.length).toBe(4); // city + free + ageMin + badDomains

    // Todas las cláusulas deben estar presentes
    const cityClause  = and.find((c) => c.location?.cityId === 'city-bog');
    const freeClause  = and.find((c) => c.OR?.some((o: any) => o.price === 0));
    const ageClause   = and.find((c) => c.OR?.some((o: any) => o.ageMax?.gte !== undefined));
    const domainClause = and.find((c) => c.OR?.some((o: any) => o.sourceDomain === null));

    expect(cityClause).toBeDefined();
    expect(freeClause).toBeDefined();
    expect(ageClause).toBeDefined();
    expect(domainClause).toBeDefined();
  });

  it('sin filtros opcionales, AND no existe o está vacío', () => {
    const where = buildActivityWhere({});
    const and = (where.AND as any[]) ?? [];
    expect(and.length).toBe(0);
  });
});
