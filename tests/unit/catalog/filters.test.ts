import { describe, it, expect } from "vitest";
import {
  PAGE_SIZE,
  parseProductListParams,
  buildProductWhere,
  buildProductOrderBy,
  buildPagination,
} from "@/lib/catalog/filters";

describe("parseProductListParams", () => {
  it("defaults sanos", () => {
    const p = parseProductListParams({});
    expect(p).toMatchObject({ sort: "relevancia", page: 1, onSale: false, inStockOnly: false });
    expect(p.minPrice).toBeUndefined();
  });
  it("lee orden, page, precios y toggles", () => {
    const p = parseProductListParams({ orden: "precio_asc", page: "3", min: "500", max: "2000", oferta: "1", disponible: "1" });
    expect(p).toMatchObject({ sort: "precio_asc", page: 3, minPrice: 500, maxPrice: 2000, onSale: true, inStockOnly: true });
  });
  it("orden inválido → relevancia; page<1 → 1", () => {
    expect(parseProductListParams({ orden: "xxx", page: "0" })).toMatchObject({ sort: "relevancia", page: 1 });
  });
  it("inyecta category/subcategory slugs", () => {
    const p = parseProductListParams({}, { categorySlug: "labios", subcategorySlug: "labiales" });
    expect(p).toMatchObject({ categorySlug: "labios", subcategorySlug: "labiales" });
  });
});

describe("buildProductWhere", () => {
  it("siempre filtra activos y no borrados", () => {
    const where = buildProductWhere(parseProductListParams({}), null);
    expect(where).toMatchObject({ active: true, deletedAt: null });
    expect(where.categoryId).toBeUndefined();
  });
  it("filtra por categoryIds, precio, oferta y disponible", () => {
    const params = parseProductListParams({ min: "500", max: "2000", oferta: "1", disponible: "1" });
    const where = buildProductWhere(params, ["c1", "c2"]);
    expect(where.categoryId).toEqual({ in: ["c1", "c2"] });
    expect(where.basePrice).toEqual({ gte: 500, lte: 2000 });
    expect(where.compareAtPrice).toEqual({ not: null });
    expect(where.variants).toEqual({ some: { active: true, stock: { gt: 0 } } });
  });
});

describe("buildProductOrderBy", () => {
  it("mapea cada sort", () => {
    expect(buildProductOrderBy(parseProductListParams({ orden: "precio_asc" }))).toEqual([{ basePrice: "asc" }, { name: "asc" }]);
    expect(buildProductOrderBy(parseProductListParams({ orden: "precio_desc" }))).toEqual([{ basePrice: "desc" }, { name: "asc" }]);
    expect(buildProductOrderBy(parseProductListParams({ orden: "novedades" }))).toEqual([{ createdAt: "desc" }]);
    expect(buildProductOrderBy(parseProductListParams({ orden: "relevancia" }))).toEqual([
      { isFeatured: "desc" },
      { heroRank: "asc" },
      { createdAt: "desc" },
    ]);
  });
});

describe("buildPagination", () => {
  it("skip/take según page", () => {
    expect(buildPagination(parseProductListParams({ page: "1" }))).toEqual({ skip: 0, take: PAGE_SIZE });
    expect(buildPagination(parseProductListParams({ page: "3" }))).toEqual({ skip: 2 * PAGE_SIZE, take: PAGE_SIZE });
  });
});
