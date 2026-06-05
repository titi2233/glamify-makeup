import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { formatARS } from "@/lib/money";
import { toNumber } from "@/lib/catalog/pricing";
import { STATUS_LABELS } from "@/lib/admin/orders/service";
import { OrderStatusControl } from "../order-status-control";
import { ShipmentForm, type ShipmentDefaults } from "../shipment-form";
import type { ShipmentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  in_process: "En proceso",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

const ART_FMT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

interface AddressSnapshot {
  cp?: string;
  province?: string | null;
  street?: string;
  number?: string;
  floorApt?: string | null;
  city?: string;
  notes?: string | null;
}

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      shipment: true,
    },
  });
  if (!order) notFound();

  const addr = (order.shippingAddress ?? {}) as AddressSnapshot;
  const shipmentDefaults: ShipmentDefaults = {
    service: order.shipment?.service ?? "",
    trackingNumber: order.shipment?.trackingNumber ?? "",
    labelUrl: order.shipment?.labelUrl ?? "",
    cost: order.shipment ? toNumber(order.shipment.cost) : toNumber(order.shippingCost),
    status: (order.shipment?.status ?? "pending") as ShipmentStatus,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pedido ${order.orderNumber}`}
        subtitle="Mirá el detalle, cambiá el estado del pedido y cargá el seguimiento del envío."
      />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Estado actual:</span>
        <Badge className="font-semibold">{STATUS_LABELS[order.status]}</Badge>
      </div>

      <section className="rounded-2xl border border-border p-5">
        <h2 className="mb-3 text-lg font-semibold">Cambiar estado</h2>
        <OrderStatusControl orderId={order.id} status={order.status} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border p-5">
          <h2 className="mb-3 text-lg font-semibold">Productos</h2>
          <ul className="divide-y divide-border">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{it.productNameSnapshot}</p>
                  {it.variantNameSnapshot ? (
                    <p className="text-sm text-muted-foreground">{it.variantNameSnapshot}</p>
                  ) : null}
                  {it.skuSnapshot ? (
                    <p className="text-xs text-muted-foreground">SKU {it.skuSnapshot}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    {it.qty} × {formatARS(toNumber(it.unitPriceSnapshot))}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums font-semibold">
                  {formatARS(toNumber(it.lineTotal))}
                </p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatARS(toNumber(order.subtotal))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Envío</dt>
              <dd className="tabular-nums">{formatARS(toNumber(order.shippingCost))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Descuento</dt>
              <dd className="tabular-nums">−{formatARS(toNumber(order.discountTotal))}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-1 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatARS(toNumber(order.total))}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border p-5">
            <h2 className="mb-3 text-lg font-semibold">Contacto</h2>
            <p className="font-medium">{order.contactName}</p>
            <p className="text-sm text-muted-foreground">{order.contactEmail}</p>
            <p className="text-sm text-muted-foreground">{order.contactPhone}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Recibido: {ART_FMT.format(order.createdAt)}
            </p>
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h2 className="mb-3 text-lg font-semibold">Entrega</h2>
            <p className="text-sm">
              Método:{" "}
              {order.shippingMethod === "domicilio"
                ? "Envío a domicilio"
                : "Retiro en sucursal"}
            </p>
            {order.shippingMethod === "domicilio" ? (
              <address className="mt-1 not-italic text-sm text-muted-foreground">
                {[addr.street, addr.number].filter(Boolean).join(" ")}
                {addr.floorApt ? `, ${addr.floorApt}` : ""}
                <br />
                {[addr.city, addr.province].filter(Boolean).join(", ")}{" "}
                {addr.cp ? `(CP ${addr.cp})` : ""}
                {addr.notes ? (
                  <>
                    <br />
                    Nota: {addr.notes}
                  </>
                ) : null}
              </address>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                CP de referencia: {addr.cp ?? "—"}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h2 className="mb-3 text-lg font-semibold">Pagos (Mercado Pago)</h2>
            {order.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay pagos registrados.
              </p>
            ) : (
              <ul className="space-y-2">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span>
                      {PAYMENT_LABELS[p.status] ?? p.status}
                      {p.mpPaymentId ? ` · #${p.mpPaymentId}` : ""}
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatARS(toNumber(p.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-border p-5">
        <h2 className="mb-3 text-lg font-semibold">Envío y seguimiento</h2>
        <ShipmentForm orderId={order.id} defaults={shipmentDefaults} />
      </section>
    </div>
  );
}
