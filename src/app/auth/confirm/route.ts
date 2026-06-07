import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mergeCartForCurrentCustomer } from "@/app/(storefront)/ingresar/actions";

/**
 * Confirmación de email vía OTP (`token_hash`) — INDEPENDIENTE DEL DISPOSITIVO.
 *
 * A diferencia del flujo PKCE de `/auth/callback` (que exige la cookie
 * `code_verifier` del MISMO navegador que inició el registro y falla con
 * "both auth code and code verifier should be non-empty" si la clienta abre el
 * link en otro dispositivo), `verifyOtp` canjea el `token_hash` del email sin
 * depender de ninguna cookie previa, así que funciona aunque se registre en
 * desktop y confirme en el celular.
 *
 * Plantilla de email en Supabase
 * (Authentication → Email Templates → "Confirm signup"), reemplazar el href por:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
 * (opcional) destino post-confirmación: agregar &next=/ruta-relativa
 */

// Subconjunto de EmailOtpType de @supabase/supabase-js (estructuralmente
// asignable a verifyOtp); validar acá saneamos el query param `type`.
const EMAIL_OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

function parseOtpType(value: string | null): EmailOtpType | null {
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

/** Solo paths internos relativos (anti open-redirect). Default: `/cuenta`. */
function sanitizeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/cuenta";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = parseOtpType(searchParams.get("type"));
  const next = sanitizeNext(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      await mergeCartForCurrentCustomer();
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/ingresar?error=oauth`);
}
