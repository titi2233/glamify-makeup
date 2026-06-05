import { prisma } from "@/lib/prisma";
import { assertMaxTwoLevels, type CategoryClean } from "@/lib/admin/categories/validation";

/** Superficie mínima de Prisma que usa el servicio (para inyectar fakes en tests). */
export interface CategoryDb {
  category: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; parentId: true };
    }) => Promise<{ id: string; parentId: string | null } | null>;
    findFirst: (args: {
      where: { slug: string; id?: { not: string } };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: { data: CategoryCreateData }) => Promise<{ id: string }>;
    update: (args: { where: { id: string }; data: CategoryUpdateData }) => Promise<{ id: string }>;
    delete: (args: { where: { id: string } }) => Promise<{ id: string }>;
    count: (args: { where: { parentId: string } }) => Promise<number>;
  };
  product: {
    count: (args: { where: { categoryId: string } }) => Promise<number>;
  };
}

export interface CategoryCreateData {
  name: string;
  slug: string;
  parentId: string | null;
  skuPrefix: string;
  order: number;
  active: boolean;
  image: string | null;
}
export type CategoryUpdateData = CategoryCreateData;

export interface CategoryServiceDeps {
  db: CategoryDb;
}

export function defaultCategoryDeps(): CategoryServiceDeps {
  return { db: prisma as unknown as CategoryDb };
}

/** Chequea unicidad de slug; `exceptId` excluye la propia fila al editar. */
async function ensureSlugFree(db: CategoryDb, slug: string, exceptId?: string): Promise<void> {
  const where = exceptId ? { slug, id: { not: exceptId } } : { slug };
  const hit = await db.category.findFirst({ where, select: { id: true } });
  if (hit) throw new Error("Ya existe una categoría con ese slug.");
}

/** Verifica que el padre exista y sea raíz (máx 2 niveles). */
async function ensureValidParent(db: CategoryDb, parentId: string): Promise<void> {
  const parent = await db.category.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });
  const check = assertMaxTwoLevels(parent);
  if (!check.ok) throw new Error(check.error);
}

function toData(input: CategoryClean): CategoryCreateData {
  return {
    name: input.name,
    slug: input.slug,
    parentId: input.parentId,
    skuPrefix: input.skuPrefix,
    order: input.order,
    active: input.active,
    image: input.image,
  };
}

export async function createCategory(
  input: CategoryClean,
  deps: CategoryServiceDeps,
): Promise<{ id: string }> {
  await ensureSlugFree(deps.db, input.slug);
  if (input.parentId) await ensureValidParent(deps.db, input.parentId);
  const created = await deps.db.category.create({ data: toData(input) });
  return { id: created.id };
}

export async function updateCategory(
  id: string,
  input: CategoryClean,
  deps: CategoryServiceDeps,
): Promise<{ id: string }> {
  if (input.parentId === id) {
    throw new Error("Una categoría no puede ser su propia categoría padre.");
  }
  await ensureSlugFree(deps.db, input.slug, id);
  if (input.parentId) await ensureValidParent(deps.db, input.parentId);
  const updated = await deps.db.category.update({ where: { id }, data: toData(input) });
  return { id: updated.id };
}

export async function deleteCategory(id: string, deps: CategoryServiceDeps): Promise<void> {
  const products = await deps.db.product.count({ where: { categoryId: id } });
  if (products > 0) throw new Error("No se puede borrar: la categoría tiene productos.");
  const children = await deps.db.category.count({ where: { parentId: id } });
  if (children > 0) throw new Error("No se puede borrar: la categoría tiene subcategorías.");
  await deps.db.category.delete({ where: { id } });
}
