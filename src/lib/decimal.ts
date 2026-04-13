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
  } else if (typeof value === "object" && value !== null) {
    // Prisma Decimal (toNumber)
    if ("toNumber" in value && typeof (value as any).toNumber === "function") {
      result = (value as any).toNumber();
    } else if ("valueOf" in value && typeof (value as any).valueOf === "function") {
      const val = Number((value as any).valueOf());
      result = isNaN(val) ? null : val;
    }
  }

  if (result === null && process.env.NODE_ENV === "development") {
    console.warn("Invalid price value", value);
  }

  return result;
}
