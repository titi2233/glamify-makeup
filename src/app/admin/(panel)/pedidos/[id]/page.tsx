import { notFound } from "next/navigation";
import {
  ShoppingCart,
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
  Receipt,
  User,
  MapPin,
  CreditCard,
  Truck,
  Clock,
  CircleDollarSign,
  PackageOpen,
  PackageCheck,
  XCircle,
  RotateCcw,
  CircleCheck,
  CircleX,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatARS } from "@/lib/money";
import { toNumber } from "@/lib/catalog/pricing";
import { STATUS_LABELS } from "@/lib/admin/orders/service";
import { OrderStatusControl } from "../order-status-control";
import { ShipmentForm, type ShipmentDefaults } from "../shipment-form";
import { MicorreoPanel } from "../micorreo-panel";
import type { OrderStatus, ShipmentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  in_process: "En proceso",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

/** Presentación a11y de cada estado de pago: variante de Badge + ícono lucide. */
const PAYMENT_PRESENTATION: Record<string, { variant: BadgeProps["variant"]; icon: LucideIcon }> = {
  pending: { variant: "warning", icon: Clock },
  approved: { variant: "success", icon: CircleCheck },
  rejected: { variant: "destructive", icon: CircleX },
  in_process: { variant: "secondary", icon: Clock },
  refunded: { variant: "muted", icon: RotateCcw },
  cancelled: { variant: "destructive", icon: XCircle },
};

/** Presentación a11y del estado del pedido (color + ícono, nunca solo color). */
const ORDER_PRESENTATION: Record<OrderStatus, { variant: BadgeProps["variant"]; icon: LucideIcon }> = {
  pending_payment: { variant: "warning", icon: Clock },
  paid: { variant: "success", icon: CircleDollarSign },
  preparing: { variant: "secondary", icon: PackageOpen },
  shipped: { variant: "default", icon: Truck },
  delivered: { variant: "success", icon: PackageCheck },
  cancelled: { variant: "destructive", icon: XCircle },
  refunded: { variant: "muted", icon: RotateCcw },
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
  agencyCode?: string | null;
  agencyLabel?: string | null;
}

/** Cabecera de card-sección: medallón chico + título serif + ayuda opcional. */
function SectionHead({
  icon: Icon,
  title,
  help,
}: {
  icon: LucideIcon;
  title: string;
  help?: string;
}) {
  return (
    <header className="border-b border-border/70 bg-surface-alt/60 px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <Icon className="size-[18px]" />
        </span>
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {help ? <p className="mt-1 pl-[2.625rem] text-xs text-muted-foreground">{help}</p> : null}
    </header>
  );
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

  const statusPres = ORDER_PRESENTATION[order.status];
  const StatusIcon = statusPres.icon;

  // Panel de instrucciones MiCorreo: sólo tiene sentido una vez pagado el pedido.
  const showMicorreo = ["paid", "preparing", "shipped", "delivered"].includes(order.status);
  const isSucursal = order.shippingMethod === "sucursal";
  const destino = isSucursal
    ? addr.agencyLabel ?? (addr.agencyCode ? `Sucursal ${addr.agencyCode}` : "Sucursal (no guardada)")
    : [
        [addr.street, addr.number].filter(Boolean).join(" "),
        addr.floorApt,
        [addr.city, addr.province].filter(Boolean).join(", "),
        addr.cp ? `CP ${addr.cp}` : null,
      ]
        .filter(Boolean)
        .join(", ");

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={ShoppingCart}
        title={`Pedido ${order.orderNumber}`}
        subtitle="Mirá el detalle, cambiá el estado del pedido y cargá el seguimiento del envío."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/pedidos">
              <ArrowLeft className="size-4" aria-hidden /> Volver a pedidos
            </Link>
          </Button>
        }
      />

      {/* Estado actual + cambio de estado */}
      <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
        <SectionHead
          icon={RefreshCw}
          title="Estado del pedido"
          help="El próximo paso depende del estado actual. Una acción a la vez."
        />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Estado actual:</span>
            <Badge variant={statusPres.variant} className="gap-1">
              <StatusIcon className="size-3" aria-hidden />
              {STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <OrderStatusControl orderId={order.id} status={order.status} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Productos + totales */}
        <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
          <SectionHead icon={ShoppingBag} title="Productos" />
          <div className="p-5">
            <ul className="divide-y divide-border/70">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{it.productNameSnapshot}</p>
                    {it.variantNameSnapshot ? (
                      <p className="text-sm text-muted-foreground">{it.variantNameSnapshot}</p>
                    ) : null}
                    {it.skuSnapshot ? (
                      <p className="text-xs text-muted-foreground tabular-nums">SKU {it.skuSnapshot}</p>
                    ) : null}
                    <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                      {it.qty} × {formatARS(toNumber(it.unitPriceSnapshot))}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">
                    {formatARS(toNumber(it.lineTotal))}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1.5 rounded-xl bg-surface-alt/60 p-4 text-sm">
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
              <div className="mt-1 flex items-center justify-between border-t border-border/70 pt-2 text-base font-semibold text-foreground">
                <dt className="flex items-center gap-1.5">
                  <Receipt className="size-4 text-primary" aria-hidden /> Total
                </dt>
                <dd className="tabular-nums">{formatARS(toNumber(order.total))}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="space-y-6">
          {/* Contacto */}
          <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
            <SectionHead icon={User} title="Cliente" />
            <div className="space-y-1 p-5">
              <p className="font-medium text-foreground">{order.contactName}</p>
              <p className="text-sm text-muted-foreground">{order.contactEmail}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{order.contactPhone}</p>
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                Recibido: {ART_FMT.format(order.createdAt)}
              </p>
            </div>
          </section>

          {/* Entrega */}
          <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
            <SectionHead icon={MapPin} title="Entrega" />
            <div className="p-5">
              <p className="text-sm text-foreground">
                Método:{" "}
                <span className="font-medium">
                  {order.shippingMethod === "domicilio"
                    ? "Envío a domicilio"
                    : "Retiro en sucursal"}
                </span>
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
            </div>
          </section>

          {/* Pagos */}
          <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
            <SectionHead icon={CreditCard} title="Pagos (Mercado Pago)" />
            <div className="p-5">
              {order.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay pagos registrados.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {order.payments.map((p) => {
                    const pres = PAYMENT_PRESENTATION[p.status] ?? {
                      variant: "muted" as const,
                      icon: Clock,
                    };
                    const PayIcon = pres.icon;
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <Badge variant={pres.variant} className="gap-1">
                            <PayIcon className="size-3" aria-hidden />
                            {PAYMENT_LABELS[p.status] ?? p.status}
                          </Badge>
                          {p.mpPaymentId ? (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              #{p.mpPaymentId}
                            </span>
                          ) : null}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatARS(toNumber(p.amount))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Instrucciones MiCorreo (qué hacer con este pedido) */}
      {showMicorreo ? (
        <MicorreoPanel
          orderId={order.id}
          orderNumber={order.orderNumber}
          imported={Boolean(order.shipment?.micorreoImportedAt)}
          trackingLoaded={Boolean(order.shipment?.trackingNumber)}
          recipientName={order.contactName}
          recipientPhone={order.contactPhone}
          destino={destino}
          metodoLabel={isSucursal ? "Sucursal" : "Dirección"}
          weightGr={order.weightGr}
          declaredValue={toNumber(order.subtotal)}
        />
      ) : null}

      {/* Envío y seguimiento */}
      <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
        <SectionHead
          icon={Truck}
          title="Envío y seguimiento"
          help="Cargá el servicio, el número de seguimiento y el estado del envío."
        />
        <div className="p-5">
          <ShipmentForm orderId={order.id} defaults={shipmentDefaults} />
        </div>
      </section>
    </div>
  );
}
