import { describe, it, expect } from "vitest";
import { isValidSkuPrefix, nextSkuSequence, generateSku } from "@/lib/admin/sku";

describe("isValidSkuPrefix", () => {
  it("acepta 1 a 3 letras A-Z mayúsculas", () => {
    expect(isValidSkuPrefix("L")).toBe(true);
    expect(isValidSkuPrefix("LA")).toBe(true);
    expect(isValidSkuPrefix("LAB")).toBe(true);
  });

  it("rechaza minúsculas, números, vacío y más de 3 letras", () => {
    expect(isValidSkuPrefix("lab")).toBe(false);
    expect(isValidSkuPrefix("LA1")).toBe(false);
    expect(isValidSkuPrefix("")).toBe(false);
    expect(isValidSkuPrefix("LABS")).toBe(false);
    expect(isValidSkuPrefix("L-B")).toBe(false);
  });
});

describe("nextSkuSequence", () => {
  it("devuelve 1 cuando no hay SKUs", () => {
    expect(nextSkuSequence([])).toBe(1);
  });

  it("devuelve el máximo número final + 1", () => {
    expect(nextSkuSequence(["LAB-0001", "LAB-0002", "LAB-0003"])).toBe(4);
    expect(nextSkuSequence(["LAB-0007"])).toBe(8);
  });

  it("usa el máximo aunque vengan desordenados o de distinto prefijo", () => {
    expect(nextSkuSequence(["RUB-0010", "LAB-0002", "LAB-0009"])).toBe(11);
  });

  it("ignora SKUs malformados o sin número final", () => {
    expect(nextSkuSequence(["LAB-0002", "roto", "LAB-", "SIN-NUMERO", "LAB-0005"])).toBe(6);
  });

  it("ignora todos los malformados y cae a 1", () => {
    expect(nextSkuSequence(["roto", "tambien-roto"])).toBe(1);
  });

  it("toma SKUs con 5+ dígitos", () => {
    expect(nextSkuSequence(["MAS-12345"])).toBe(12346);
  });
});

describe("generateSku (re-export)", () => {
  it("queda disponible desde el módulo admin/sku", () => {
    expect(generateSku("LAB", nextSkuSequence(["LAB-0006"]))).toBe("LAB-0007");
  });
});
