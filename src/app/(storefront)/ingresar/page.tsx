import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer/auth";
import { IngresarForm } from "./ingresar-form";

export const metadata: Metadata = { title: "Ingresar — Glamify Makeup" };

export default async function IngresarPage() {
  const customer = await getCustomer();
  if (customer) redirect("/cuenta");
  return (
    <section className="py-8">
      <h1 className="mb-6 text-center font-display text-2xl font-bold">Tu cuenta Glamify</h1>
      <IngresarForm />
    </section>
  );
}
