"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";

/** Inicia sesión con email/password. Solo deja pasar a usuarios con fila User (owner/admin). */
export async function signInAction(email: string, password: string): Promise<AdminResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) return { ok: false, error: "Completá email y contraseña." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) return { ok: false, error: "Email o contraseña incorrectos." };

    // Defensa: que la cuenta de Auth tenga además fila User con role admin/owner.
    const admin = await getAdminUser();
    if (!admin) {
      await supabase.auth.signOut();
      return { ok: false, error: "Esta cuenta no tiene permisos de administración." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Error inesperado. Intentá de nuevo." };
  }
}

/** Cierra sesión y vuelve al login. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
