import { PageHeader } from "@/components/admin/page-header";
import { ComboForm } from "../combo-form";
import { listVariantOptions } from "../actions";

export const dynamic = "force-dynamic";

export default async function NuevoComboPage() {
  const variantOptions = await listVariantOptions();
  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo combo" subtitle="Elegí los productos del pack y poné el precio del combo." />
      <ComboForm variantOptions={variantOptions} />
    </div>
  );
}
