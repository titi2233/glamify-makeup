import { describe, it, expect } from "vitest";
import {
  validateCategory,
  assertMaxTwoLevels,
  type CategoryFormInput,
} from "@/lib/admin/categories/validation";

const base: CategoryFormInput = {
  name: "Labiales",
  slug: "",
  parentId: null,
  skuPrefix: "lab",
  order: "0",
  active: true,
  image: null,
};

describe("validateCategory", () => {
  it("acepta una categoría válida y normaliza slug, prefijo y orden", () => {
    const r = validateCategory(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe("Labiales");
    expect(r.value.slug).toBe("labiales"); // auto desde name
    expect(r.value.skuPrefix).toBe("LAB"); // uppercase
    expect(r.value.order).toBe(0);
    expect(r.value.parentId).toBeNull();
    expect(r.value.active).toBe(true);
    expect(r.value.image).toBeNull();
  });

  it("respeta un slug provisto y lo normaliza", () => {
    const r = validateCategory({ ...base, slug: "Labios Mate" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.slug).toBe("labios-mate");
  });

  it("rechaza nombre vacío", () => {
    const r = validateCategory({ ...base, name: "   " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("El nombre es obligatorio.");
  });

  it("rechaza prefijo de SKU inválido", () => {
    const r = validateCategory({ ...base, skuPrefix: "LAB1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("El prefijo de SKU debe tener 1 a 3 letras (A–Z).");
  });

  it("rechaza orden no numérico", () => {
    const r = validateCategory({ ...base, order: "abc" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("El orden debe ser un número entero.");
  });

  it("rechaza orden negativo", () => {
    const r = validateCategory({ ...base, order: "-1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("El orden no puede ser negativo.");
  });

  it("trim de la imagen vacía → null", () => {
    const r = validateCategory({ ...base, image: "   " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.image).toBeNull();
  });

  it("conserva parentId no vacío", () => {
    const r = validateCategory({ ...base, parentId: "cat-root" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.parentId).toBe("cat-root");
  });
});

describe("assertMaxTwoLevels", () => {
  it("padre raíz (parentId null) → ok", () => {
    expect(assertMaxTwoLevels({ id: "p1", parentId: null })).toEqual({ ok: true, value: true });
  });

  it("padre que ya es hijo → rechaza", () => {
    const r = assertMaxTwoLevels({ id: "p2", parentId: "root" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Solo se permiten dos niveles: la categoría elegida ya es una subcategoría.");
  });

  it("padre inexistente → rechaza", () => {
    const r = assertMaxTwoLevels(null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("La categoría padre no existe.");
  });
});
