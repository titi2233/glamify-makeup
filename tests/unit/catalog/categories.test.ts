import { describe, it, expect } from "vitest";
import {
  buildCategoryTree,
  findCategoryByPath,
  buildBreadcrumbs,
} from "@/lib/catalog/categories";

const flat = [
  { id: "labios", slug: "labios", name: "Labios", parentId: null, order: 0 },
  { id: "labiales", slug: "labiales", name: "Labiales", parentId: "labios", order: 1 },
  { id: "gloss", slug: "gloss", name: "Gloss", parentId: "labios", order: 0 },
  { id: "ojos", slug: "ojos", name: "Ojos", parentId: null, order: 1 },
  { id: "oculto", slug: "oculto", name: "Oculto", parentId: null, order: 2, active: false },
];

describe("buildCategoryTree", () => {
  it("arma raíces ordenadas con hijos ordenados, excluye inactivas", () => {
    const tree = buildCategoryTree(flat);
    expect(tree.map((c) => c.slug)).toEqual(["labios", "ojos"]);
    const labios = tree[0];
    expect(labios.children.map((c) => c.slug)).toEqual(["gloss", "labiales"]); // order 0 antes que 1
  });
});

describe("findCategoryByPath", () => {
  const tree = buildCategoryTree(flat);
  it("categoría padre → incluye sus ids + hijos", () => {
    const r = findCategoryByPath(tree, "labios");
    expect(r?.category.slug).toBe("labios");
    expect(r?.subcategory).toBeUndefined();
    expect(new Set(r?.categoryIds)).toEqual(new Set(["labios", "gloss", "labiales"]));
  });
  it("subcategoría → solo su id", () => {
    const r = findCategoryByPath(tree, "labios", "labiales");
    expect(r?.subcategory?.slug).toBe("labiales");
    expect(r?.categoryIds).toEqual(["labiales"]);
  });
  it("rutas inexistentes → null", () => {
    expect(findCategoryByPath(tree, "nope")).toBeNull();
    expect(findCategoryByPath(tree, "labios", "nope")).toBeNull();
  });
});

describe("buildBreadcrumbs", () => {
  const tree = buildCategoryTree(flat);
  const labios = tree[0];
  const labiales = labios.children.find((c) => c.slug === "labiales")!;
  it("inicio/tienda/categoria/subcategoria/producto con current correcto", () => {
    const crumbs = buildBreadcrumbs({ category: labios, subcategory: labiales, product: { name: "Labial X", slug: "labial-x" } });
    expect(crumbs.map((c) => c.label)).toEqual(["Inicio", "Tienda", "Labios", "Labiales", "Labial X"]);
    expect(crumbs.at(-1)).toMatchObject({ current: true, href: "/producto/labial-x" });
  });
  it("sin producto marca current la última categoría", () => {
    const crumbs = buildBreadcrumbs({ category: labios });
    expect(crumbs.at(-1)).toMatchObject({ label: "Labios", current: true });
  });
});
