import { describe, it, expect } from "vitest";
import { validateCombo, type ComboFormInput } from "@/lib/admin/combos/validation";

const base: ComboFormInput = {
  name: "  Combo Glow  ",
  slug: "",
  description: "  dos labiales  ",
  comboPrice: 4999.5,
  images: ["combos/glow.webp", ""],
  active: true,
  validFrom: null,
  validTo: null,
  items: [
    { variantId: "v1", qty: 2 },
    { variantId: "v2", qty: 1 },
  ],
};

describe("validateCombo", () => {
  it("normaliza name/description, deriva slug del name y redondea el precio", () => {
    const r = validateCombo(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe("Combo Glow");
    expect(r.value.slug).toBe("combo-glow");
    expect(r.value.description).toBe("dos labiales");
    expect(r.value.comboPrice).toBe(4999.5);
    expect(r.value.images).toEqual(["combos/glow.webp"]); // descarta vacíos
    expect(r.value.items).toEqual([
      { variantId: "v1", qty: 2 },
      { variantId: "v2", qty: 1 },
    ]);
  });

  it("respeta el slug provisto (normalizado) en vez de derivarlo", () => {
    const r = validateCombo({ ...base, slug: "  Combo VERANO  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.slug).toBe("combo-verano");
  });

  it("description vacía → null", () => {
    const r = validateCombo({ ...base, description: "   " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.description).toBeNull();
  });

  it("rechaza name vacío", () => {
    const r = validateCombo({ ...base, name: "   " });
    expect(r).toEqual({ ok: false, error: "Poné un nombre para el combo." });
  });

  it("rechaza precio <= 0", () => {
    expect(validateCombo({ ...base, comboPrice: 0 })).toEqual({ ok: false, error: "El precio del combo tiene que ser mayor a 0." });
    expect(validateCombo({ ...base, comboPrice: -10 })).toEqual({ ok: false, error: "El precio del combo tiene que ser mayor a 0." });
  });

  it("rechaza precio no numérico", () => {
    expect(validateCombo({ ...base, comboPrice: Number.NaN })).toEqual({ ok: false, error: "El precio del combo tiene que ser mayor a 0." });
  });

  it("rechaza combo sin items", () => {
    expect(validateCombo({ ...base, items: [] })).toEqual({ ok: false, error: "El combo tiene que tener al menos un producto." });
  });

  it("rechaza qty < 1 en algún item", () => {
    expect(validateCombo({ ...base, items: [{ variantId: "v1", qty: 0 }] })).toEqual({ ok: false, error: "Cada producto del combo tiene que llevar cantidad 1 o más." });
  });

  it("rechaza qty no entera", () => {
    expect(validateCombo({ ...base, items: [{ variantId: "v1", qty: 1.5 }] })).toEqual({ ok: false, error: "Cada producto del combo tiene que llevar cantidad 1 o más." });
  });

  it("rechaza item sin variantId", () => {
    expect(validateCombo({ ...base, items: [{ variantId: "  ", qty: 1 }] })).toEqual({ ok: false, error: "Elegí un producto para cada renglón del combo." });
  });

  it("rechaza variantes duplicadas", () => {
    expect(
      validateCombo({ ...base, items: [{ variantId: "v1", qty: 1 }, { variantId: "v1", qty: 2 }] }),
    ).toEqual({ ok: false, error: "No repitas el mismo producto en el combo; subí la cantidad." });
  });

  it("rechaza validTo anterior a validFrom", () => {
    const r = validateCombo({
      ...base,
      validFrom: new Date("2026-07-10T00:00:00Z"),
      validTo: new Date("2026-07-01T00:00:00Z"),
    });
    expect(r).toEqual({ ok: false, error: "La fecha de fin no puede ser anterior a la de inicio." });
  });

  it("acepta una sola fecha (from o to) sin error", () => {
    expect(validateCombo({ ...base, validFrom: new Date("2026-07-01T00:00:00Z"), validTo: null }).ok).toBe(true);
    expect(validateCombo({ ...base, validFrom: null, validTo: new Date("2026-07-01T00:00:00Z") }).ok).toBe(true);
  });
});
