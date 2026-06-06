/**
 * Crea (idempotente) una clienta de prueba para e2e:
 *  1) usuario en Supabase Auth (email_confirm: true)
 *  2) fila `Customer` (prisma), id = uid de Auth.
 * Requiere: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL,
 *           CUSTOMER_EMAIL, CUSTOMER_PASSWORD
 */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type AdminSupabaseClient = SupabaseClient<never, "public", "public">;

async function findAuthUserByEmail(supabase: AdminSupabaseClient, email: string): Promise<User | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  const email = process.env.CUSTOMER_EMAIL?.trim().toLowerCase();
  const password = process.env.CUSTOMER_PASSWORD;
  if (!url || !key || !dbUrl) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o DATABASE_URL."); process.exit(1); }
  if (!email || !password) { console.error("Faltan CUSTOMER_EMAIL o CUSTOMER_PASSWORD."); process.exit(1); }

  const supabase: AdminSupabaseClient = createClient<never, "public", "public">(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });
  try {
    let authUser = await findAuthUserByEmail(supabase, email);
    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      authUser = data.user;
    }
    await prisma.customer.upsert({
      where: { id: authUser.id },
      update: { email, name: "Clienta E2E" },
      create: { id: authUser.id, email, name: "Clienta E2E" },
    });
    console.log(`Clienta e2e lista para ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
