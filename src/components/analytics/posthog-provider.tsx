"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Inicializa PostHog en el cliente. No-op si no hay key (dev local / build sin analytics). */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
    });
    // Consentimiento opt-out: si la clienta ya rechazó, no capturamos.
    if (readCookie("glamify_analytics") === "no") posthog.opt_out_capturing();
  }, []);
  return <>{children}</>;
}
