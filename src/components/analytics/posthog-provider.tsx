"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Inicializa PostHog en el cliente. No-op si no hay key (dev local / build sin analytics). */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const firstPath = useRef(true);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true, // pageview inicial automático
    });
    // Consentimiento opt-out: si la clienta ya rechazó, no capturamos.
    if (readCookie("glamify_analytics") === "no") posthog.opt_out_capturing();
  }, []);

  // App Router no recarga la página al navegar: capturamos $pageview en cada cambio de ruta
  // (el inicial ya lo cubre capture_pageview, por eso salteamos el primer render).
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (posthog.__loaded) posthog.capture("$pageview");
  }, [pathname]);

  return <>{children}</>;
}
