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
