import { describe, it, expect } from "vitest";
import { formatARS, parseDecimal } from "@/lib/money";

describe("formatARS", () => {
  it("formatea con separador de miles y 2 decimales (es-AR, espacio normalizado)", () => {
    expect(formatARS(1500)).toBe("$ 1.500,00");
    expect(formatARS(47500)).toBe("$ 47.500,00");
    expect(formatARS(0)).toBe("$ 0,00");
  });

  it("acepta strings de Prisma Decimal", () => {
    expect(formatARS("999.9")).toBe("$ 999,90");
  });

  it("redondea a 2 decimales", () => {
    expect(formatARS(1234.567)).toBe("$ 1.234,57");
    expect(formatARS(10.5)).toBe("$ 10,50");
  });

  it("normaliza el espacio no separable a un espacio normal", () => {
    expect(formatARS(1500)).not.toContain(" ");
    expect(formatARS(1500)).toContain(" ");
  });
});

describe("parseDecimal", () => {
  it("convierte distintos inputs a number", () => {
    expect(parseDecimal("1234.5")).toBe(1234.5);
    expect(parseDecimal(10)).toBe(10);
  });

  it("rechaza valores no numéricos", () => {
    expect(() => parseDecimal("abc")).toThrow();
  });
});
