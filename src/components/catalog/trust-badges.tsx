import { Sparkles, ShieldCheck, Truck, RefreshCw } from "lucide-react";

export function TrustBadges() {
  return (
    <div className="grid grid-cols-3 gap-2 pt-2">
      <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/40 p-2.5">
        <Sparkles className="size-3.5 text-primary shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground leading-tight">
          Cruelty-Free
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/40 p-2.5">
        <ShieldCheck className="size-3.5 text-primary shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground leading-tight">
          Dermatológico
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/40 p-2.5">
        <Truck className="size-3.5 text-primary shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground leading-tight">
          Envío 24/48h
        </span>
      </div>
    </div>
  );
}
