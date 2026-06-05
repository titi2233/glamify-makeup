import { round2 } from "@/lib/money";

export type CouponType = "percentage" | "fixed" | "free_shipping";
export type CouponScope = "all" | "category" | "product";

/** Lo que llega del form (todo string salvo `active`/enums) antes de validar. */
export interface CouponFormInput {
  code: string;
  type: CouponType;
  value: string;
  scope: CouponScope;
  scopeId: string;
  minSubtotal: string;
  maxUses: string;
  perCustomerLimit: string;
  validFrom: string;
  validTo: string;
  active: boolean;
}

/** Datos limpios listos para persistir. */
export interface CouponClean {
  code: string;
  type: CouponType;
  value: number;
  scope: CouponScope;
  scopeId: string | null;
  minSubtotal: number | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  active: boolean;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const CODE_RE = /^[A-Z0-9-]+$/;

function parseOptionalNumber(raw: string): { ok: true; value: number | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false };
  return { ok: true, value: n };
}

function parseOptionalInt(raw: string): { ok: true; value: number | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1) return { ok: false };
  return { ok: true, value: n };
}

function parseOptionalDate(raw: string): { ok: true; value: Date | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return { ok: false };
  return { ok: true, value: d };
}

/**
 * Valida y normaliza un cupón. Pura, sin DB.
 * NOTA: se llama `validateCouponInput` para no chocar con `validateCoupon` de `@/lib/coupons/apply`.
 * La unicidad del `code` se chequea en el servicio contra la DB.
 */
export function validateCouponInput(input: CouponFormInput): Validated<CouponClean> {
  const code = input.code.trim().toUpperCase();
  if (code === "") return { ok: false, error: "Poné un código para el cupón." };
  if (!CODE_RE.test(code)) {
    return { ok: false, error: "El código solo puede tener letras, números y guiones." };
  }

  // value según type
  let value: number;
  if (input.type === "free_shipping") {
    value = 0; // se ignora lo ingresado
  } else {
    const v = Number(input.value.trim());
    if (!Number.isFinite(v)) return { ok: false, error: "Poné un valor numérico para el descuento." };
    if (input.type === "percentage") {
      if (v < 1 || v > 100) return { ok: false, error: "El porcentaje tiene que estar entre 1 y 100." };
    } else {
      if (v <= 0) return { ok: false, error: "El monto fijo tiene que ser mayor a 0." };
    }
    value = round2(v);
  }

  // scope + scopeId
  let scopeId: string | null;
  if (input.scope === "all") {
    scopeId = null;
  } else {
    const id = input.scopeId.trim();
    if (id === "") {
      return { ok: false, error: "Elegí a qué categoría o producto aplica el cupón." };
    }
    scopeId = id;
  }

  const minRes = parseOptionalNumber(input.minSubtotal);
  if (!minRes.ok || (minRes.value != null && minRes.value < 0)) {
    return { ok: false, error: "El mínimo de compra tiene que ser un número ≥ 0." };
  }

  const maxUsesRes = parseOptionalInt(input.maxUses);
  if (!maxUsesRes.ok) return { ok: false, error: "El máximo de usos tiene que ser un número entero ≥ 1." };

  const perCustomerRes = parseOptionalInt(input.perCustomerLimit);
  if (!perCustomerRes.ok) {
    return { ok: false, error: "El límite por clienta tiene que ser un número entero ≥ 1." };
  }

  const fromRes = parseOptionalDate(input.validFrom);
  if (!fromRes.ok) return { ok: false, error: "La fecha de inicio no es válida." };
  const toRes = parseOptionalDate(input.validTo);
  if (!toRes.ok) return { ok: false, error: "La fecha de fin no es válida." };
  if (fromRes.value && toRes.value && fromRes.value > toRes.value) {
    return { ok: false, error: "La fecha de inicio no puede ser posterior a la de fin." };
  }

  return {
    ok: true,
    value: {
      code,
      type: input.type,
      value,
      scope: input.scope,
      scopeId,
      minSubtotal: minRes.value != null ? round2(minRes.value) : null,
      maxUses: maxUsesRes.value,
      perCustomerLimit: perCustomerRes.value,
      validFrom: fromRes.value,
      validTo: toRes.value,
      active: input.active,
    },
  };
}
