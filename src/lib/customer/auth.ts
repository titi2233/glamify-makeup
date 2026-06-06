import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export interface CustomerUser {
  id: string;
  email: string;
  name: string | null;
}

export type CustomerRow = { id: string; email: string; name: string | null } | null;

/** Pura: fila Customer → CustomerUser | null. */
export function toCustomerUser(row: CustomerRow): CustomerUser | null {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name };
}

/** Superficie mínima de DB para el upsert-on-load (mockeable en tests). */
export interface CustomerAuthDb {
  customer: {
    upsert: (args: {
      where: { id: string };
      create: { id: string; email: string; name: string | null };
      update: { email: string };
    }) => Promise<CustomerRow>;
  };
}

export type SupabaseGetUser = () => Promise<{
  data: { user: { id: string; email?: string | null; user_metadata?: { name?: string | null } } | null };
  error: unknown;
}>;

export interface GetCustomerDeps {
  getUser: SupabaseGetUser;
  db: CustomerAuthDb;
}

/** Core inyectable: supabase user → upsert Customer (id=uid) → CustomerUser | null. */
export async function getCustomerWithDeps(deps: GetCustomerDeps): Promise<CustomerUser | null> {
  const { data } = await deps.getUser();
  const authUser = data.user;
  if (!authUser || !authUser.email) return null;
  const row = await deps.db.customer.upsert({
    where: { id: authUser.id },
    create: { id: authUser.id, email: authUser.email, name: authUser.user_metadata?.name ?? null },
    update: { email: authUser.email },
  });
  return toCustomerUser(row);
}

/** Wrapper real: cablea supabase server client + prisma. */
export async function getCustomer(): Promise<CustomerUser | null> {
  const supabase = await createClient();
  return getCustomerWithDeps({
    getUser: () => supabase.auth.getUser(),
    db: prisma as unknown as CustomerAuthDb,
  });
}

/** Guard: sin sesión → redirect /ingresar; si hay clienta, la devuelve. */
export async function requireCustomer(): Promise<CustomerUser> {
  const user = await getCustomer();
  if (!user) redirect("/ingresar");
  return user;
}
