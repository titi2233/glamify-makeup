"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PackageCheck,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryMicorreoImportAction } from "./actions";

const MICORREO_URL = "https://www.correoargentino.com.ar/MiCorreo/public/";

export interface MicorreoPanelProps {
  orderId: string;
  orderNumber: string;
  imported: boolean;
  /** true si el pedido ya tiene número de seguimiento (ya despachado). */
  trackingLoaded: boolean;
  recipientName: string;
  recipientPhone: string;
  /** Dirección formateada o "Sucursal XXXX" según el método. */
  destino: string;
  metodoLabel: string;
  weightGr: number;
  declaredValue: number;
}

/** Fila de dato copiable del bloque "datos del envío". */
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function MicorreoPanel(props: MicorreoPanelProps) {
  const { orderId, orderNumber, imported, trackingLoaded } = props;
  // "Resuelto" = ya se cargó en MiCorreo (flag) o ya está despachado (tiene tracking). En ambos
  // casos NO hay que reintentar: re-importar un envío ya despachado duplicaría el paquete.
  const handled = imported || trackingLoaded;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const datosTexto = [
    `Pedido: ${orderNumber}`,
    `Destinatario: ${props.recipientName}`,
    `Teléfono: ${props.recipientPhone}`,
    `${props.metodoLabel}: ${props.destino}`,
    `Peso: ${props.weightGr} g`,
    `Valor declarado: $${props.declaredValue.toLocaleString("es-AR")}`,
  ].join("\n");

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(datosTexto);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("No pude copiar. Copialos a mano.");
    }
  };

  const reintentar = () => {
    setError(null);
    startTransition(async () => {
      const r = await retryMicorreoImportAction(orderId);
      if (!r.ok) setError(r.error ?? "No se pudo cargar en MiCorreo.");
      else router.refresh();
    });
  };

  // Pasos que hace la dueña. Cambian según si ya está resuelto o no.
  const pasos = handled
    ? [
        "Entrá a MiCorreo con tu cuenta.",
        `En "Mis Envíos" buscá el pedido ${orderNumber} (ya está cargado).`,
        "Pagá el envío con tu saldo de MiCorreo.",
        "Imprimí el rótulo (etiqueta) y pegalo en el paquete.",
        "Despachá el paquete (llevalo o pedí retiro).",
        'Copiá el número de seguimiento y pegalo abajo en "Envío y seguimiento". Eso le avisa a la clienta.',
      ]
    : [
        'Tocá "Reintentar carga en MiCorreo" (abajo) para cargarlo automático. Si no anda, seguí a mano con estos datos.',
        "Entrá a MiCorreo y creá el envío con los datos de acá.",
        "Pagá el envío con tu saldo, imprimí el rótulo y despachá.",
        'Copiá el número de seguimiento y pegalo abajo en "Envío y seguimiento".',
      ];

  return (
    <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
      <header
        className={`flex items-center gap-2.5 rounded-t-2xl px-5 py-3.5 ${
          handled ? "bg-primary/10" : "bg-amber-50"
        }`}
      >
        <span
          className={`grid size-8 place-items-center rounded-xl ${
            handled ? "bg-primary/15 text-primary" : "bg-amber-100 text-amber-700"
          }`}
          aria-hidden
        >
          {handled ? <PackageCheck className="size-[18px]" /> : <AlertTriangle className="size-[18px]" />}
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Cómo despachar en MiCorreo</h2>
          <p className="text-xs text-muted-foreground">
            {trackingLoaded
              ? "Este pedido ya está despachado (tiene seguimiento). Los pasos quedan de referencia."
              : imported
                ? "Este pedido ya se cargó solo en MiCorreo. Seguí estos pasos para despacharlo."
                : "Este pedido todavía NO se cargó en MiCorreo. Reintentá abajo o cargalo a mano."}
          </p>
        </div>
      </header>

      <div className="space-y-4 p-5">
        {trackingLoaded ? (
          <p className="rounded-xl bg-surface-alt/60 px-3 py-2 text-sm text-muted-foreground">
            Este pedido ya tiene número de seguimiento cargado: está despachado. Los pasos quedan de
            referencia.
          </p>
        ) : null}

        {/* Pasos */}
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground">
          {pasos.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>

        {/* Datos del envío para copiar */}
        <div className="rounded-xl border border-border/70 bg-surface-alt/40 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos del envío
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={copiar} className="gap-1.5">
              {copied ? <Check className="size-4 text-primary" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <dl className="divide-y divide-border/50">
            <DataRow label="Pedido" value={orderNumber} />
            <DataRow label="Destinatario" value={props.recipientName} />
            <DataRow label="Teléfono" value={props.recipientPhone} />
            <DataRow label={props.metodoLabel} value={props.destino} />
            <DataRow label="Peso" value={`${props.weightGr} g`} />
            <DataRow label="Valor declarado" value={`$${props.declaredValue.toLocaleString("es-AR")}`} />
          </dl>
        </div>

        {error ? (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          {!handled ? (
            <Button type="button" onClick={reintentar} disabled={pending} className="gap-1.5">
              <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden />
              {pending ? "Cargando en MiCorreo…" : "Reintentar carga en MiCorreo"}
            </Button>
          ) : null}
          <Button asChild variant="outline" className="gap-1.5">
            <a href={MICORREO_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden /> Abrir MiCorreo
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
