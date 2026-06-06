import type { Metadata } from "next";
import { getCartView } from "@/lib/cart/cart-view";
import { round2 } from "@/lib/money";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { FreeShippingBar } from "@/components/cart/free-shipping-bar";
import { CouponInput } from "@/components/cart/coupon-input";
import { CartSummary } from "@/components/cart/cart-summary";
import { EmptyCart } from "@/components/cart/empty-cart";
import { OrderBump } from "@/components/cart/order-bump";
import { CrossSell } from "@/components/catalog/cross-sell";
import { getOrderBumpOffers, getCartCrossSell } from "@/lib/catalog/recommendations";
import { selectOrderBump } from "@/lib/catalog/recommend";

export const metadata: Metadata = { title: "Tu carrito" };

export default async function CarritoPage() {
  const { cart, subtotal, count, threshold, coupon } = await getCartView();

  if (!cart || count === 0) {
    return (
      <div className="mx-auto max-w-md py-8">
        <h1 className="mb-6 font-display text-2xl font-bold">Tu carrito</h1>
        <EmptyCart />
      </div>
    );
  }

  const discount = coupon?.discount ?? 0;
  const total = round2(subtotal - discount);

  const cartVariantIds = cart.items.map((i) => i.variantId).filter((v): v is string => Boolean(v));
  const cartCategoryIds = [...new Set(cart.items.map((i) => i.variant?.product.categoryId).filter((v): v is string => Boolean(v)))];
  const cartProductIds = cart.items.map((i) => i.variant?.product.id).filter((v): v is string => Boolean(v));
  const [bump, related] = await Promise.all([
    getOrderBumpOffers().then((offers) => selectOrderBump(offers, cartVariantIds)),
    getCartCrossSell(cartCategoryIds, cartProductIds, 4),
  ]);

  return (
    <div className="mx-auto max-w-4xl py-6">
      <h1 className="mb-6 font-display text-2xl font-bold">Tu carrito ({count})</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <FreeShippingBar subtotal={subtotal} threshold={threshold} />
          <div className="divide-y divide-border rounded-2xl border border-border px-4">
            {cart.items.map((item) => (
              <CartLineItem
                key={item.id}
                item={{
                  id: item.id,
                  name: item.combo ? item.combo.name : item.variant!.product.name,
                  variantName: item.combo ? null : item.variant!.name,
                  unitPrice: Number(item.unitPriceSnapshot),
                  qty: item.qty,
                  image: item.combo ? item.combo.images[0] ?? null : item.variant!.image ?? item.variant!.product.images[0] ?? null,
                }}
              />
            ))}
          </div>
        </div>
        <aside className="space-y-4 rounded-2xl border border-border p-5 lg:sticky lg:top-20 lg:self-start">
          {bump && <OrderBump offer={bump} />}
          <CouponInput applied={coupon?.code ?? null} />
          <Separator />
          <CartSummary subtotal={subtotal} discount={discount} shippingCost={null} total={total} freeShipping={coupon?.freeShipping} />
          <p className="text-xs text-muted-foreground">El envío se calcula en el checkout según tu código postal.</p>
          <Button asChild size="lg" className="w-full"><Link href="/checkout">Iniciar compra</Link></Button>
        </aside>
      </div>
      <div className="mt-10">
        <CrossSell products={related} />
      </div>
    </div>
  );
}
