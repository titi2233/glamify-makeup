import { slugify } from "@/lib/admin/slug";
import { isValidSkuPrefix } from "@/lib/admin/sku";

/** Lo que llega del formulario (todo string-ish; el form no conoce tipos de DB). */
export interface CategoryFormInput {
  name: string;
  slug: string;
  parentId: string | null;
  skuPrefix: string;
  order: string;
  active: boolean;
  image: string | null;
}

/** Datos ya validados y normalizados, listos para el servicio. */
export interface CategoryClean {
  name: string;
  slug: string;
  parentId: string | null;
  skuPrefix: string;
  order: number;
  active: boolean;
  image: string | null;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validación pura (sin DB). La unicidad del slug se chequea en el servicio. */
export function validateCategory(input: CategoryFormInput): Validated<CategoryClean> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre es obligatorio." };

  const slugSource = input.slug.trim() ? input.slug : name;
  const slug = slugify(slugSource);
  if (!slug) return { ok: false, error: "El slug no puede quedar vacío." };

  const skuPrefix = input.skuPrefix.trim().toUpperCase();
  if (!isValidSkuPrefix(skuPrefix)) {
    return { ok: false, error: "El prefijo de SKU debe tener 1 a 3 letras (A–Z)." };
  }

  const orderRaw = input.order.trim();
  const order = Number(orderRaw);
  if (orderRaw === "" || !Number.isInteger(order)) {
    return { ok: false, error: "El orden debe ser un número entero." };
  }
  if (order < 0) return { ok: false, error: "El orden no puede ser negativo." };

  const parentId = input.parentId && input.parentId.trim() ? input.parentId.trim() : null;
  const image = input.image && input.image.trim() ? input.image.trim() : null;

  return {
    ok: true,
    value: { name, slug, parentId, skuPrefix, order, active: input.active, image },
  };
}

/** Fila mínima del padre candidato (cargada por el servicio desde DB). */
export interface ParentRow {
  id: string;
  parentId: string | null;
}

/** Regla de dominio: el padre elegido debe ser una categoría raíz (máx 2 niveles). */
export function assertMaxTwoLevels(parent: ParentRow | null): Validated<true> {
  if (!parent) return { ok: false, error: "La categoría padre no existe." };
  if (parent.parentId !== null) {
    return { ok: false, error: "Solo se permiten dos niveles: la categoría elegida ya es una subcategoría." };
  }
  return { ok: true, value: true };
}
