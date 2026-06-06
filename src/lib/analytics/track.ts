import posthog from "posthog-js";

/** Eventos de conversión que emite el storefront (blueprint 06 §7). */
export type AnalyticsEvent =
  | "product_viewed"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "order_bump_added"
  | "exit_intent_shown"
  | "exit_intent_submitted"
  | "review_submitted";

/** Captura tipada. No-op en SSR o si PostHog no está inicializado (sin key / consentimiento rechazado). */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.capture(event, props);
}
