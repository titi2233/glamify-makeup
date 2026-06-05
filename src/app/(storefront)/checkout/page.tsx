import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCartView } from "@/lib/cart/cart-view";
import { CheckoutForm } from "@/app/(storefront)/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout — Glamify Makeup" };

export default async function CheckoutPage() {
  const { cart, count, subtotal, coupon } = await getCartView();
  if (!cart || count === 0) redirect("/carrito");

  return (
    <div className="mx-auto max-w-4xl py-6">
      <h1 className="mb-6 font-display text-2xl font-bold">Finalizá tu compra</h1>
      <CheckoutForm
        subtotal={subtotal}
        discount={coupon?.discount ?? 0}
        couponCode={coupon?.code ?? null}
        couponFreeShipping={coupon?.freeShipping ?? false}
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
