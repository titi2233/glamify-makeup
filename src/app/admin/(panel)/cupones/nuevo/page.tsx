import { PageHeader } from "@/components/admin/page-header";
import { CouponForm } from "@/app/admin/(panel)/cupones/coupon-form";

export default function NuevoCuponPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo cupón" subtitle="Crea un código de descuento para que tus clientas paguen menos." />
      <CouponForm />
    </div>
  );
}
