"use server";

import { revalidatePath } from "next/cache";
import {
  loadCart, loadCurrentCart, createCart, addItem, updateItem, removeItem, cartToCheckoutLines,
} from "@/lib/cart/cart-service";
import { getCartIdFromCookie, setCartIdCookie, getCouponCodeFromCookie, setCouponCodeCookie } from "@/lib/cart/cart-cookie";
import { cartSubtotal } from "@/lib/cart/totals";
import { validateCoupon, applyCoupon } from "@/lib/coupons/apply";
import { toNumber } from "@/lib/catalog/pricing";
import { prisma } from "@/lib/prisma";
import { quoteShipping } from "@/lib/shipping/index";
import { getShippingZonesForQuote, getFreeShippingThreshold } from "@/lib/orders/checkout-data";
import { createCheckout, defaultCheckoutDeps } from "@/lib/orders/checkout-service";
import { getCustomer } from "@/lib/customer/auth";
import type { ActionResult } from "@/lib/forms/action-result";

export type { ActionResult };

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function ensureCartId(): Promise<string> {
  const existing = await getCartIdFromCookie();
  if (existing) {
    const cart = await prisma.cart.findUnique({ where: { id: existing }, select: { id: true, status: true } });
    if (cart && cart.status === "active") return existing;
  }
  const id = await createCart();
  await setCartIdCookie(id);
  return id;
}

export async function addToCartAction(input: { variantId?: string; comboId?: string; qty?: number }): Promise<ActionResult> {
  try {
    const cartId = await ensureCartId();
    await addItem({ cartId, variantId: input.variantId, comboId: input.comboId, qty: input.qty ?? 1 });
    revalidatePath("/", "layout");
    revalidatePath("/carrito");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo agregar al carrito." };
  }
}

export async function updateCartItemAction(itemId: string, qty: number): Promise<ActionResult> {
  try {
    const cartId = await getCartIdFromCookie();
    if (!cartId) return { ok: false, error: "No hay un carrito activo." };
    await updateItem(cartId, itemId, qty);
    revalidatePath("/", "layout");
    revalidatePath("/carrito");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo actualizar el carrito." };
  }
}

export async function removeCartItemAction(itemId: string): Promise<ActionResult> {
  try {
    const cartId = await getCartIdFromCookie();
    if (!cartId) return { ok: false, error: "No hay un carrito activo." };
    await removeItem(cartId, itemId);
    revalidatePath("/", "layout");
    revalidatePath("/carrito");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo quitar del carrito." };
  }
}

export async function applyCouponAction(code: string): Promise<ActionResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Ingresá un código." };
  const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon) return { ok: false, error: "Cupón inexistente." };
  const cartId = await getCartIdFromCookie();
  const { lines } = await loadCart(cartId);
  const subtotal = cartSubtotal(lines);
  const customer = await getCustomer();
  let customerRedemptions = 0;
  if (customer && coupon.perCustomerLimit != null) {
    const r = await prisma.couponRedemption.findUnique({
      where: { customerId_couponId: { customerId: customer.id, couponId: coupon.id } },
    });
    customerRedemptions = r?.redeemedCount ?? 0;
  }
  const validatable = { ...coupon, minSubtotal: coupon.minSubtotal != null ? toNumber(coupon.minSubtotal) : null };
  const v = validateCoupon(validatable, { subtotal, now: new Date(), customerRedemptions });
  if (!v.ok) return { ok: false, error: v.reason };
  // No "aplicar" un cupón con scope a producto/categoría que no rinde descuento sobre este carrito.
  const applicable = { ...coupon, value: toNumber(coupon.value) };
  const effect = applyCoupon(applicable, lines);
  if (effect.discount === 0 && !effect.freeShipping) {
    return { ok: false, error: "El cupón no aplica a los productos de tu carrito." };
  }
  await setCouponCodeCookie(normalized);
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  return { ok: true };
}

export async function removeCouponAction(): Promise<ActionResult> {
  await setCouponCodeCookie(null);
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  return { ok: true };
}

export interface QuoteResult extends ActionResult {
  cost?: number;
  free?: boolean;
  source?: string;
}
export async function quoteShippingAction(input: { cp: string; province?: string; city?: string; method: "domicilio" | "sucursal" }): Promise<QuoteResult> {
  if (!/^\d{4}$/.test(input.cp)) return { ok: false, error: "CP inválido (4 dígitos)." };
  const cartId = await getCartIdFromCookie();
  const { lines } = await loadCart(cartId);
  if (lines.length === 0) return { ok: false, error: "El carrito está vacío." };
  const subtotal = cartSubtotal(lines);
  const quote = await quoteShipping(
    { cp: input.cp, province: input.province ?? null, city: input.city ?? null, method: input.method, lines, subtotal },
    { getZones: getShippingZonesForQuote, getThreshold: getFreeShippingThreshold },
  );
  return { ok: true, cost: quote.cost, free: quote.free, source: quote.source };
}

export interface CheckoutResult extends ActionResult {
  initPoint?: string;
  orderNumber?: string;
}
export async function createCheckoutAction(input: {
  contactName: string; contactEmail: string; contactPhone: string;
  shippingMethod: "domicilio" | "sucursal";
  address: { cp: string; province?: string; street?: string; number?: string; floorApt?: string; city?: string; notes?: string };
}): Promise<CheckoutResult> {
  try {
    const { cart, cartId } = await loadCurrentCart();
    if (!cart || cart.items.length === 0) return { ok: false, error: "Tu carrito está vacío." };
    const lines = cartToCheckoutLines(cart);
    const couponCode = await getCouponCodeFromCookie();
    // Asociar el pedido a la clienta logueada (historial en /cuenta/pedidos + límite de cupón por clienta).
    const customer = await getCustomer();
    const result = await createCheckout(
      {
        contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone,
        shippingMethod: input.shippingMethod, address: input.address, lines, couponCode, cartId,
        customerId: customer?.id ?? null,
      },
      defaultCheckoutDeps(appUrl()),
    );
    return { ok: true, initPoint: result.initPoint, orderNumber: result.orderNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo iniciar el pago." };
  }
}
