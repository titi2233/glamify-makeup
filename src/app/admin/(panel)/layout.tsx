import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/admin/login/actions";

export default async function AdminPanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin();

  return (
    <div className="admin-surface flex min-h-screen flex-col md:flex-row">
      <AdminSidebar
        email={admin.email}
        logout={
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full justify-center gap-2 bg-card">
              <LogOut className="size-4 shrink-0" aria-hidden />
              Salir
            </Button>
          </form>
        }
      />

      {/* Top bar mobile: la marca y "salir" (en desktop viven en la sidebar) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-card/85 px-4 py-2.5 backdrop-blur md:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="icon-medallion grid size-8 place-items-center rounded-xl font-display text-sm font-bold">
            G
          </span>
          <span className="font-display text-lg font-bold text-foreground">Glamify</span>
        </Link>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
            <LogOut className="size-5" aria-hidden />
          </Button>
        </form>
      </header>

      <main className="flex-1 px-4 py-6 pb-28 md:ml-60 md:px-8 md:py-10 md:pb-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
