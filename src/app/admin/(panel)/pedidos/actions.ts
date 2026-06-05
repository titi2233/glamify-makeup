"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { changeOrderStatus, cancelOrder, defaultOrdersDeps } from "@/lib/admin/orders/service";
import { upsertShipment, defaultShipmentsDeps } from "@/lib/admin/shipments/service";
import type { OrderStatus, ShipmentStatus, ShipmentCarrier } from "@prisma/client";

export async function changeOrderStatusAction(orderId: string, to: OrderStatus): Promise<AdminResult> {
  try {
    await requireAdmin();
    const r = await changeOrderStatus(orderId, to, defaultOrdersDeps());
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cambiar el estado del pedido." };
  }
}

export async function cancelOrderAction(orderId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    const r = await cancelOrder(orderId, defaultOrdersDeps());
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cancelar el pedido." };
  }
}

export interface ShipmentFormInput {
  service?: string;
  trackingNumber?: string;
  labelUrl?: string;
  cost: number;
  status: ShipmentStatus;
  carrier?: ShipmentCarrier;
}

export async function upsertShipmentAction(orderId: string, input: ShipmentFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const r = await upsertShipment(
      orderId,
      {
        service: input.service?.trim() ? input.service.trim() : null,
        trackingNumber: input.trackingNumber?.trim() ? input.trackingNumber.trim() : null,
        labelUrl: input.labelUrl?.trim() ? input.labelUrl.trim() : null,
        cost: input.cost,
        status: input.status,
        carrier: input.carrier,
      },
      defaultShipmentsDeps(),
    );
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el envío." };
  }
}
