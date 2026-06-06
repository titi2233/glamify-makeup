import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer/auth";
import { IngresarForm } from "./ingresar-form";

export const metadata: Metadata = { title: "Ingresar" };

interface IngresarPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function IngresarPage({ searchParams }: IngresarPageProps) {
  const customer = await getCustomer();
  if (customer) redirect("/cuenta");
  const params = await searchParams;
  const errorParam = typeof params.error === "string" ? params.error : null;
  const initialError =
    errorParam === "oauth" ? "No pudimos ingresar con Google. Intentá de nuevo." : null;
  return (
    <section className="py-8">
      <h1 className="mb-6 text-center font-display text-2xl font-bold">Tu cuenta Glamify</h1>
      <IngresarForm initialError={initialError} />
    </section>
  );
}
