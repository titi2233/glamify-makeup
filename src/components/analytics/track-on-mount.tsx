"use client";

import { useEffect, useRef } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics/track";

/** Dispara un evento de analytics una sola vez al montar (para usar desde Server Components). */
export function TrackOnMount({ event, props }: { event: AnalyticsEvent; props?: Record<string, unknown> }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
