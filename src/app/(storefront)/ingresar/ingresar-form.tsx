"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, signUpAction, signInWithGoogleAction } from "./actions";

type Mode = "in" | "up";

export function IngresarForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("in");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setInfo(null); setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    try {
      if (mode === "in") {
        const res = await signInAction({ email, password });
        if (!res.ok) { setError(res.error ?? "Error"); return; }
        router.push("/cuenta"); router.refresh();
      } else {
        const res = await signUpAction({
          email, password,
          name: String(fd.get("name") ?? ""),
          marketingConsent: fd.get("consent") === "on",
        });
        if (!res.ok) { setError(res.error ?? "Error"); return; }
        if (res.needsConfirmation) setInfo("¡Listo! Revisá tu correo para confirmar tu cuenta.");
        else { router.push("/cuenta"); router.refresh(); }
      }
    } finally { setPending(false); }
  }

  async function onGoogle() {
    setError(null);
    const res = await signInWithGoogleAction();
    if (res.ok && res.url) window.location.href = res.url;
    else setError(res.error ?? "Error con Google.");
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <div className="grid grid-cols-2 rounded-xl border border-border p-1 text-sm">
        <button type="button" onClick={() => setMode("in")} className={mode === "in" ? "rounded-lg bg-primary py-2 font-medium text-primary-foreground" : "py-2"}>Ingresar</button>
        <button type="button" onClick={() => setMode("up")} className={mode === "up" ? "rounded-lg bg-primary py-2 font-medium text-primary-foreground" : "py-2"}>Crear cuenta</button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "up" && (
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} required />
        </div>
        {mode === "up" && (
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="consent" className="mt-1" />
            Quiero recibir novedades y recordatorios de mi carrito.
          </label>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-primary">{info}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {mode === "in" ? "Ingresar" : "Crear cuenta"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
        Continuar con Google
      </Button>
    </div>
  );
}
