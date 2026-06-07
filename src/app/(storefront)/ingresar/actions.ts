"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer/auth";
import { mergeGuestCartIntoCustomer, type MergeCartDb } from "@/lib/cart/merge";
import { getCartIdFromCookie, setCartIdCookie } from "@/lib/cart/cart-cookie";
import { prisma } from "@/lib/prisma";
import { getAuthBaseUrl } from "@/lib/http/base-url";
import type { ActionResult } from "@/lib/forms/action-result";

/** Tras autenticar, asocia el carrito de la cookie a la clienta. */
export async function mergeCartForCurrentCustomer(): Promise<void> {
  const customer = await getCustomer();
  if (!customer) return;
  const row = await prisma.customer.findUnique({ where: { id: customer.id }, select: { marketingConsent: true } });
  const cookieCartId = await getCartIdFromCookie();
  const { canonicalCartId } = await mergeGuestCartIntoCustomer(
    { cookieCartId, customerId: customer.id, marketingConsent: row?.marketingConsent ?? false },
    { db: prisma as unknown as MergeCartDb },
  );
  if (canonicalCartId && canonicalCartId !== cookieCartId) await setCartIdCookie(canonicalCartId);
}

export async function signInAction(input: { email: string; password: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error) return { ok: false, error: "Email o contraseña incorrectos." };
  await mergeCartForCurrentCustomer();
  return { ok: true };
}

/** Narrow de error de unicidad de Prisma (P2002) sin acoplar tipos del client. */
function isUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

export async function signUpAction(input: {
  email: string; password: string; name: string; marketingConsent: boolean;
}): Promise<ActionResult & { needsConfirmation?: boolean }> {
  const supabase = await createClient();
  const email = input.email.trim().toLowerCase();

  // Email ya registrado: cortamos ANTES de signUp para devolver un error
  // amigable. Si no lo hacemos, Supabase (anti-enumeración, con "Confirm email"
  // ON) devuelve un user obfuscado con un id NUEVO y sin mandar mail; el upsert
  // por ese id chocaría con el @unique de `email` → error 500 no controlado.
  const existing = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "El correo electrónico ya está registrado." };

  const baseUrl = await getAuthBaseUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { name: input.name.trim() }, emailRedirectTo: `${baseUrl}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  // Persistir consentimiento si la fila ya existe (confirmación ON → puede no haber sesión aún).
  if (data.user) {
    try {
      await prisma.customer.upsert({
        where: { id: data.user.id },
        create: { id: data.user.id, email, name: input.name.trim(), marketingConsent: input.marketingConsent },
        update: { marketingConsent: input.marketingConsent },
      });
    } catch (e) {
      // Carrera: otra request creó la fila con este email entre el check y el upsert.
      if (isUniqueConstraintError(e)) return { ok: false, error: "El correo electrónico ya está registrado." };
      throw e;
    }
  }
  return { ok: true, needsConfirmation: !data.session };
}

export async function signInWithGoogleAction(): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient();
  const baseUrl = await getAuthBaseUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${baseUrl}/auth/callback` },
  });
  if (error || !data.url) return { ok: false, error: "No se pudo iniciar sesión con Google." };
  return { ok: true, url: data.url };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
