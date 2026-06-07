/** Constancia humana del botón de arrepentimiento: ARR-000123. */
export function formatRetractionTicket(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Secuencia inválida: ${seq}`);
  return `ARR-${String(seq).padStart(6, "0")}`;
}

/** Fecha/hora de la constancia, en es-AR y huso horario de Argentina. */
export function formatRetractionDate(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}
