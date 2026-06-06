"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

const COOKIE = "glamify_analytics";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeChoice(value: "yes" | "no") {
  // Cookie 1 año (la lee el PostHogProvider en la próxima carga).
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  // localStorage para coordinar con el exit-intent (no dispararlo mientras el banner está visible).
  try {
    localStorage.setItem(COOKIE, value);
  } catch {
    /* almacenamiento bloqueado: la cookie alcanza */
  }
}

/**
 * Banner de consentimiento opt-out (blueprint 06 §7). La captura está ON por defecto;
 * "Rechazar" desactiva PostHog. Se muestra una sola vez (hasta que hay elección).
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readCookie(COOKIE)) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    writeChoice("yes");
    setVisible(false);
  };
  const reject = () => {
    writeChoice("no");
    if (posthog.__loaded) posthog.opt_out_capturing();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 shadow-soft backdrop-blur md:bottom-4 md:left-auto md:right-4 md:max-w-md md:rounded-2xl md:border"
    >
      <p className="text-sm text-foreground">
        Usamos cookies para mejorar tu experiencia y entender qué te gusta. Podés rechazarlas cuando quieras.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={accept} className="flex-1">
          Aceptar
        </Button>
        <Button size="sm" variant="outline" onClick={reject} className="flex-1">
          Rechazar
        </Button>
      </div>
    </div>
  );
}
