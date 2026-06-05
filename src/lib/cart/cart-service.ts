import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectivePrice, toNumber } from "@/lib/catalog/pricing";
import type { CartLine } from "@/lib/cart/types";

/** Include estándar para cargar un carrito con todo lo necesario para calcular líneas. */
export const CART_INCLUDE = {
  items: {
    include: {
      variant: { include: { product: { include: { category: true } } } },
      combo: { include: { items: { include: { variant: { include: { product: true } } } } } },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;
export type CartItemWithRefs = CartWithItems["items"][number];

/** Mapea un CartItem (con includes) a una CartLine pura para cálculos. */
export function cartItemToCartLine(item: CartItemWithRefs): CartLine {
  if (item.combo) {
    const components = item.combo.items.map((ci) => ({ variantId: ci.variantId, qty: ci.qty }));
    const weightGr = item.combo.items.reduce(
      (acc, ci) => acc + (ci.variant.weightGrOverride ?? ci.variant.product.weightGr) * ci.qty,
      0,
    );
    return {
      id: item.id, kind: "combo", refId: item.combo.id,
      unitPrice: toNumber(item.combo.comboPrice), qty: item.qty,
      weightGr, productId: null, categoryId: null, components,
    };
  }
  const v = item.variant!;
  return {
    id: item.id, kind: "variant", refId: v.id,
    unitPrice: getEffectivePrice(v.product, v), qty: item.qty,
    weightGr: v.weightGrOverride ?? v.product.weightGr,
    productId: v.product.id, categoryId: v.product.categoryId,
  };
}

export interface LoadedCart {
  cart: CartWithItems | null;
  lines: CartLine[];
}

/** Carga un carrito por id con sus líneas mapeadas. */
export async function loadCart(cartId: string | null): Promise<LoadedCart> {
  if (!cartId) return { cart: null, lines: [] };
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: CART_INCLUDE });
  if (!cart || cart.status !== "active") return { cart: null, lines: [] };
  return { cart, lines: cart.items.map(cartItemToCartLine) };
}

/** Crea un carrito activo y devuelve su id. */
export async function createCart(): Promise<string> {
  const cart = await prisma.cart.create({ data: { sessionId: crypto.randomUUID(), status: "active" } });
  return cart.id;
}

export interface AddItemInput {
  cartId: string;
  variantId?: string;
  comboId?: string;
  qty: number;
}

/** Agrega (o incrementa) una línea. Calcula el snapshot de precio en el server. */
export async function addItem(input: AddItemInput): Promise<void> {
  const qty = Math.max(1, Math.floor(input.qty));
  if (input.variantId) {
    const variant = await prisma.productVariant.findUnique({ where: { id: input.variantId }, include: { product: true } });
    if (!variant || !variant.active) throw new Error("Variante no disponible.");
    const unit = getEffectivePrice(variant.product, variant);
    const existing = await prisma.cartItem.findFirst({ where: { cartId: input.cartId, variantId: input.variantId } });
    if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: existing.qty + qty } });
    else await prisma.cartItem.create({ data: { cartId: input.cartId, variantId: input.variantId, qty, unitPriceSnapshot: unit } });
    return;
  }
  if (input.comboId) {
    const combo = await prisma.combo.findUnique({ where: { id: input.comboId } });
    if (!combo || !combo.active) throw new Error("Combo no disponible.");
    const existing = await prisma.cartItem.findFirst({ where: { cartId: input.cartId, comboId: input.comboId } });
    if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: existing.qty + qty } });
    else await prisma.cartItem.create({ data: { cartId: input.cartId, comboId: input.comboId, qty, unitPriceSnapshot: combo.comboPrice } });
    return;
  }
  throw new Error("addItem requiere variantId o comboId.");
}

/** Actualiza la cantidad de una línea (0 o menos → elimina). */
export async function updateItem(itemId: string, qty: number): Promise<void> {
  if (qty <= 0) { await removeItem(itemId); return; }
  await prisma.cartItem.update({ where: { id: itemId }, data: { qty: Math.floor(qty) } });
}

/** Elimina una línea. */
export async function removeItem(itemId: string): Promise<void> {
  await prisma.cartItem.delete({ where: { id: itemId } });
}

import type { CheckoutLineInput } from "@/lib/orders/checkout-service";

/** Mapea un carrito cargado a las líneas de checkout (con snapshots y título para MP). */
export function cartToCheckoutLines(cart: CartWithItems): CheckoutLineInput[] {
  return cart.items.map((item) => {
    const line = cartItemToCartLine(item);
    if (item.combo) {
      return { line, productNameSnapshot: item.combo.name, variantNameSnapshot: null, skuSnapshot: null, title: item.combo.name };
    }
    const v = item.variant!;
    return {
      line,
      productNameSnapshot: v.product.name,
      variantNameSnapshot: v.name,
      skuSnapshot: v.sku,
      title: `${v.product.name} — ${v.name}`,
    };
  });
}

/** Carga el carrito de la sesión actual (cookie) con sus líneas. */
export async function loadCurrentCart(): Promise<LoadedCart & { cartId: string | null }> {
  const { getCartIdFromCookie } = await import("@/lib/cart/cart-cookie");
  const cartId = await getCartIdFromCookie();
  const loaded = await loadCart(cartId);
  return { ...loaded, cartId: loaded.cart ? cartId : null };
}
