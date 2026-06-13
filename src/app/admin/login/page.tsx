import { redirect } from "next/navigation";
import { Sparkles, Lock } from "lucide-react";
import { getAdminUser } from "@/lib/admin/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Panel · Ingresar" };

export default async function AdminLoginPage() {
  const admin = await getAdminUser();
  if (admin) redirect("/admin");

  return (
    <main className="admin-surface flex min-h-screen items-center justify-center px-4 py-12">
      <div className="stagger w-full max-w-sm space-y-6">
        {/* Lockup de marca */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="icon-medallion grid size-14 place-items-center rounded-2xl font-display text-2xl font-bold"
            aria-hidden
          >
            G
          </span>
          <div className="space-y-1.5">
            <h1 className="font-display text-3xl font-bold leading-none text-foreground">
              Glamify
            </h1>
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              Panel de la dueña
            </p>
          </div>
        </div>

        {/* Card de ingreso */}
        <div className="rounded-2xl border border-border/70 bg-card p-7 shadow-soft-lg">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span
              className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"
              aria-hidden
            >
              <Lock className="size-5" />
            </span>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Iniciá sesión
              </h2>
              <p className="text-sm text-muted-foreground">
                Entrá con tu email y contraseña para administrar la tienda.
              </p>
            </div>
          </div>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Acceso exclusivo para la dueña de Glamify.
        </p>
      </div>
    </main>
  );
}
