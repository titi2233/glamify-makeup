import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCartView } from "@/lib/cart/cart-view";
import { getCustomer } from "@/lib/customer/auth";
import { CheckoutForm } from "@/app/(storefront)/checkout/checkout-form";
import { OrderBump } from "@/components/cart/order-bump";
import { getOrderBumpOffers } from "@/lib/catalog/recommendations";
import { selectOrderBump } from "@/lib/catalog/recommend";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const { cart, count, subtotal, coupon } = await getCartView();
  if (!cart || count === 0) redirect("/carrito");

  const customer = await getCustomer();
  const cartVariantIds = cart.items.map((i) => i.variantId).filter((v): v is string => Boolean(v));
  const bump = selectOrderBump(await getOrderBumpOffers(), cartVariantIds);

  return (
    <div className="mx-auto max-w-4xl py-6">
      <h1 className="mb-6 font-display text-2xl font-bold">Finalizá tu compra</h1>
      {bump && <div className="mb-6"><OrderBump offer={bump} /></div>}
      <CheckoutForm
        subtotal={subtotal}
        discount={coupon?.discount ?? 0}
        couponCode={coupon?.code ?? null}
        couponFreeShipping={coupon?.freeShipping ?? false}
        defaultName={customer?.name ?? ""}
        defaultEmail={customer?.email ?? ""}
        items={cart.items.map((item) => ({
          id: item.id,
          name: item.combo ? item.combo.name : item.variant!.product.name,
          variantName: item.combo ? null : item.variant!.name,
          qty: item.qty,
          unitPrice: Number(item.unitPriceSnapshot),
        }))}
      />
    </div>
  );
}
