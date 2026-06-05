import { describe, it, expect } from "vitest";
import { formatOrderNumber } from "@/lib/orders/order-number";

describe("formatOrderNumber", () => {
  it("formatea con prefijo GLM y padding a 6", () => {
    expect(formatOrderNumber(1)).toBe("GLM-000001");
    expect(formatOrderNumber(123)).toBe("GLM-000123");
    expect(formatOrderNumber(1234567)).toBe("GLM-1234567");
  });
  it("rechaza secuencias inválidas", () => {
    expect(() => formatOrderNumber(0)).toThrow();
    expect(() => formatOrderNumber(-1)).toThrow();
    expect(() => formatOrderNumber(1.5)).toThrow();
  });
});
