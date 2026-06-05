/** Número de pedido humano (blueprint 01 §2): GLM-000123 (padding mínimo 6). */
export function formatOrderNumber(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Secuencia de pedido inválida: ${seq}`);
  return `GLM-${String(seq).padStart(6, "0")}`;
}
