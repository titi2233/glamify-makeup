"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { requestRetractionAction } from "./actions";

export function RetractionForm() {
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await requestRetractionAction({
      contactName: String(fd.get("contactName") ?? ""),
      contactEmail: String(fd.get("contactEmail") ?? ""),
      contactPhone: String(fd.get("contactPhone") ?? ""),
      orderNumber: String(fd.get("orderNumber") ?? ""),
      reason: String(fd.get("reason") ?? ""),
      website: String(fd.get("website") ?? ""),
    });
    setPending(false);
    if (res.ok) {
      setTicket(res.ticket ?? "—");
      setDate(res.date ?? null);
    } else setError(res.error ?? "No se pudo procesar la solicitud.");
  }

  if (ticket) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-surface-alt p-4">
        <p className="font-semibold text-foreground">Recibimos tu solicitud de arrepentimiento.</p>
        <p className="mt-1 text-sm text-foreground/90">
          Tu número de constancia es <strong>{ticket}</strong>
          {date ? <> del {date}</> : null}. Te enviamos una copia por email y te vamos a contactar para coordinar la
          devolución y el reintegro.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border p-4">
      <div className="space-y-1">
        <Label htmlFor="contactName">Nombre y apellido</Label>
        <Input id="contactName" name="contactName" required minLength={2} maxLength={80} autoComplete="name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="contactEmail">Email</Label>
        <Input id="contactEmail" name="contactEmail" type="email" required autoComplete="email" inputMode="email" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="contactPhone">Teléfono (opcional)</Label>
        <Input id="contactPhone" name="contactPhone" type="tel" maxLength={40} autoComplete="tel" inputMode="tel" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="orderNumber">Número de pedido (opcional)</Label>
        <Input id="orderNumber" name="orderNumber" maxLength={40} placeholder="GLM-000123" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reason">Motivo (opcional)</Label>
        <Textarea id="reason" name="reason" maxLength={1000} rows={3} />
      </div>
      {/* Honeypot anti-spam: oculto para humanos, los bots tienden a completarlo. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
