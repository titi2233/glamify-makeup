import { round2 } from "@/lib/money";
import { slugify } from "@/lib/admin/slug";

export interface ComboItemInput {
  variantId: string;
  qty: number;
}
export interface ComboFormInput {
  name: string;
  slug: string;
  description: string;
  comboPrice: number;
  images: string[];
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  items: ComboItemInput[];
}
export interface ComboClean {
  name: string;
  slug: string;
  description: string | null;
  comboPrice: number;
  images: string[];
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  items: ComboItemInput[];
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateCombo(input: ComboFormInput): Validated<ComboClean> {
  const name = input.name.trim();
  if (name.length === 0) return { ok: false, error: "Poné un nombre para el combo." };

  const slugSource = input.slug.trim().length > 0 ? input.slug : name;
  const slug = slugify(slugSource);
  if (slug.length === 0) return { ok: false, error: "El combo necesita un slug válido (usá letras o números)." };

  const description = input.description.trim().length > 0 ? input.description.trim() : null;

  if (!Number.isFinite(input.comboPrice) || input.comboPrice <= 0) {
    return { ok: false, error: "El precio del combo tiene que ser mayor a 0." };
  }
  const comboPrice = round2(input.comboPrice);

  const images = input.images.map((i) => i.trim()).filter((i) => i.length > 0);

  if (input.items.length === 0) {
    return { ok: false, error: "El combo tiene que tener al menos un producto." };
  }
  const seen = new Set<string>();
  const items: ComboItemInput[] = [];
  for (const raw of input.items) {
    const variantId = raw.variantId.trim();
    if (variantId.length === 0) return { ok: false, error: "Elegí un producto para cada renglón del combo." };
    if (!Number.isInteger(raw.qty) || raw.qty < 1) {
      return { ok: false, error: "Cada producto del combo tiene que llevar cantidad 1 o más." };
    }
    if (seen.has(variantId)) {
      return { ok: false, error: "No repitas el mismo producto en el combo; subí la cantidad." };
    }
    seen.add(variantId);
    items.push({ variantId, qty: raw.qty });
  }

  if (input.validFrom && input.validTo && input.validTo < input.validFrom) {
    return { ok: false, error: "La fecha de fin no puede ser anterior a la de inicio." };
  }

  return {
    ok: true,
    value: { name, slug, description, comboPrice, images, active: input.active, validFrom: input.validFrom, validTo: input.validTo, items },
  };
}
