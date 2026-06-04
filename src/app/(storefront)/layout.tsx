import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="container flex-1 pb-20 pt-4 md:pb-8">{children}</main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}
