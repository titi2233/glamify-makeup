"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck, Save, AlertCircle, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { upsertShipmentAction } from "./actions";
import type { ShipmentStatus } from "@prisma/client";

const fieldClass =
  "h-11 rounded-xl border border-input bg-background px-3 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

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
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="service">Servicio</Label>
          <input
            id="service"
            name="service"
            defaultValue={defaults.service}
            placeholder="Clásico, Expreso…"
            className={fieldClass}
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
            className={`${fieldClass} tabular-nums`}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="trackingNumber">Número de seguimiento</Label>
        <input
          id="trackingNumber"
          name="trackingNumber"
          defaultValue={defaults.trackingNumber}
          placeholder="Ej: CA123456789AR"
          className={fieldClass}
        />
        <p className="text-xs text-muted-foreground">
          Al cargar el seguimiento, el pedido pasa a &quot;Enviado&quot;.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="labelUrl">Link de la etiqueta (opcional)</Label>
          <input
            id="labelUrl"
            name="labelUrl"
            type="url"
            defaultValue={defaults.labelUrl}
            placeholder="https://…"
            className={fieldClass}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Estado del envío</Label>
          <select
            id="status"
            name="status"
            defaultValue={defaults.status}
            className={fieldClass}
          >
            {SHIPMENT_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          Envío guardado.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Truck className="size-4 animate-pulse" aria-hidden />
            Guardando…
          </>
        ) : (
          <>
            <Save className="size-4" aria-hidden />
            Guardar envío
          </>
        )}
      </Button>
    </form>
  );
}
