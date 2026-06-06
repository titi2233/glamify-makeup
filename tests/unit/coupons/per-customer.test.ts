import { describe, it, expect } from "vitest";
import { validateCoupon } from "@/lib/coupons/apply";

const base = { active: true, minSubtotal: null, validFrom: null, validTo: null, maxUses: null, usedCount: 0 };

describe("validateCoupon — perCustomerLimit", () => {
  it("rechaza si la clienta alcanzó su límite", () => {
    const res = validateCoupon({ ...base, perCustomerLimit: 1 }, { subtotal: 5000, now: new Date(), customerRedemptions: 1 });
    expect(res).toEqual({ ok: false, reason: "Ya usaste este cupón el máximo de veces." });
  });
  it("acepta por debajo del límite", () => {
    const res = validateCoupon({ ...base, perCustomerLimit: 2 }, { subtotal: 5000, now: new Date(), customerRedemptions: 1 });
    expect(res.ok).toBe(true);
  });
  it("sin perCustomerLimit ni redenciones → válido (invitada)", () => {
    const res = validateCoupon({ ...base }, { subtotal: 5000, now: new Date() });
    expect(res.ok).toBe(true);
  });
});
