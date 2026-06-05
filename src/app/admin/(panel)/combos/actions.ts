"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { validateCombo, type ComboFormInput } from "@/lib/admin/combos/validation";
import { createCombo, updateCombo, deleteCombo, defaultComboDeps } from "@/lib/admin/combos/service";
import { prisma } from "@/lib/prisma";
import type { VariantOption } from "./combo-form";

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

/** Lista plana de variantes activas (de productos no borrados) para el picker del form. */
export async function listVariantOptions(): Promise<VariantOption[]> {
  await requireAdmin(); // server action lee la DB: gatear aunque se invoque sólo desde páginas guardadas.
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      name: true,
      variants: {
        where: { active: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, sku: true },
      },
    },
  });
  const options: VariantOption[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      options.push({ id: v.id, label: `${p.name} — ${v.name} (${v.sku})` });
    }
  }
  return options;
}
