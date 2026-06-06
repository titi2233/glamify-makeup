"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={approve} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          Aprobar
        </Button>
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="outline" disabled={pending}>
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
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
