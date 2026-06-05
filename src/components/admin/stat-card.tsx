import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  /** Título corto, ej. "Ventas de hoy". */
  title: string;
  /** Valor grande, ya formateado (ej. "$ 12.500,00" o "3"). */
  value: string;
  /** Línea de ayuda en lenguaje simple. */
  hint?: string;
  /** Ícono Lucide (sin emojis). */
  icon: LucideIcon;
  className?: string;
}

/** Card de número grande para el dashboard de la dueña. */
export function StatCard({ title, value, hint, icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex items-start gap-4 p-5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="font-display text-2xl font-semibold leading-tight text-foreground">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
