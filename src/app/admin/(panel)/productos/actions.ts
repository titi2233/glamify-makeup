"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { validateProduct, type ProductFormInput } from "@/lib/admin/products/validation";
import { createProduct, updateProduct, softDeleteProduct, defaultProductDeps } from "@/lib/admin/products/service";
import { uploadProductImage } from "@/lib/admin/products/images";

export async function createProductAction(input: ProductFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateProduct(input);
    if (!v.ok) return { ok: false, error: v.error };
    const { id } = await createProduct(v.value, defaultProductDeps());
    revalidatePath("/admin/productos");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el producto." };
  }
}

export async function updateProductAction(id: string, input: ProductFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateProduct(input);
    if (!v.ok) return { ok: false, error: v.error };
    const res = await updateProduct(id, v.value, defaultProductDeps());
    revalidatePath("/admin/productos");
    revalidatePath(`/admin/productos/${id}`);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el producto." };
  }
}

export async function deleteProductAction(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    await softDeleteProduct(id, defaultProductDeps());
    revalidatePath("/admin/productos");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo eliminar el producto." };
  }
}

export interface UploadImageResult extends AdminResult {
  path?: string;
}

export async function uploadProductImageAction(formData: FormData): Promise<UploadImageResult> {
  try {
    await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí una imagen para subir." };
    const { path } = await uploadProductImage(file);
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo subir la imagen." };
  }
}

export async function createAndRedirectProductAction(input: ProductFormInput): Promise<AdminResult> {
  const res = await createProductAction(input);
  if (res.ok) redirect("/admin/productos");
  return res;
}
