import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Encabezado estándar de cada página del panel: título grande + una línea
 * que explica "para qué sirve esta pantalla" (que lo entienda un nene).
 * `action` es el botón principal de la pantalla (ej. "Nuevo producto").
 */
export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
