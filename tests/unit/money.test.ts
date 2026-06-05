import { describe, it, expect } from "vitest";
import { formatARS, parseDecimal, round2 } from "@/lib/money";

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

describe("round2", () => {
  it("redondea a 2 decimales (half-up)", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(2500)).toBe(2500);
  });
  it("acepta strings", () => {
    expect(round2("3.999")).toBe(4);
  });
  it("evita drift de punto flotante", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(3200 * 1.1)).toBe(3520);
  });
  it("rechaza no-finitos", () => {
    expect(() => round2("abc")).toThrow();
  });
});
