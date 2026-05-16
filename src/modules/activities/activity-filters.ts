/**
 * buildActivityWhere — SSOT para el WHERE de actividades
 *
 * Centraliza la lógica de filtros para evitar divergencias entre:
 *   - listActivities()       → activities.service.ts
 *   - getFacets() / page.tsx → actividades/page.tsx
 *   - home category counts   → app/page.tsx
 *
 * Regla: si añades/modificas un filtro, hazlo AQUÍ. Los callers se benefician
 * automáticamente sin necesidad de tocar múltiples archivos.
 *
 * Historial de bugs prevenidos:
 *   - S60: cityId usaba JOIN estricto en service.ts pero OR en page.tsx → resultados distintos.
 */

import type { Prisma } from '@/generated/prisma/client';

// =============================================================================
// Helpers de fecha — Colombia = UTC-5 (sin horario de verano, offset fijo)
// =============================================================================

const COL_OFFSET_MS = 5 * 60 * 60 * 1000; // 5h en ms

/**
 * Devuelve el timestamp UTC midnight (T00:00:00Z) para el día Colombia
 * actual + offsetDays.
 *
 * ⚠️  DESIGN DECISION: se usan límites UTC midnight (T00:00Z), NO Colombia midnight
 * (T05:00Z). Razón: Gemini almacena fechas sin hora como T00:00:00Z (UTC midnight).
 * Si usáramos T05:00Z como límite, una actividad almacenada como 2026-05-14T00:00Z
 * caería dentro del rango "hoy" (13 may COT), mostrando "Hoy" incorrectamente.
 *
 * Trade-off aceptado: eventos con hora real a las 7–11 PM COT (almacenados como
 * T00–T04 UTC del día siguiente) caerían en el bucket "equivocado". En la práctica
 * nuestro catálogo usa T00:00:00Z para fechas-only, por lo que esta heurística
 * es correcta para ≥95% de los casos.
 *
 * Ejemplo (now = 2026-05-13 COT):
 *   colombiaDayStartUTC(0)  → 2026-05-13T00:00:00Z
 *   colombiaDayStartUTC(1)  → 2026-05-14T00:00:00Z
 */
function colombiaDayStartUTC(offsetDays: number): Date {
  const nowColombia = new Date(Date.now() - COL_OFFSET_MS);
  const y  = nowColombia.getUTCFullYear();
  const mo = nowColombia.getUTCMonth();
  const d  = nowColombia.getUTCDate() + offsetDays;
  return new Date(Date.UTC(y, mo, d)); // UTC midnight — NO sumar COL_OFFSET_MS
}

// =============================================================================
// Parámetros de filtro
// =============================================================================

export interface ActivityFilterParams {
  /** Estado de la actividad (default: 'ACTIVE') */
  status?: string;

  /** Vertical (segmento de mercado) */
  verticalId?: string;

  /** Tipo de actividad: ONE_TIME, RECURRING, WORKSHOP, CAMP */
  type?: string;

  /** ID de categoría */
  categoryId?: string;

  /**
   * ID de ciudad.
   *
   * Usa OR pattern: incluye actividades sin locationId asignado (~60% del catálogo)
   * + actividades con location.cityId = cityId.
   *
   * ⚠️ NUNCA usar `where.location = { cityId }` — es JOIN estricto que excluye nulls.
   */
  cityId?: string;

  /** Audiencia objetivo: KIDS, FAMILY, ADULTS */
  audience?: string;

  /** Edad mínima del visitante (overlap semántico) */
  ageMin?: number;

  /** Edad máxima del visitante (overlap semántico) */
  ageMax?: number;

  /**
   * Filtro de precio semántico: 'free' | 'paid'
   * Para rangos numéricos usar priceMin / priceMax.
   */
  price?: string;

  /** Precio mínimo en pesos (rango numérico, listActivities) */
  priceMin?: number;

  /** Precio máximo en pesos (rango numérico, listActivities) */
  priceMax?: number;

  /**
   * Texto de búsqueda.
   *
   * Dos caminos mutuamente excluyentes por caller:
   *   • `matchingIds` presentes → usa IDs de pg_trgm (listActivities, mayor precisión)
   *   • Solo `search` → usa ILIKE directo (facets, home — sin pg_trgm overhead)
   *
   * `exclude: 'search'` desactiva ambos.
   */
  search?: string;

  /**
   * IDs ya computados por pg_trgm (listActivities).
   * Cuando están presentes, toman prioridad sobre `search` para el filtro SQL.
   */
  matchingIds?: string[];

  /**
   * Filtro de rango de fecha (S65):
   *   'today'   → startDate en el día actual (Colombia UTC-5)
   *   'weekend' → startDate en el próximo sábado–domingo Colombia
   *   'week'    → startDate dentro de los próximos 7 días Colombia
   *
   * ⚠️ Filtro estricto: excluye actividades sin startDate.
   * Activar solo cuando haya cobertura de datos suficiente.
   */
  dateRange?: 'today' | 'weekend' | 'week';

  /**
   * Dominios con sourceHealth.score < 0.1 a excluir.
   * Pasado por listActivities (relevance) y home (conteos de calidad).
   * Facets NO lo pasan — queremos mostrar todas las opciones de filtro disponibles.
   */
  badDomains?: string[];
}

// =============================================================================
// Builder principal
// =============================================================================

/**
 * Construye el `Prisma.ActivityWhereInput` para todas las queries de actividades.
 *
 * @param params  Filtros activos
 * @param exclude Dimensión a excluir (usada en getFacets para contar opciones
 *                disponibles sin auto-excluirse: ej. al contar "tipos" no aplica
 *                el filtro de tipo activo para mostrar otras opciones con count)
 */
