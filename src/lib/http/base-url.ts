import { headers } from "next/headers";

/**
 * URL base absoluta para redirects de auth (confirmación de email, OAuth callback).
 *
 * Orden de prioridad:
 *  1. `NEXT_PUBLIC_APP_URL` (prod en `wrangler.jsonc` → https://glamifymakeup.site).
 *  2. Host real del request (`x-forwarded-host`/`host`) cuando la env var falta,
 *     para que el link de confirmación NUNCA caiga a `http://localhost:3000`.
 *  3. localhost solo como último recurso (dev sin env, sin headers disponibles).
 *
 * Importante: además del código, Supabase usa su "Site URL" + allow-list de
 * "Redirect URLs" del dashboard. Ambas deben apuntar al dominio de producción
 * (ver SETUP.md), o Supabase ignora `emailRedirectTo` y vuelve al Site URL.
 */
export async function getAuthBaseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const isLocal = /^(localhost|127\.|0\.0\.0\.0)/.test(host);
      const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    /* headers() fuera de un request (p. ej. tests): caer al default. */
  }

  return "http://localhost:3000";
}
