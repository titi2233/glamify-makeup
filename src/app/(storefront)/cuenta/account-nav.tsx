"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "../ingresar/actions";

const LINKS = [
  { href: "/cuenta", label: "Inicio" },
  { href: "/cuenta/datos", label: "Mis datos" },
  { href: "/cuenta/pedidos", label: "Mis pedidos" },
  { href: "/cuenta/favoritos", label: "Favoritos" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/cuenta" ? pathname === "/cuenta" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={cn("rounded-full border border-border px-3 py-1.5", active ? "bg-primary-hover text-primary-foreground" : "text-muted-foreground")}>
            {l.label}
          </Link>
        );
      })}
      <form action={signOutAction}>
        <button type="submit" className="rounded-full border border-border px-3 py-1.5 text-muted-foreground">Salir</button>
      </form>
    </nav>
  );
}
