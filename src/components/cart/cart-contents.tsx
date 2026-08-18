import Link from "next/link";
import { getCartView } from "@/lib/cart/cart-view";
import { round2 } from "@/lib/money";
import { productImageUrl } from "@/lib/images";
import { CouponInput } from "@/components/cart/coupon-input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { FreeShippingBar } from "@/components/cart/free-shipping-bar";
import { CartSummary } from "@/components/cart/cart-summary";
import { EmptyCart } from "@/components/cart/empty-cart";
import { OrderBump } from "@/components/cart/order-bump";
import { getOrderBumpOffers } from "@/lib/catalog/recommendations";
import { selectOrderBump } from "@/lib/catalog/recommend";

/** Contenido del carrito para el drawer (server component, se refresca con router.refresh). */
export async function CartContents() {
  const { cart, subtotal, count, threshold, coupon } = await getCartView();
  if (!cart || count === 0) return <EmptyCart />;

  const discount = coupon?.discount ?? 0;
  const total = round2(subtotal - discount);

  const cartVariantIds = cart.items.map((i) => i.variantId).filter((v): v is string => Boolean(v));
  const bump = selectOrderBump(await getOrderBumpOffers(), cartVariantIds);

  return (
    <div className="flex h-full flex-col gap-4">
      <FreeShippingBar subtotal={subtotal} threshold={threshold} />
      <div className="flex-1 divide-y divide-border">
        {cart.items.map((item) => (
          <CartLineItem
            key={item.id}
            item={{
              id: item.id,
              name: item.combo ? item.combo.name : item.variant!.product.name,
              variantName: item.combo ? null : item.variant!.name,
              unitPrice: Number(item.unitPriceSnapshot),
              qty: item.qty,
              image: productImageUrl(item.combo ? item.combo.images[0] ?? null : item.variant!.image ?? item.variant!.product.images[0] ?? null),
            }}
          />
        ))}
      </div>
      {bump && <OrderBump offer={bump} />}
      <Separator />
      <CouponInput applied={coupon?.code ?? null} />
      <CartSummary subtotal={subtotal} discount={discount} shippingCost={null} total={total} freeShipping={coupon?.freeShipping} />
      
      <div className="grid gap-2 pt-2">
        <Button asChild size="lg" className="w-full rounded-2xl bg-[#161413] text-white hover:bg-neutral-800 py-6 text-sm font-semibold shadow-soft hover:shadow-soft-lg transition-all">
          <Link href="/checkout">Iniciar Compra Segura</Link>
        </Button>
        <Button asChild variant="outline" className="w-full rounded-2xl border-border/80 text-xs font-semibold hover:bg-secondary">
          <Link href="/carrito">Ver Resumen Completo</Link>
        </Button>
      </div>

      <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-muted-foreground">
        <span>🔒 Pago 100% Protegido</span>
        <span>•</span>
        <span>✨ Garantía 30 Días</span>
      </div>
    </div>
  );
}
