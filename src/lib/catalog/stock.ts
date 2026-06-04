export type StockState = "in_stock" | "low_stock" | "out_of_stock";

export interface StockableVariant {
  stock: number;
  lowStockThreshold: number;
  active?: boolean;
}

/** Estado de una variante individual. */
export function getStockState(variant: StockableVariant): StockState {
  if (variant.stock <= 0) return "out_of_stock";
  if (variant.stock <= variant.lowStockThreshold) return "low_stock";
  return "in_stock";
}

/** Estado agregado del producto sobre sus variantes activas. */
export function getProductStockState(variants: StockableVariant[]): StockState {
  const usable = variants.filter((v) => v.active !== false);
  if (usable.length === 0) return "out_of_stock";
  const states = usable.map(getStockState);
  if (states.includes("in_stock")) return "in_stock";
  if (states.includes("low_stock")) return "low_stock";
  return "out_of_stock";
}

/** Etiqueta legible (datos reales — "no humo"). */
export function stockLabel(state: StockState, stock?: number): string {
  switch (state) {
    case "in_stock":
      return "Disponible";
    case "low_stock":
      return stock !== undefined ? `Quedan ${stock}` : "Bajo stock";
    case "out_of_stock":
      return "Sin stock";
  }
}

export function isAvailable(variants: StockableVariant[]): boolean {
  return getProductStockState(variants) !== "out_of_stock";
}