export function buildActivityWhere(
  params: ActivityFilterParams,
  exclude?: keyof ActivityFilterParams,
): Prisma.ActivityWhereInput {
  const where: Prisma.ActivityWhereInput = {};
  const andConditions: Prisma.ActivityWhereInput[] = [];

  // ── Status ──────────────────────────────────────────────────────────────────
  where.status = (params.status ?? 'ACTIVE') as Prisma.EnumActivityStatusFilter;

  // ── Vertical ─────────────────────────────────────────────────────────────────
  if (params.verticalId) {
    where.verticalId = params.verticalId;
  }

  // ── Type ─────────────────────────────────────────────────────────────────────
  if (params.type && exclude !== 'type') {
    where.type = params.type as Prisma.EnumActivityTypeFilter;
  }

  // ── Category ─────────────────────────────────────────────────────────────────
  if (params.categoryId && exclude !== 'categoryId') {
    where.categories = { some: { categoryId: params.categoryId } };
  }

  // ── City — JOIN estricto por ciudad ─────────────────────────────────────────
  // Solo actividades con location asignada a la ciudad pedida.
  // Incluir locationId:null inflaría el conteo (aparecerían en todas las ciudades)
  // generando discrepancia con la landing page /actividades/[citySlug].
  if (params.cityId && exclude !== 'cityId') {
    andConditions.push({ location: { cityId: params.cityId } });
  }

  // ── Audience ─────────────────────────────────────────────────────────────────
  if (params.audience && exclude !== 'audience') {
    const vals = audienceValues(params.audience);
    if (vals.length) {
      where.audience = { in: vals as Prisma.EnumActivityAudienceFilter['in'] };
    }
  }

  // ── Age overlap ───────────────────────────────────────────────────────────────
  if (params.ageMin !== undefined && exclude !== 'ageMin') {
    andConditions.push({ OR: [{ ageMax: { gte: params.ageMin } }, { ageMax: null }] });
  }
  if (params.ageMax !== undefined && exclude !== 'ageMax') {
    andConditions.push({ OR: [{ ageMin: { lte: params.ageMax } }, { ageMin: null }] });
  }

  // ── Price range numérico (listActivities) ────────────────────────────────────
  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    const priceFilter: Prisma.DecimalNullableFilter = {};
    if (params.priceMin !== undefined) priceFilter.gte = params.priceMin;
    if (params.priceMax !== undefined) priceFilter.lte = params.priceMax;
    where.price = priceFilter;
  }

  // ── Price semántico (free / paid) ────────────────────────────────────────────
  if (params.price && exclude !== 'price') {
    if (params.price === 'free') {
      andConditions.push({ OR: [{ price: 0 }, { pricePeriod: 'FREE' }] });
    } else if (params.price === 'paid') {
      andConditions.push({
        AND: [
          { price: { not: null } },
          { price: { gt: 0 } },
          { NOT: { pricePeriod: 'FREE' } },
        ],
      });
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────────
  // matchingIds (pg_trgm) tiene prioridad sobre search (ILIKE).
  // exclude: 'search' desactiva ambos caminos.
  if (exclude !== 'search') {
    if (params.matchingIds) {
      // pg_trgm path (listActivities): IDs ya filtrados con alta precisión
      andConditions.push({ id: { in: params.matchingIds } });
    } else if (params.search) {
      // ILIKE path (facets, home): búsqueda directa sin overhead de pg_trgm
      andConditions.push({
        OR: [
          { title: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ],
      });
    }
  }

  // ── Quality filter (bad domains) ─────────────────────────────────────────────
  // Solo excluye el fondo absoluto (score < 0.1). Entre 0.1–0.3, el ranking en
  // memoria ya los empuja al fondo sin ocultarlos.
  // IMPORTANTE: NULL NOT IN (...) → NULL en SQL, no TRUE.
  // Usamos OR explícito para preservar actividades sin sourceDomain asignado.
  if (params.badDomains && params.badDomains.length > 0) {
    andConditions.push({
      OR: [
        { sourceDomain: null },
        { NOT: { sourceDomain: { in: params.badDomains } } },
      ],
    });
  }

  // ── Date Range ────────────────────────────────────────────────────────────────
  // Filtro estricto: solo actividades con startDate en el rango Colombia.
  // NULL startDate → excluido automáticamente (NULL no satisface >= en SQL).
  if (params.dateRange && exclude !== 'dateRange') {
    const today = colombiaDayStartUTC(0);

    if (params.dateRange === 'today') {
      andConditions.push({
        startDate: { gte: today, lt: colombiaDayStartUTC(1) },
      });
    } else if (params.dateRange === 'week') {
      andConditions.push({
        startDate: { gte: today, lt: colombiaDayStartUTC(7) },
      });
    } else if (params.dateRange === 'weekend') {
      // Calcula días al próximo sábado (o el actual si hoy es sáb/dom)
      const nowCol  = new Date(Date.now() - COL_OFFSET_MS);
      const dow     = nowCol.getUTCDay();           // 0=Dom, 6=Sáb
      const toSat   = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
      andConditions.push({
        startDate: {
          gte: colombiaDayStartUTC(toSat),
          lt:  colombiaDayStartUTC(toSat + 2), // hasta fin del domingo
        },
      });
    }
  }

  // ── Merge AND ─────────────────────────────────────────────────────────────────
  if (andConditions.length) {
    where.AND = andConditions;
  }

  return where;
}

// =============================================================================
// Helpers
// =============================================================================

function audienceValues(audience: string): string[] {
  if (audience === 'KIDS')   return ['KIDS', 'ALL'];
  if (audience === 'FAMILY') return ['FAMILY', 'ALL'];
  if (audience === 'ADULTS') return ['ADULTS', 'ALL'];
  return [];
}
