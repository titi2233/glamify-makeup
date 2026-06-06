"use server";

import { prisma } from "@/lib/prisma";
import { getCartIdFromCookie, setCartIdCookie } from "@/lib/cart/cart-cookie";
import { createCart } from "@/lib/cart/cart-service";
import type { ActionResult } from "@/lib/forms/action-result";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ExitIntentResult extends ActionResult {
  couponCode?: string | null;
}

/**
 * Exit-intent: guarda el email + consentimiento en el carrito activo (alimenta el recupero de
 * carrito abandonado de M4) y devuelve el cupón de bienvenida configurado (blueprint 06 §8).
 */
export async function captureExitIntentAction(input: { email: string }): Promise<ExitIntentResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Ingresá un email válido." };

  let cartId = await getCartIdFromCookie();
  const existing = cartId
    ? await prisma.cart.findUnique({ where: { id: cartId }, select: { id: true, status: true } })
    : null;
  if (!existing || existing.status !== "active") {
    cartId = await createCart();
    await setCartIdCookie(cartId);
  }

  await prisma.cart.update({
    where: { id: cartId! },
    data: { contactEmail: email, recoveryEmailConsent: true },
  });

  const couponCode = process.env.NEXT_PUBLIC_WELCOME_COUPON_CODE?.trim() || null;
  return { ok: true, couponCode };
}
