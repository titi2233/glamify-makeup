import { formatARS } from "@/lib/money";
import { Truck, CheckCircle2 } from "lucide-react";

export function FreeShippingBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  if (threshold <= 0) return null;
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  const hasFree = remaining <= 0;

  return (
    <div className={`rounded-2xl p-3.5 border transition-all ${hasFree ? "bg-emerald-50/80 border-emerald-200/80 text-emerald-900" : "bg-secondary border-border/80 text-foreground"}`}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          {hasFree ? (
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" aria-hidden="true" />
          ) : (
            <Truck className="size-4 text-primary shrink-0" aria-hidden="true" />
          )}
          <span>
            {hasFree ? (
              <>¡Tenés <strong>Envío Gratis</strong> a todo el país! 🎉</>
            ) : (
              <>Te faltan <strong className="text-primary font-bold">{formatARS(remaining)}</strong> para el envío gratis</>
            )}
          </span>
        </span>
        <span className="text-[11px] font-bold opacity-80 tabular-nums">{pct}%</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${hasFree ? "bg-emerald-600" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
