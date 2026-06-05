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
    <div className="flex min-h-screen flex-col bg-muted md:flex-row">
      <AdminSidebar
        logout={
          <form action={signOutAction} className="flex flex-col gap-1">
            <p className="truncate px-3 text-xs text-muted-foreground" title={admin.email}>
              {admin.email}
            </p>
            <Button type="submit" variant="ghost" className="w-full justify-start gap-3">
              <LogOut className="size-5 shrink-0" aria-hidden />
              Salir
            </Button>
          </form>
        }
      />
      <main className="flex-1 px-4 py-6 pb-24 md:ml-60 md:px-8 md:py-8 md:pb-8">
        {children}
      </main>
    </div>
  );
}
