"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { approveReviewAction, rejectReviewAction } from "./actions";

export function ReviewActionsButtons({ id, slug }: { id: string; slug: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const approve = () =>
    startTransition(async () => {
      setError(null);
      const r = await approveReviewAction(id, slug);
      if (!r.ok) setError(r.error ?? "Error");
      else router.refresh();
    });

  const reject = () =>
    startTransition(async () => {
      setError(null);
      const r = await rejectReviewAction(id, slug);
      if (!r.ok) setError(r.error ?? "Error");
      else router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={approve} disabled={pending} className="flex-1">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          Aprobar
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={pending} className="flex-1">
              <X className="size-4" aria-hidden />
              Rechazar
            </Button>
          }
          title="Rechazar reseña"
          description="La reseña no se publicará. Podés cambiar de opinión creando otra moderación, pero esta acción la oculta."
          confirmLabel="Sí, rechazar"
          onConfirm={reject}
          pending={pending}
        />
      </div>
      {error && (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
