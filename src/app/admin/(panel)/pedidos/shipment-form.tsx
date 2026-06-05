"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { upsertShipmentAction } from "./actions";
import type { ShipmentStatus } from "@prisma/client";

const SHIPMENT_STATES: Array<{ value: ShipmentStatus; label: string }> = [
  { value: "pending", label: "Pendiente" },
  { value: "ready", label: "Listo para despachar" },
  { value: "dispatched", label: "Despachado" },
  { value: "in_transit", label: "En camino" },
  { value: "delivered", label: "Entregado" },
  { value: "returned", label: "Devuelto" },
];

export interface ShipmentDefaults {
  service: string;
  trackingNumber: string;
  labelUrl: string;
  cost: number;
  status: ShipmentStatus;
}

export function ShipmentForm({
  orderId,
  defaults,
}: {
  orderId: string;
  defaults: ShipmentDefaults;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    const fd = new FormData(e.currentTarget);
    const input = {
      service: String(fd.get("service") ?? ""),
      trackingNumber: String(fd.get("trackingNumber") ?? ""),
      labelUrl: String(fd.get("labelUrl") ?? ""),
      cost: Number(fd.get("cost") ?? 0),
      status: String(fd.get("status") ?? "pending") as ShipmentStatus,
    };
    startTransition(async () => {
      const r = await upsertShipmentAction(orderId, input);
      if (!r.ok) setError(r.error ?? "No se pudo guardar el envío.");
      else {
        setOk(true);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="service">Servicio</Label>
        <input
          id="service"
          name="service"
          defaultValue={defaults.service}
          placeholder="Clásico, Expreso…"
          className="h-11 rounded-xl border border-border px-4 text-base"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="trackingNumber">Número de seguimiento</Label>
        <input
          id="trackingNumber"
          name="trackingNumber"
          defaultValue={defaults.trackingNumber}
          placeholder="Ej: CA123456789AR"
          className="h-11 rounded-xl border border-border px-4 text-base"
        />
        <p className="text-xs text-muted-foreground">
          Al cargar el seguimiento, el pedido pasa a "Enviado".
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="labelUrl">Link de la etiqueta (opcional)</Label>
        <input
          id="labelUrl"
          name="labelUrl"
          type="url"
          defaultValue={defaults.labelUrl}
          placeholder="https://…"
          className="h-11 rounded-xl border border-border px-4 text-base"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cost">Costo del envío (ARS)</Label>
        <input
          id="cost"
          name="cost"
          type="number"
          min="0"
          step="0.01"
          defaultValue={defaults.cost}
          className="h-11 rounded-xl border border-border px-4 text-base tabular-nums"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="status">Estado del envío</Label>
        <select
          id="status"
          name="status"
          defaultValue={defaults.status}
          className="h-11 rounded-xl border border-border px-4 text-base"
        >
          {SHIPMENT_STATES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm font-medium text-emerald-700">Envío guardado.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar envío"}
      </Button>
    </form>
  );
}
