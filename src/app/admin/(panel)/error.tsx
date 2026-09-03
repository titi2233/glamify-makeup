"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminPanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 p-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive" aria-hidden>
        <AlertTriangle className="size-7" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold">Ocurrió un error en el panel</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error.message || "No se pudo cargar esta sección."}
          {error.digest ? ` (ref: ${error.digest})` : ""}
        </p>
      </div>
      <Button onClick={() => reset()}>Reintentar</Button>
    </div>
  );
}
