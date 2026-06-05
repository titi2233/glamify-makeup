/**
 * Crea (idempotente) el usuario administrador de la tienda:
 *  1) usuario en Supabase Auth (email_confirm: true)
 *  2) fila `User` (prisma) con role `owner`, id = uid de Auth.
 * Standalone (corre con tsx, fuera de Next) → clientes self-contained.
 * Requiere en el entorno:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL,
 *   ADMIN_EMAIL, ADMIN_PASSWORD
 */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Cliente service-role con el esquema por defecto que devuelve `createClient(url, key)`. */
type AdminSupabaseClient = SupabaseClient<never, "public", "public">;

async function findAuthUserByEmail(
  supabase: AdminSupabaseClient,
  email: string,
): Promise<User | null> {
  // listUsers pagina; recorremos hasta encontrarlo (1–2 admins → pocas páginas).
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
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!url || !key || !dbUrl) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o DATABASE_URL.");
    process.exit(1);
  }
  if (!email || !password) {
    console.error("Faltan ADMIN_EMAIL o ADMIN_PASSWORD en el entorno.");
    process.exit(1);
  }

  const supabase: AdminSupabaseClient = createClient<never, "public", "public">(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });

  try {
    let authUser = await findAuthUserByEmail(supabase, email);
    if (authUser) {
      console.log(`Usuario de Auth para ${email} ya existe — se reutiliza.`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      authUser = data.user;
      console.log(`Usuario de Auth creado para ${email}.`);
    }

    await prisma.user.upsert({
      where: { id: authUser.id },
      update: { email, role: "owner" },
      create: { id: authUser.id, email, role: "owner" },
    });
    console.log(`Fila User (role owner) lista para ${email}. Listo para entrar a /admin.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
