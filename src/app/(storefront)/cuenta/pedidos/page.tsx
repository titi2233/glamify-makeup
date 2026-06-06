import Link from "next/link";
import { requireCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pago pendiente", paid: "Pagado", preparing: "Preparando",
  shipped: "Enviado", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reembolsado",
};

export default async function PedidosPage() {
  const customer = await requireCustomer();
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true, total: true, status: true, createdAt: true },
  });

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <p>Todavía no hiciste ningún pedido.</p>
        <Link href="/tienda" className="mt-3 inline-block text-primary underline">Ver la tienda</Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.orderNumber}>
          <Link href={`/cuenta/pedidos/${o.orderNumber}`} className="flex items-center justify-between rounded-2xl border border-border p-4 shadow-soft">
            <div>
              <p className="font-medium">{o.orderNumber}</p>
              <p className="text-xs text-muted-foreground">{o.createdAt.toLocaleDateString("es-AR")}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{STATUS_LABEL[o.status] ?? o.status}</Badge>
              <span className="tabular-nums font-semibold">{formatARS(Number(o.total))}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
