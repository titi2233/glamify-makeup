import "server-only";
import { cache } from "react";
import { loadCurrentCart, type CartWithItems } from "@/lib/cart/cart-service";
import { cartSubtotal, cartItemCount } from "@/lib/cart/totals";
import { getCouponCodeFromCookie } from "@/lib/cart/cart-cookie";
import { getFreeShippingThreshold } from "@/lib/orders/checkout-data";
import { prisma } from "@/lib/prisma";
import { validateCoupon, applyCoupon } from "@/lib/coupons/apply";
import type { CartLine } from "@/lib/cart/types";

export interface CartCouponPreview {
  code: string;
  discount: number;
  freeShipping: boolean;
}
export interface CartView {
  cart: CartWithItems | null;
  lines: CartLine[];
  count: number;
  subtotal: number;
  threshold: number;
  coupon: CartCouponPreview | null;
}

/** Vista del carrito de la sesión (deduplicada por request con React cache). */
export const getCartView = cache(async (): Promise<CartView> => {
  const { cart, lines } = await loadCurrentCart();
  const subtotal = cartSubtotal(lines);
  const threshold = await getFreeShippingThreshold();

  let coupon: CartCouponPreview | null = null;
  const code = await getCouponCodeFromCookie();
  if (code && lines.length > 0) {
    const row = await prisma.coupon.findUnique({ where: { code } });
    if (row) {
      // Coerce Prisma Decimal fields to number/string for validateCoupon + applyCoupon
      // (same pattern as actions.ts — fixes Decimal vs number | string mismatch at call site)
      const plain = {
        ...row,
        value: Number(row.value),
        minSubtotal: row.minSubtotal != null ? Number(row.minSubtotal) : null,
      };
      if (validateCoupon(plain, { subtotal, now: new Date() }).ok) {
        const res = applyCoupon(plain, lines);
        coupon = { code, discount: res.discount, freeShipping: res.freeShipping };
      }
    }
  }
  return { cart, lines, count: cartItemCount(lines), subtotal, threshold, coupon };
});
