"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, Copy, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics/track";
import { captureExitIntentAction } from "@/app/(storefront)/marketing-actions";

const SEEN_KEY = "glamify_exit_seen";
const CONSENT_KEY = "glamify_analytics";

/** La elección de consentimiento se guarda en cookie (fuente de verdad) + localStorage (best-effort). */
function consentDecided(): boolean {
  if (typeof document !== "undefined" && new RegExp("(?:^|; )" + CONSENT_KEY + "=").test(document.cookie)) return true;
  try {
    return Boolean(localStorage.getItem(CONSENT_KEY));
  } catch {
    return false;
  }
}

/** Popup sutil de salida (una sola vez): captura email + revela cupón de bienvenida (blueprint 06 §8). */
export function ExitIntent() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const armed = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SEEN_KEY)) return;

    const trigger = () => {
      if (armed.current) return;
      // No solaparse con el banner de consentimiento (todavía sin elección).
      if (!consentDecided()) return;
      if (localStorage.getItem(SEEN_KEY)) return;
      armed.current = true;
      localStorage.setItem(SEEN_KEY, "1");
      setOpen(true);
      track("exit_intent_shown");
    };

    const hasHover = window.matchMedia("(hover: hover)").matches;
    let idle: ReturnType<typeof setTimeout> | undefined;

    // `mouseout` con relatedTarget null = el puntero salió del documento (mouseleave en `document` no es fiable).
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };
    const resetIdle = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(trigger, 25000);
    };

    if (hasHover) {
      document.addEventListener("mouseout", onMouseOut);
    } else {
      // Mobile (sin hover): disparo por inactividad como mejor esfuerzo.
      resetIdle();
      window.addEventListener("scroll", resetIdle, { passive: true });
      window.addEventListener("touchstart", resetIdle, { passive: true });
    }

    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", resetIdle);
      window.removeEventListener("touchstart", resetIdle);
      if (idle) clearTimeout(idle);
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await captureExitIntentAction({ email });
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar tu email.");
      return;
    }
    setDone(true);
    setCoupon(res.couponCode ?? null);
    track("exit_intent_submitted");
  }

  async function copyCode() {
    if (!coupon) return;
    try {
      await navigator.clipboard.writeText(coupon);
      setCopied(true);
    } catch {
      /* sin clipboard: la clienta puede copiar a mano */
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="center">
        <SheetHeader>
          <Gift className="mx-auto size-10 text-primary sm:mx-0" aria-hidden />
          <SheetTitle>Llevate 10% OFF en tu primera compra</SheetTitle>
          <SheetDescription>
            Dejanos tu email y te mandamos el código. Sin spam, baja cuando quieras.
          </SheetDescription>
        </SheetHeader>

        {!done ? (
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div className="space-y-1 text-left">
              <Label htmlFor="exit-email">Tu email</Label>
              <Input
                id="exit-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vos@ejemplo.com"
                autoComplete="email"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Enviando…" : "Quiero mi descuento"}
            </Button>
          </form>
        ) : (
          <div className="mt-4 space-y-3 text-center">
            {coupon ? (
              <>
                <p className="text-sm text-muted-foreground">Usá este código al pagar:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="rounded-xl border border-border bg-muted px-4 py-2 font-mono text-lg font-bold tracking-wide">
                    {coupon}
                  </code>
                  <Button type="button" variant="outline" size="icon" onClick={copyCode} aria-label="Copiar código">
                    {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-primary">¡Listo! Te vamos a avisar las novedades. 💕</p>
            )}
            <Button type="button" variant="ghost" className="w-full" onClick={() => setOpen(false)}>
              Seguir comprando
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
