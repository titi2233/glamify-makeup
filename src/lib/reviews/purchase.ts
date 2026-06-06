/** Pura: ¿alguna línea comprada corresponde a este producto? */
export function hasPurchased(items: { productId: string }[], productId: string): boolean {
  return items.some((it) => it.productId === productId);
}
