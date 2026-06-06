import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { TrackOnMount } from "@/components/analytics/track-on-mount";

export const metadata: Metadata = { title: "¡Gracias por tu compra!" };

export default async function GraciasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const orderId = sp["external_reference"] ?? sp["external_reference[]"];
  const order = orderId ? await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } }) : null;

  const paid = order?.status === "paid" || order?.status === "preparing" || order?.status === "shipped" || order?.status === "delivered";

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      {paid && order && (
        <TrackOnMount event="purchase" props={{ orderNumber: order.orderNumber, total: Number(order.total) }} />
      )}
      {paid ? <CheckCircle2 className="mx-auto size-14 text-primary" /> : <Clock className="mx-auto size-14 text-muted-foreground" />}
      <h1 className="mt-4 font-display text-2xl font-bold">{paid ? "¡Gracias por tu compra! 💄" : "Estamos confirmando tu pago"}</h1>

      {order ? (
        <>
          <p className="mt-2 text-muted-foreground">
            Pedido <strong className="text-foreground">{order.orderNumber}</strong>
            {!paid && " — apenas se acredite te llega el email de confirmación."}
          </p>
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border p-5 text-left text-sm">
            <ul className="space-y-1">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{it.productNameSnapshot}{it.variantNameSnapshot ? ` — ${it.variantNameSnapshot}` : ""} × {it.qty}</span>
                  <span className="tabular-nums">{formatARS(Number(it.lineTotal))}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold">
              <span>Total</span><span className="tabular-nums">{formatARS(Number(order.total))}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-muted-foreground">Si completaste el pago, te enviaremos la confirmación por email.</p>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button asChild><Link href="/tienda">Seguir comprando</Link></Button>
        <a href="https://wa.me/5491100000000" className="text-sm text-primary hover:underline" target="_blank" rel="noopener noreferrer">
          ¿Dudas? Escribinos por WhatsApp
        </a>
      </div>
    </div>
  );
}
