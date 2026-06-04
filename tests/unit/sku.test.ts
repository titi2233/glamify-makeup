import { describe, it, expect } from "vitest";
import { generateSku, isValidSku } from "@/lib/sku";

describe("generateSku", () => {
  it("formatea prefijo + secuencia con padding a 4 dígitos", () => {
    expect(generateSku("LAB", 7)).toBe("LAB-0007");
    expect(generateSku("RUB", 3)).toBe("RUB-0003");
  });

  it("normaliza el prefijo a 3 letras mayúsculas", () => {
    expect(generateSku("lab", 1)).toBe("LAB-0001");
    expect(generateSku("La", 1)).toBe("LA-0001");
    expect(generateSku("labial", 12)).toBe("LAB-0012");
  });

  it("no rompe el padding si la secuencia tiene 4+ dígitos", () => {
    expect(generateSku("MAS", 1234)).toBe("MAS-1234");
    expect(generateSku("MAS", 12345)).toBe("MAS-12345");
  });

  it("rechaza secuencias inválidas", () => {
    expect(() => generateSku("LAB", 0)).toThrow();
    expect(() => generateSku("LAB", -1)).toThrow();
    expect(() => generateSku("LAB", 1.5)).toThrow();
  });

  it("rechaza prefijos no alfabéticos o vacíos", () => {
    expect(() => generateSku("", 1)).toThrow();
    expect(() => generateSku("L1", 1)).toThrow();
  });
});

describe("isValidSku", () => {
  it("valida el formato PREFIJO-NNNN", () => {
    expect(isValidSku("LAB-0007")).toBe(true);
    expect(isValidSku("MAS-12345")).toBe(true);
    expect(isValidSku("lab-0007")).toBe(false);
    expect(isValidSku("LAB-12")).toBe(false);
    expect(isValidSku("LAB0007")).toBe(false);
  });
});
