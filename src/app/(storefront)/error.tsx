"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StorefrontError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-12 text-center">
      <span className="icon-medallion grid size-14 place-items-center rounded-2xl" aria-hidden>
        <AlertTriangle className="size-7" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold">Algo no salió como esperábamos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Probá de nuevo en unos segundos. Si el problema sigue, contactanos.
        </p>
      </div>
      <Button onClick={() => reset()}>Reintentar</Button>
    </div>
  );
}
