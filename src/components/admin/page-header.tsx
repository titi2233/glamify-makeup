import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  /** Ícono Lucide opcional: se muestra como medallón a la izquierda del título. */
  icon?: LucideIcon;
  className?: string;
}

/**
 * Encabezado estándar de cada página del panel: título grande + una línea
 * que explica "para qué sirve esta pantalla" (que lo entienda un nene).
 * `action` es el botón principal de la pantalla (ej. "Nuevo producto").
 */
export function PageHeader({ title, subtitle, action, icon: Icon, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="icon-medallion grid size-10 shrink-0 place-items-center rounded-2xl" aria-hidden>
              <Icon className="size-5" />
            </span>
          ) : null}
          <h1 className="font-display text-[1.75rem] font-bold leading-tight text-foreground">{title}</h1>
        </div>
        <span
          aria-hidden
          className="block h-1 w-12 rounded-full bg-gradient-to-r from-primary to-secondary"
        />
        <p className="max-w-prose text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
