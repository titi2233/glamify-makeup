import { Sparkles, ShieldCheck, Truck, RefreshCw } from "lucide-react";

export function TrustBadges() {
  return (
    <div className="grid grid-cols-2 gap-3 pt-2">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 p-2.5">
        <Sparkles className="size-4 text-primary shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground leading-tight">
          Cruelty-Free & Vegano
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 p-2.5">
        <ShieldCheck className="size-4 text-primary shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground leading-tight">
          Testeado en Pieles Reales
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 p-2.5">
        <Truck className="size-4 text-primary shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground leading-tight">
          Envío Rápido 24/48h
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 p-2.5">
        <RefreshCw className="size-4 text-primary shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground leading-tight">
          Garantía de Tono 30 Días
        </span>
      </div>
    </div>
  );
}
