import { round2 } from "@/lib/money";
import { lineTotal } from "@/lib/cart/totals";
import type { CartLine } from "@/lib/cart/types";

/** Subconjunto de Coupon necesario para validar (compatible con el modelo Prisma). */
export interface ValidatableCoupon {
  active: boolean;
  minSubtotal: number | string | null;
  validFrom: Date | null;
  validTo: Date | null;
  maxUses: number | null;
  usedCount: number;
}
export interface CouponContext {
  subtotal: number;
  now: Date;
}
export type CouponValidation = { ok: true } | { ok: false; reason: string };

export function validateCoupon(coupon: ValidatableCoupon, ctx: CouponContext): CouponValidation {
  if (!coupon.active) return { ok: false, reason: "El cupón no está activo." };
  if (coupon.validFrom && ctx.now < coupon.validFrom) return { ok: false, reason: "El cupón todavía no es válido." };
  if (coupon.validTo && ctx.now > coupon.validTo) return { ok: false, reason: "El cupón está vencido." };
  if (coupon.minSubtotal != null && ctx.subtotal < Number(coupon.minSubtotal)) {
    return { ok: false, reason: "No alcanzás el mínimo para este cupón." };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: "El cupón alcanzó su límite de usos." };
  }
  return { ok: true };
}

/** Subconjunto de Coupon necesario para aplicar el descuento. */
export interface ApplicableCoupon {
  type: "percentage" | "fixed" | "free_shipping";
  value: number | string;
  scope: "all" | "category" | "product";
  scopeId: string | null;
}
export interface CouponResult {
  discount: number;
  freeShipping: boolean;
}

function matchesScope(line: CartLine, scope: ApplicableCoupon["scope"], scopeId: string | null): boolean {
  if (scope === "all") return true;
  if (line.kind === "combo") return false; // combos solo aplican a scope=all
  if (scope === "category") return line.categoryId === scopeId;
  if (scope === "product") return line.productId === scopeId;
  return false;
}

export function applyCoupon(coupon: ApplicableCoupon, lines: CartLine[]): CouponResult {
  if (coupon.type === "free_shipping") return { discount: 0, freeShipping: true };

  const applicable = lines.filter((l) => matchesScope(l, coupon.scope, coupon.scopeId));
  const base = round2(applicable.reduce((acc, l) => acc + lineTotal(l), 0));
  if (base <= 0) return { discount: 0, freeShipping: false };

  const value = Number(coupon.value);
  const raw = coupon.type === "percentage" ? base * (value / 100) : value;
  const discount = round2(Math.min(Math.max(raw, 0), base));
  return { discount, freeShipping: false };
}
