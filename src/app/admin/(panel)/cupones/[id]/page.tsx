import { notFound } from "next/navigation";
import { TicketPercent } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { PageHeader } from "@/components/admin/page-header";
import { CouponForm } from "@/app/admin/(panel)/cupones/coupon-form";
import type { CouponFormInput } from "@/lib/admin/coupons/validation";

export const dynamic = "force-dynamic";

/** YYYY-MM-DD para <input type="date"> (UTC, sin desfase de zona). */
function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function numToInput(n: number | null): string {
  return n == null ? "" : String(n);
}

export default async function EditarCuponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) notFound();

  const initial: CouponFormInput = {
    code: coupon.code,
    type: coupon.type,
    value: coupon.type === "free_shipping" ? "" : String(toNumber(coupon.value)),
    scope: coupon.scope,
    scopeId: coupon.scopeId ?? "",
    minSubtotal: numToInput(coupon.minSubtotal != null ? toNumber(coupon.minSubtotal) : null),
    maxUses: numToInput(coupon.maxUses),
    perCustomerLimit: numToInput(coupon.perCustomerLimit),
    validFrom: toDateInput(coupon.validFrom),
    validTo: toDateInput(coupon.validTo),
    active: coupon.active,
  };

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={TicketPercent}
        title={`Editar cupón ${coupon.code}`}
        subtitle="Cambiá las condiciones del descuento. El conteo de usos no se puede editar."
      />
      <CouponForm couponId={coupon.id} initial={initial} />
    </div>
  );
}
