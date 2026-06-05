import { describe, it, expect, vi } from "vitest";
import {
  createCoupon, updateCoupon, deleteCoupon,
  type CreateCouponDeps, type CouponDb,
} from "@/lib/admin/coupons/service";
import type { CouponClean } from "@/lib/admin/coupons/validation";

const clean = (over: Partial<CouponClean> = {}): CouponClean => ({
  code: "GLAM10",
  type: "percentage",
  value: 10,
  scope: "all",
  scopeId: null,
  minSubtotal: null,
  maxUses: null,
  perCustomerLimit: null,
  validFrom: null,
  validTo: null,
  active: true,
  ...over,
});

function makeDeps(over: Partial<{ existing: { id: string } | null }> = {}): { deps: CreateCouponDeps; db: CouponDb } {
  const db = {
    coupon: {
      findUnique: vi.fn(async () => ("existing" in over ? over.existing ?? null : null)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cp-1", ...data })),
      update: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
    },
  } as unknown as CouponDb;
  return { deps: { db }, db };
}

describe("createCoupon", () => {
  it("crea el cupón cuando el código es único", async () => {
    const { deps, db } = makeDeps();
    const r = await createCoupon(clean(), deps);
    expect(r.id).toBe("cp-1");
    expect(db.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "GLAM10" } });
    const data = (db.coupon.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.code).toBe("GLAM10");
    expect(data.type).toBe("percentage");
    expect(data.value).toBe(10);
    expect(data.scopeId).toBeNull();
  });

  it("rechaza código duplicado", async () => {
    const { deps } = makeDeps({ existing: { id: "otro" } });
    await expect(createCoupon(clean(), deps)).rejects.toThrow(/código/i);
  });

  it("persiste opcionales (minSubtotal, maxUses, fechas)", async () => {
    const { deps, db } = makeDeps();
    await createCoupon(
      clean({ minSubtotal: 20000, maxUses: 100, validFrom: new Date("2026-06-01"), validTo: new Date("2026-07-01") }),
      deps,
    );
    const data = (db.coupon.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.minSubtotal).toBe(20000);
    expect(data.maxUses).toBe(100);
    expect(data.validFrom).toEqual(new Date("2026-06-01"));
    expect(data.validTo).toEqual(new Date("2026-07-01"));
  });
});

describe("updateCoupon", () => {
  it("actualiza cuando el código no choca con otro cupón", async () => {
    const { deps, db } = makeDeps({ existing: null });
    const r = await updateCoupon("cp-9", clean({ code: "GLAM20", value: 20 }), deps);
    expect(r.id).toBe("cp-9");
    const data = (db.coupon.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.code).toBe("GLAM20");
    expect(data.value).toBe(20);
  });

  it("permite mantener el mismo código si pertenece al mismo cupón", async () => {
    const { deps } = makeDeps({ existing: { id: "cp-9" } });
    const r = await updateCoupon("cp-9", clean({ code: "GLAM10" }), deps);
    expect(r.id).toBe("cp-9");
  });

  it("rechaza si el código pertenece a otro cupón", async () => {
    const { deps } = makeDeps({ existing: { id: "cp-otro" } });
    await expect(updateCoupon("cp-9", clean({ code: "GLAM10" }), deps)).rejects.toThrow(/código/i);
  });
});

describe("deleteCoupon", () => {
  it("borra el cupón por id", async () => {
    const { deps, db } = makeDeps();
    const r = await deleteCoupon("cp-3", deps);
    expect(r.id).toBe("cp-3");
    expect(db.coupon.delete).toHaveBeenCalledWith({ where: { id: "cp-3" } });
  });
});
