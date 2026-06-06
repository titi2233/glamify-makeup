/** Constancia humana del botón de arrepentimiento: ARR-000123. */
export function formatRetractionTicket(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Secuencia inválida: ${seq}`);
  return `ARR-${String(seq).padStart(6, "0")}`;
}
