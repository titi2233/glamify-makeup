import { describe, it, expect } from "vitest";
import {
  getStockState,
  getProductStockState,
  stockLabel,
  isAvailable,
} from "@/lib/catalog/stock";

const v = (stock: number, lowStockThreshold = 3, active = true) => ({ stock, lowStockThreshold, active });

describe("getStockState", () => {
  it("out_of_stock cuando stock <= 0", () => {
    expect(getStockState(v(0))).toBe("out_of_stock");
  });
  it("low_stock cuando stock <= umbral", () => {
    expect(getStockState(v(2, 3))).toBe("low_stock");
    expect(getStockState(v(3, 3))).toBe("low_stock");
  });
  it("in_stock cuando stock > umbral", () => {
    expect(getStockState(v(10, 3))).toBe("in_stock");
  });
});

describe("getProductStockState", () => {
  it("in_stock si alguna variante activa está in_stock", () => {
    expect(getProductStockState([v(0), v(10)])).toBe("in_stock");
  });
  it("low_stock si ninguna in_stock pero alguna low", () => {
    expect(getProductStockState([v(0), v(2, 3)])).toBe("low_stock");
  });
  it("out_of_stock si todas en 0 o sin variantes activas", () => {
    expect(getProductStockState([v(0), v(0)])).toBe("out_of_stock");
    expect(getProductStockState([v(10, 3, false)])).toBe("out_of_stock");
    expect(getProductStockState([])).toBe("out_of_stock");
  });
});

describe("stockLabel", () => {
  it("etiquetas legibles", () => {
    expect(stockLabel("in_stock")).toBe("Disponible");
    expect(stockLabel("low_stock", 2)).toBe("Quedan 2");
    expect(stockLabel("out_of_stock")).toBe("Sin stock");
  });
});

describe("isAvailable", () => {
  it("disponible salvo out_of_stock", () => {
    expect(isAvailable([v(1)])).toBe(true);
    expect(isAvailable([v(0)])).toBe(false);
  });
});
