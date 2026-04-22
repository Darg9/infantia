// =============================================================================
// prisma-serialize.ts — Serialización segura de objetos Prisma
// =============================================================================
//
// PROBLEMA:
//   Prisma devuelve tipos de clase complejos que NO son primitivos JSON:
//     - `Decimal` (decimal.js) → price, latitude, longitude, etc.
//     - `Date`                 → createdAt, startDate, endDate, etc.
//
//   Next.js App Router prohíbe pasar instancias de clases a través de la
//   frontera Server Component → Client Component ("Only plain objects").
//   Intentarlo produce un Fatal Server Error y pantalla negra en producción.
//
// SOLUCIÓN:
//   Usar siempre estas funciones antes de pasar datos de Prisma a cualquier
//   componente con 'use client', ya sea directamente o como prop.
//
// REGLA DE ORO (añadida a CLAUDE.md):
//   "Nunca pases un objeto Prisma directamente a un Client Component.
//    Siempre usa serializeActivity(), serializeLocation() u otro helper
//    tipado de este módulo. En caso de duda, usa toPlainObject()."
//
// =============================================================================

// ─── Primitivos ───────────────────────────────────────────────────────────────

/**
 * Convierte un Decimal de Prisma (decimal.js) a number.
 * Funciona con: Decimal.js | string numérica | number nativo | null | undefined
 */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
  }
  // Decimal.js instance (Prisma Decimal)
  if (typeof (value as any).toNumber === 'function') {
    return (value as any).toNumber();
  }
  return null;
}

/**
 * Convierte un Date de Prisma a ISO string serializable.
 * Los strings ya en formato ISO pasan sin transformación.
 */
export function toISOString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value; // ya es string ISO
}

// ─── DTOs — Plain object types para pasar a Client Components ─────────────────

/**
 * Representación serializable de una Activity de Prisma.
 * Todos los campos son primitivos JSON-seguros (sin Decimal ni Date).
 */
export interface SerializedActivity {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  audience: string;
  ageMin: number | null;
  ageMax: number | null;
  /** Convertido de Decimal a number */
  price: number | null;
  priceCurrency: string;
  pricePeriod: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  sourceDomain: string | null;
  duplicatesCount: number;
  /** Convertido de Date a ISO string */
  createdAt: string;
  provider: {
    name: string;
    isVerified: boolean;
    isPremium: boolean;
  } | null;
  location: {
    name: string;
    neighborhood: string | null;
    city: { name: string } | null;
  } | null;
  categories: {
    category: { id: string; name: string; slug: string };
  }[];
  _count: { views: number };
}

/**
 * Representación serializable de una Location de Prisma.
 * Excluye latitude y longitude (Decimal) que nunca necesitan pasar al cliente.
 */
export interface SerializedLocation {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  city: { name: string } | null;
}

// ─── Serializers ──────────────────────────────────────────────────────────────

/**
 * Serializa una Activity de Prisma a un objeto plano apto para Client Components.
 *
 * @example
 * // En un Server Component:
 * const activity = await prisma.activity.findUnique({ ... })
 * return <ActivityCard activity={serializeActivity(activity)} />
 */
export function serializeActivity(act: any): SerializedActivity {
  return {
    id: act.id,
    title: act.title,
    description: act.description ?? '',
    type: act.type,
    status: act.status,
    audience: act.audience,
    ageMin: act.ageMin ?? null,
    ageMax: act.ageMax ?? null,
    price: toNumber(act.price),
    priceCurrency: act.priceCurrency ?? 'COP',
    pricePeriod: act.pricePeriod ?? null,
    imageUrl: act.imageUrl ?? null,
    sourceUrl: act.sourceUrl ?? null,
    sourceDomain: act.sourceDomain ?? null,
    duplicatesCount: act.duplicatesCount ?? 0,
    createdAt: toISOString(act.createdAt) ?? new Date().toISOString(),
    provider: act.provider
      ? {
          name: act.provider.name,
          isVerified: act.provider.isVerified ?? false,
          isPremium: act.provider.isPremium ?? false,
        }
      : null,
    location: act.location
      ? {
          name: act.location.name,
          neighborhood: act.location.neighborhood ?? null,
          city: act.location.city ? { name: act.location.city.name } : null,
        }
      : null,
    categories: (act.categories ?? []).map((c: any) => ({
      category: {
        id: c.category.id,
        name: c.category.name,
        slug: c.category.slug,
      },
    })),
    _count: { views: act._count?.views ?? 0 },
  };
}

/**
 * Serializa una Location de Prisma a un objeto plano apto para Client Components.
 * No incluye latitude/longitude (Decimal) que nunca se necesitan en el frontend.
 */
export function serializeLocation(loc: any): SerializedLocation {
  return {
    id: loc.id,
    name: loc.name,
    address: loc.address ?? '',
    neighborhood: loc.neighborhood ?? null,
    city: loc.city ? { name: loc.city.name } : null,
  };
}

/**
 * Escape hatch genérico: convierte CUALQUIER objeto Prisma a plain object.
 * Usa esto cuando no existe un serializer específico para el tipo.
 *
 * ADVERTENCIA: Es menos eficiente que los serializers tipados porque hace
 * un round-trip JSON completo. Úsalo solo para tipos sin serializer propio.
 * No uses esto para Activity o Location — usa serializeActivity/serializeLocation.
 */
export function toPlainObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
