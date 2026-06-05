import { prisma } from "@/lib/prisma";
import type { ComboClean } from "@/lib/admin/combos/validation";

/** Superficie mínima del cliente transaccional usada dentro de `$transaction`. */
export interface ComboTx {
  combo: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  comboItem: {
    deleteMany: (args: { where: { comboId: string } }) => Promise<{ count: number }>;
    createMany: (args: { data: Array<{ comboId: string; variantId: string; qty: number }> }) => Promise<{ count: number }>;
  };
}

/** Superficie mínima de Prisma usada por el servicio (para inyectar fakes en tests). */
export interface ComboDb {
  combo: {
    findUnique: (args: { where: { slug: string }; select: { id: true } }) => Promise<{ id: string } | null>;
    delete: (args: { where: { id: string } }) => Promise<{ id: string }>;
  };
  $transaction: <T>(fn: (tx: ComboTx) => Promise<T>) => Promise<T>;
}
export interface CreateComboDeps {
  db: ComboDb;
}

export function defaultComboDeps(): CreateComboDeps {
  return { db: prisma as unknown as ComboDb };
}

/** Lanza si el slug ya está tomado por OTRO combo (o cualquiera, si ignoreId es undefined). */
async function assertSlugFree(db: ComboDb, slug: string, ignoreId?: string): Promise<void> {
  const existing = await db.combo.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== ignoreId) {
    throw new Error("Ya existe un combo con ese slug.");
  }
}

export async function createCombo(input: ComboClean, deps: CreateComboDeps): Promise<{ id: string }> {
  await assertSlugFree(deps.db, input.slug);
  const created = await deps.db.$transaction(async (tx) => {
    return tx.combo.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        comboPrice: input.comboPrice,
        images: input.images,
        active: input.active,
        validFrom: input.validFrom,
        validTo: input.validTo,
        items: { create: input.items.map((i) => ({ variantId: i.variantId, qty: i.qty })) },
      },
    });
  });
  return { id: created.id };
}

export async function updateCombo(id: string, input: ComboClean, deps: CreateComboDeps): Promise<{ id: string }> {
  await assertSlugFree(deps.db, input.slug, id);
  const updated = await deps.db.$transaction(async (tx) => {
    const combo = await tx.combo.update({
      where: { id },
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        comboPrice: input.comboPrice,
        images: input.images,
        active: input.active,
        validFrom: input.validFrom,
        validTo: input.validTo,
      },
    });
    await tx.comboItem.deleteMany({ where: { comboId: id } });
    await tx.comboItem.createMany({
      data: input.items.map((i) => ({ comboId: id, variantId: i.variantId, qty: i.qty })),
    });
    return combo;
  });
  return { id: updated.id };
}

export async function deleteCombo(id: string, deps: CreateComboDeps): Promise<void> {
  await deps.db.combo.delete({ where: { id } });
}
