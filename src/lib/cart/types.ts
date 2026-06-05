/**
 * Línea de carrito "resuelta" a números para cálculos puros (sin DB ni red).
 * - variante: `refId` = variantId; `components` undefined.
 * - combo: `refId` = comboId; `components` = variantes a descontar (qty por unidad de combo).
 */
export interface CartLine {
  /** id de la línea (cartItemId en runtime; arbitrario en tests). */
  id: string;
  kind: "variant" | "combo";
  refId: string;
  /** Precio unitario efectivo en ARS (variante: priceOverride??basePrice; combo: comboPrice). */
  unitPrice: number;
  qty: number;
  /** Peso unitario en gramos (para cotizar envío). */
  weightGr: number;
  /** Metadata para cupones scope product/category (solo variantes; null en combos). */
  productId?: string | null;
  categoryId?: string | null;
  /** Solo combos: componentes para descuento de stock. */
  components?: Array<{ variantId: string; qty: number }>;
}
