import { prisma } from "@/lib/prisma";
import type { CouponClean } from "@/lib/admin/coupons/validation";

/** Superficie mínima de DB que usa el servicio (para inyectar fakes en tests). */
export interface CouponDb {
  coupon: {
    findUnique: (args: { where: { code: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: CouponData }) => Promise<{ id: string }>;
    update: (args: { where: { id: string }; data: CouponData }) => Promise<{ id: string }>;
    delete: (args: { where: { id: string } }) => Promise<{ id: string }>;
  };
}

export interface CreateCouponDeps {
  db: CouponDb;
}

export function defaultCouponDeps(): CreateCouponDeps {
  return { db: prisma as unknown as CouponDb };
}

/** Payload de persistencia (mapea 1:1 al modelo Coupon de Prisma). */
interface CouponData {
  code: string;
  type: CouponClean["type"];
  value: number;
  scope: CouponClean["scope"];
  scopeId: string | null;
  minSubtotal: number | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  active: boolean;
}

function toData(input: CouponClean): CouponData {
  return {
    code: input.code,
    type: input.type,
    value: input.value,
    scope: input.scope,
    scopeId: input.scopeId,
    minSubtotal: input.minSubtotal,
    maxUses: input.maxUses,
    perCustomerLimit: input.perCustomerLimit,
    validFrom: input.validFrom,
    validTo: input.validTo,
    active: input.active,
  };
}

/** Crea un cupón. Lanza si el código ya existe (la unicidad va acá, no en el validador). */
export async function createCoupon(input: CouponClean, deps: CreateCouponDeps): Promise<{ id: string }> {
  const existing = await deps.db.coupon.findUnique({ where: { code: input.code } });
  if (existing) throw new Error("Ya existe un cupón con ese código.");
  const created = await deps.db.coupon.create({ data: toData(input) });
  return { id: created.id };
}

/** Actualiza un cupón. El código solo puede chocar consigo mismo. */
export async function updateCoupon(id: string, input: CouponClean, deps: CreateCouponDeps): Promise<{ id: string }> {
  const existing = await deps.db.coupon.findUnique({ where: { code: input.code } });
  if (existing && existing.id !== id) throw new Error("Ya existe otro cupón con ese código.");
  const updated = await deps.db.coupon.update({ where: { id }, data: toData(input) });
  return { id: updated.id };
}

/** Borra un cupón por id. */
export async function deleteCoupon(id: string, deps: CreateCouponDeps): Promise<{ id: string }> {
  const deleted = await deps.db.coupon.delete({ where: { id } });
  return { id: deleted.id };
}
