import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Panel · Ingresar" };

export default async function AdminLoginPage() {
  const admin = await getAdminUser();
  if (admin) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-soft sm:p-8">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h1 className="font-display text-2xl text-foreground">Panel de Glamify</h1>
          <p className="text-sm text-muted-foreground">
            Entrá con tu email y contraseña para administrar la tienda.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
