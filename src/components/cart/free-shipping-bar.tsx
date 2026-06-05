import { formatARS } from "@/lib/money";
import { Truck } from "lucide-react";

export function FreeShippingBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  if (threshold <= 0) return null;
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Truck className="size-4 text-primary" aria-hidden />
        {remaining > 0 ? <>Te faltan <strong>{formatARS(remaining)}</strong> para el envío gratis</> : <>¡Tenés envío gratis! 🎉</>}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
