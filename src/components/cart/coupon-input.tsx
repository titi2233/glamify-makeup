"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { applyCouponAction, removeCouponAction } from "@/app/(storefront)/actions";

export function CouponInput({ applied }: { applied: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = () =>
    startTransition(async () => {
      setError(null);
      const r = await applyCouponAction(code);
      if (!r.ok) setError(r.error ?? "No se pudo aplicar.");
      else { setCode(""); router.refresh(); }
    });
  const remove = () =>
    startTransition(async () => {
      await removeCouponAction();
      router.refresh();
    });

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
        <span>Cupón <strong>{applied}</strong> aplicado</span>
        <button type="button" onClick={remove} disabled={pending} className="text-xs text-primary hover:underline">Quitar</button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Cupón" aria-label="Código de cupón" className="uppercase" />
        <Button type="button" variant="outline" onClick={apply} disabled={pending || !code.trim()}>Aplicar</Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
