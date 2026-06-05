import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export interface AdminUser {
  id: string;
  email: string;
  role: "owner" | "admin";
}

/** Fila de `User` (prisma) mínima para decidir si concede admin. */
export type AdminUserRow = { id: string; email: string; role: "owner" | "admin" } | null;

/** Pura: una fila `User` con role owner|admin concede admin; null o sin fila → no. */
export function resolveAdminRole(row: AdminUserRow): AdminUser | null {
  if (!row) return null;
  if (row.role !== "owner" && row.role !== "admin") return null;
  return { id: row.id, email: row.email, role: row.role };
}

/** Superficie mínima de DB que necesita el lookup del admin (mockeable en tests). */
export interface AdminAuthDb {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<AdminUserRow>;
  };
}
/** Resultado mínimo de supabase `auth.getUser()` que consumimos. */
export type SupabaseGetUser = () => Promise<{
  data: { user: { id: string; email?: string | null } | null };
  error: unknown;
}>;
export interface GetAdminUserDeps {
  getUser: SupabaseGetUser;
  db: AdminAuthDb;
}

/** Core inyectable: supabase user → fila User → AdminUser|null. Sin redirect. */
export async function getAdminUserWithDeps(deps: GetAdminUserDeps): Promise<AdminUser | null> {
  const { data } = await deps.getUser();
  const authUser = data.user;
  if (!authUser) return null;
  const row = await deps.db.user.findUnique({ where: { id: authUser.id } });
  return resolveAdminRole(row);
}

/** Wrapper real: cablea supabase server client + prisma. Devuelve null si no es admin. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  return getAdminUserWithDeps({
    getUser: () => supabase.auth.getUser(),
    db: prisma as unknown as AdminAuthDb,
  });
}

/** Guard: si no es admin redirige a /admin/login; si lo es, devuelve el AdminUser. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
