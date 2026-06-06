import Link from "next/link";
import { requireCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";

export default async function CuentaHome() {
  const customer = await requireCustomer();
  const [orders, wishlistCount] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { orderNumber: true, total: true, status: true },
    }),
    prisma.wishlist.count({ where: { customerId: customer.id } }),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Hola{customer.name ? `, ${customer.name}` : ""} 👋</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/cuenta/pedidos" className="rounded-2xl border border-border p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Últimos pedidos</p>
          {orders.length === 0 ? (
            <p className="mt-2 text-sm">Todavía no tenés pedidos.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {orders.map((o) => (
                <li key={o.orderNumber} className="flex justify-between">
                  <span>{o.orderNumber}</span>
                  <span className="tabular-nums">{formatARS(Number(o.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </Link>
        <Link href="/cuenta/favoritos" className="rounded-2xl border border-border p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Favoritos</p>
          <p className="mt-2 text-2xl font-bold">{wishlistCount}</p>
        </Link>
      </div>
    </div>
  );
}
