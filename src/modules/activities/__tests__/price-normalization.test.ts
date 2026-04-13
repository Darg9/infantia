import { normalizePrice } from "@/lib/decimal";

describe("normalizePrice", () => {
  it("handles number", () => {
    expect(normalizePrice(100)).toBe(100);
  });

  it("handles string", () => {
    expect(normalizePrice("100")).toBe(100);
  });

  it("handles Prisma-like Decimal", () => {
    const mock = { toNumber: () => 100 };
    expect(normalizePrice(mock)).toBe(100);
  });

  it("handles valueOf object", () => {
    const mock = { valueOf: () => "100" };
    expect(normalizePrice(mock)).toBe(100);
  });

  it("handles invalid values", () => {
    expect(normalizePrice("abc")).toBeNull();
    expect(normalizePrice(undefined)).toBeNull();
  });
});
