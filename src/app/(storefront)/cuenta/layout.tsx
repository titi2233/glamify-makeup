import { requireCustomer } from "@/lib/customer/auth";
import { AccountNav } from "./account-nav";

export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  await requireCustomer();
  return (
    <section className="space-y-6 py-6">
      <h1 className="font-display text-2xl font-bold">Mi cuenta</h1>
      <AccountNav />
      <div>{children}</div>
    </section>
  );
}
