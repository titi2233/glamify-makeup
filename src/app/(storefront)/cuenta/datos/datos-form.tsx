"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "./actions";

export function DatosForm({ initial }: { initial: { name: string; phone: string; email: string } }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false); setError(null); setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await updateProfileAction({ name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? "") });
    setPending(false);
    if (res.ok) setSaved(true); else setError(res.error ?? "Error");
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={initial.name} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={initial.phone} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={initial.email} readOnly disabled />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-primary">Guardado ✓</p>}
      <Button type="submit" disabled={pending}>Guardar</Button>
    </form>
  );
}
