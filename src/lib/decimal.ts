// ❗ Nunca usar .toNumber() directamente
export function normalizePrice(value: unknown): number | null {
  let result: number | null = null;

  if (value == null) {
    result = null;
  } else if (typeof value === "number") {
    result = value;
  } else if (typeof value === "string") {
    const parsed = Number(value);
    result = isNaN(parsed) ? null : parsed;
  } else if (typeof value === 'object' && value !== null) {
    // Prisma Decimal (toNumber)
    type WithToNumber = { toNumber: () => number };
    type WithValueOf  = { valueOf: () => unknown };
    if ('toNumber' in value && typeof (value as WithToNumber).toNumber === 'function') {
      result = (value as WithToNumber).toNumber();
    } else if ('valueOf' in value && typeof (value as WithValueOf).valueOf === 'function') {
      const val = Number((value as WithValueOf).valueOf());
      result = isNaN(val) ? null : val;
    }
  }

  if (result === null && process.env.NODE_ENV === "development") {
    console.warn("Invalid price value", value);
  }

  return result;
}
