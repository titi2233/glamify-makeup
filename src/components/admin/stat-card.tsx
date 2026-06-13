import type { LucideIcon } from "lucide-react";
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
    <div
      className={cn(
        "admin-card group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-soft",
        className,
      )}
    >
      {/* Glow decorativo en la esquina (se intensifica al pasar el mouse). */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-80"
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <span className="icon-medallion grid size-11 shrink-0 place-items-center rounded-2xl" aria-hidden>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="relative mt-3 font-display text-3xl font-bold leading-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint ? <p className="relative mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
