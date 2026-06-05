"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { validateCouponInput, type CouponFormInput } from "@/lib/admin/coupons/validation";
import { createCoupon, updateCoupon, deleteCoupon, defaultCouponDeps } from "@/lib/admin/coupons/service";

export async function createCouponAction(input: CouponFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCouponInput(input);
    if (!v.ok) return { ok: false, error: v.error };
    const { id } = await createCoupon(v.value, defaultCouponDeps());
    revalidatePath("/admin/cupones");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el cupón." };
  }
}

export async function updateCouponAction(id: string, input: CouponFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCouponInput(input);
    if (!v.ok) return { ok: false, error: v.error };
    const res = await updateCoupon(id, v.value, defaultCouponDeps());
    revalidatePath("/admin/cupones");
    revalidatePath(`/admin/cupones/${id}`);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el cupón." };
  }
}

export async function deleteCouponAction(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    const res = await deleteCoupon(id, defaultCouponDeps());
    revalidatePath("/admin/cupones");
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo eliminar el cupón." };
  }
}
