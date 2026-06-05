"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { validateCategory, type CategoryFormInput } from "@/lib/admin/categories/validation";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  defaultCategoryDeps,
} from "@/lib/admin/categories/service";

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

export async function createCategoryAction(input: CategoryFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCategory(input);
    if (!v.ok) return { ok: false, error: v.error };
    const { id } = await createCategory(v.value, defaultCategoryDeps());
    revalidatePath("/admin/categorias");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateCategoryAction(
  id: string,
  input: CategoryFormInput,
): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCategory(input);
    if (!v.ok) return { ok: false, error: v.error };
    const updated = await updateCategory(id, v.value, defaultCategoryDeps());
    revalidatePath("/admin/categorias");
    revalidatePath(`/admin/categorias/${id}`);
    return { ok: true, id: updated.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteCategoryAction(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    await deleteCategory(id, defaultCategoryDeps());
    revalidatePath("/admin/categorias");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
