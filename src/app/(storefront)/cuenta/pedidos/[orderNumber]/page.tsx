import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pago pendiente", paid: "Pagado", preparing: "Preparando",
  shipped: "Enviado", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reembolsado",
};

export default async function PedidoDetallePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const customer = await requireCustomer();
  const order = await prisma.order.findFirst({
    where: { orderNumber, customerId: customer.id },
    include: {
      items: { include: { variant: { include: { product: { select: { slug: true } } } } } },
      shipment: true,
    },
  });
  if (!order) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{order.orderNumber}</h2>
        <Badge variant="secondary">{STATUS_LABEL[order.status] ?? order.status}</Badge>
      </div>

      <ul className="space-y-2">
        {order.items.map((it) => {
          const slug = it.variant?.product.slug;
          const label = it.variantNameSnapshot ? `${it.productNameSnapshot} — ${it.variantNameSnapshot}` : it.productNameSnapshot;
          return (
            <li key={it.id} className="flex justify-between text-sm">
              <span>{slug ? <Link href={`/producto/${slug}`} className="underline">{label}</Link> : label} × {it.qty}</span>
              <span className="tabular-nums">{formatARS(Number(it.lineTotal))}</span>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatARS(Number(order.subtotal))}</span></div>
        {Number(order.discountTotal) > 0 && <div className="flex justify-between"><span>Descuento</span><span className="tabular-nums">-{formatARS(Number(order.discountTotal))}</span></div>}
        <div className="flex justify-between"><span>Envío</span><span className="tabular-nums">{formatARS(Number(order.shippingCost))}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{formatARS(Number(order.total))}</span></div>
      </div>

      {order.shipment?.trackingNumber && (
        <p className="text-sm text-muted-foreground">Seguimiento: <strong>{order.shipment.trackingNumber}</strong></p>
      )}
      <Link href="/cuenta/pedidos" className="inline-block text-sm text-primary underline">← Volver a mis pedidos</Link>
    </div>
  );
}
