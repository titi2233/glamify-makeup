"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { validateCombo, type ComboFormInput } from "@/lib/admin/combos/validation";
import { createCombo, updateCombo, deleteCombo, defaultComboDeps } from "@/lib/admin/combos/service";

/** Payload serializable desde el form cliente (fechas como ISO string o null). */
export interface ComboActionInput {
  name: string;
  slug: string;
  description: string;
  comboPrice: number;
  images: string[];
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  items: { variantId: string; qty: number }[];
}

function toFormInput(input: ComboActionInput): ComboFormInput {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description,
    comboPrice: input.comboPrice,
    images: input.images,
    active: input.active,
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validTo: input.validTo ? new Date(input.validTo) : null,
    items: input.items,
  };
}

export async function createComboAction(input: ComboActionInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCombo(toFormInput(input));
    if (!v.ok) return { ok: false, error: v.error };
    const { id } = await createCombo(v.value, defaultComboDeps());
    revalidatePath("/admin/combos");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el combo." };
  }
}

export async function updateComboAction(id: string, input: ComboActionInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCombo(toFormInput(input));
    if (!v.ok) return { ok: false, error: v.error };
    const res = await updateCombo(id, v.value, defaultComboDeps());
    revalidatePath("/admin/combos");
    revalidatePath(`/admin/combos/${id}`);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el combo." };
  }
}

export async function deleteComboAction(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    await deleteCombo(id, defaultComboDeps());
    revalidatePath("/admin/combos");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo borrar el combo." };
  }
}
