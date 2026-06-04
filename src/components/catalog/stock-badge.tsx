import { Check, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { stockLabel, type StockState } from "@/lib/catalog/stock";

interface StockBadgeProps {
  state: StockState;
  /** stock real para "Quedan N" */
  stock?: number;
  className?: string;
}

const styles: Record<StockState, string> = {
  in_stock: "bg-success/10 text-success",
  low_stock: "bg-warning/15 text-warning-foreground",
  out_of_stock: "bg-muted text-muted-foreground",
};

export function StockBadge({ state, stock, className }: StockBadgeProps) {
  const Icon = state === "in_stock" ? Check : state === "low_stock" ? AlertTriangle : XCircle;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", styles[state], className)}>
      <Icon className="size-3.5" aria-hidden />
      {stockLabel(state, stock)}
    </span>
  );
}
