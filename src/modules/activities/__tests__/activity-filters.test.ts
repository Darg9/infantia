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
// City — OR pattern (regla crítica: NUNCA JOIN estricto)
// =============================================================================
describe('buildActivityWhere — cityId (OR pattern)', () => {
  it('genera OR: locationId null OR location.cityId = cityId', () => {
    const where = buildActivityWhere({ cityId: 'city-bog' });
    const and = where.AND as any[];
    expect(and).toBeDefined();

    const cityClause = and.find((c) =>
      c.OR?.some((o: any) => 'locationId' in o || 'location' in o),
    );
    expect(cityClause).toBeDefined();
    expect(cityClause.OR).toContainEqual({ locationId: null });
    expect(cityClause.OR).toContainEqual({ location: { cityId: 'city-bog' } });
  });

  it('NO genera cláusula de ciudad si cityId no se provee', () => {
    const where = buildActivityWhere({});
    // Sin cityId no debe haber AND con OR de locationId
    const and = (where.AND as any[]) ?? [];
    const cityClause = and.find((c) =>
      c.OR?.some((o: any) => 'locationId' in o),
    );
    expect(cityClause).toBeUndefined();
  });

  it('omite cityId cuando exclude="cityId"', () => {
    const where = buildActivityWhere({ cityId: 'city-bog' }, 'cityId');
    const and = (where.AND as any[]) ?? [];
    const cityClause = and.find((c) =>
      c.OR?.some((o: any) => 'locationId' in o),
    );
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
    const cityClause  = and.find((c) => c.OR?.some((o: any) => 'locationId' in o));
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
