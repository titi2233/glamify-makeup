"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { canTransition } from "@/lib/orders/state-machine";
import { changeOrderStatusAction, cancelOrderAction } from "./actions";
import type { OrderStatus } from "@prisma/client";

const NEXT_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Marcar pendiente de pago",
  paid: "Marcar como pagado",
  preparing: "Pasar a preparando",
  shipped: "Marcar como enviado",
  delivered: "Marcar como entregado",
  cancelled: "Cancelar pedido",
  refunded: "Marcar reembolsado",
};

const ALL: OrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Próximos estados válidos, excluyendo cancelled (tiene su propio flujo con confirmación).
  const nextStates = ALL.filter((s) => s !== "cancelled" && canTransition(status, s));
  const canCancel = canTransition(status, "cancelled");

  const change = (to: OrderStatus) => {
    setError(null);
    startTransition(async () => {
      const r = await changeOrderStatusAction(orderId, to);
      if (!r.ok) setError(r.error ?? "No se pudo cambiar el estado.");
      else router.refresh();
    });
  };

  const cancel = () => {
    setError(null);
    startTransition(async () => {
      const r = await cancelOrderAction(orderId);
      if (!r.ok) setError(r.error ?? "No se pudo cancelar.");
      else router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {nextStates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este pedido no tiene próximos estados disponibles.
          </p>
        ) : (
          nextStates.map((s) => (
            <Button key={s} type="button" onClick={() => change(s)} disabled={pending}>
              {NEXT_LABELS[s]}
            </Button>
          ))
        )}
        {canCancel ? (
          <ConfirmDialog
            title="¿Cancelar este pedido?"
            description="Si el pedido ya estaba pagado, se va a reponer el stock de los productos. Esta acción no se puede deshacer."
            confirmLabel="Sí, cancelar pedido"
            onConfirm={cancel}
            trigger={
              <Button type="button" variant="destructive" disabled={pending}>
                Cancelar pedido
              </Button>
            }
          />
        ) : null}
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
