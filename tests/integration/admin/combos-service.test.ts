import { describe, it, expect, vi } from "vitest";
import {
  createCombo,
  updateCombo,
  deleteCombo,
  type ComboDb,
  type CreateComboDeps,
} from "@/lib/admin/combos/service";
import type { ComboClean } from "@/lib/admin/combos/validation";

const clean = (over: Partial<ComboClean> = {}): ComboClean => ({
  name: "Combo Glow",
  slug: "combo-glow",
  description: "dos labiales",
  comboPrice: 4999.5,
  images: ["combos/glow.webp"],
  active: true,
  validFrom: null,
  validTo: null,
  items: [
    { variantId: "v1", qty: 2 },
    { variantId: "v2", qty: 1 },
  ],
  ...over,
});

function makeTx() {
  return {
    combo: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cmb-1", ...data })),
      update: vi.fn(async () => ({ id: "cmb-9" })),
    },
    comboItem: {
      deleteMany: vi.fn(async () => ({ count: 2 })),
      createMany: vi.fn(async () => ({ count: 2 })),
    },
  };
}

type FakeTx = ReturnType<typeof makeTx>;

function makeDeps(over: { existingSlug?: { id: string } | null } = {}): { deps: CreateComboDeps; tx: FakeTx; db: ComboDb } {
  const tx = makeTx();
  const db: ComboDb = {
    combo: {
      findUnique: vi.fn(async ({ where }: { where: { slug?: string; id?: string } }) =>
        where.slug !== undefined ? (over.existingSlug ?? null) : null,
      ),
      delete: vi.fn(async () => ({ id: "cmb-9" })),
    },
    $transaction: vi.fn(async (fn: (tx: FakeTx) => Promise<unknown>) => fn(tx)),
  } as unknown as ComboDb;
  return { deps: { db }, tx, db };
}

describe("createCombo", () => {
  it("crea el combo con sus items en una tx", async () => {
    const { deps, tx } = makeDeps();
    const r = await createCombo(clean(), deps);
    expect(r.id).toBe("cmb-1");
    const callArg = tx.combo.create.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined;
    const data = callArg?.data ?? {};
    expect(data).toMatchObject({
      slug: "combo-glow",
      name: "Combo Glow",
      comboPrice: 4999.5,
      active: true,
    });
    const items = data["items"] as { create: unknown[] } | undefined;
    expect(items?.create).toEqual([
      { variantId: "v1", qty: 2 },
      { variantId: "v2", qty: 1 },
    ]);
  });

  it("rechaza slug duplicado antes de crear", async () => {
    const { deps, tx } = makeDeps({ existingSlug: { id: "otro" } });
    await expect(createCombo(clean(), deps)).rejects.toThrow("Ya existe un combo con ese slug.");
    expect(tx.combo.create).not.toHaveBeenCalled();
  });
});

describe("updateCombo", () => {
  it("reemplaza los items (deleteMany + createMany) y actualiza campos", async () => {
    const { deps, tx } = makeDeps();
    const r = await updateCombo("cmb-9", clean({ comboPrice: 5200 }), deps);
    expect(r.id).toBe("cmb-9");
    expect(tx.comboItem.deleteMany).toHaveBeenCalledWith({ where: { comboId: "cmb-9" } });
    expect(tx.comboItem.createMany).toHaveBeenCalledWith({
      data: [
        { comboId: "cmb-9", variantId: "v1", qty: 2 },
        { comboId: "cmb-9", variantId: "v2", qty: 1 },
      ],
    });
    type UpdateCall = { where: { id: string }; data: Record<string, unknown> };
    const updateCallArg = (tx.combo.update.mock.calls as unknown as UpdateCall[][])[0]?.[0];
    expect(updateCallArg?.data).toMatchObject({ comboPrice: 5200, slug: "combo-glow" });
    expect(updateCallArg?.where).toEqual({ id: "cmb-9" });
  });

  it("rechaza si el slug ya pertenece a otro combo", async () => {
    const { deps } = makeDeps({ existingSlug: { id: "otro" } });
    await expect(updateCombo("cmb-9", clean(), deps)).rejects.toThrow("Ya existe un combo con ese slug.");
  });

  it("permite el mismo slug si pertenece al combo que se edita", async () => {
    const { deps, tx } = makeDeps({ existingSlug: { id: "cmb-9" } });
    const r = await updateCombo("cmb-9", clean(), deps);
    expect(r.id).toBe("cmb-9");
    expect(tx.combo.update).toHaveBeenCalled();
  });
});

describe("deleteCombo", () => {
  it("borra el combo por id (los items caen por cascade)", async () => {
    const { deps, db } = makeDeps();
    await deleteCombo("cmb-9", deps);
    expect(db.combo.delete).toHaveBeenCalledWith({ where: { id: "cmb-9" } });
  });
});
