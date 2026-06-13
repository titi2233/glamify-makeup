import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { PageHeader } from "@/components/admin/page-header";
import { ComboForm, type ComboFormInitial } from "../combo-form";
import { listVariantOptions } from "../actions";

export const dynamic = "force-dynamic";

function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export default async function EditarComboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [combo, variantOptions] = await Promise.all([
    prisma.combo.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        comboPrice: true,
        active: true,
        validFrom: true,
        validTo: true,
        images: true,
        items: { select: { variantId: true, qty: true } },
      },
    }),
    listVariantOptions(),
  ]);

  if (!combo) notFound();

  const initial: ComboFormInitial = {
    id: combo.id,
    name: combo.name,
    slug: combo.slug,
    description: combo.description ?? "",
    comboPrice: toNumber(combo.comboPrice),
    active: combo.active,
    validFrom: toDateInput(combo.validFrom),
    validTo: toDateInput(combo.validTo),
    images: combo.images,
    items: combo.items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
  };

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={Layers}
        title="Editar combo"
        subtitle="Cambiá productos, precio o vigencia del combo."
      />
      <ComboForm variantOptions={variantOptions} initial={initial} />
    </div>
  );
}
