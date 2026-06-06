import { PLACEHOLDER_PREFIX, businessInfo } from "./business-info";

/** Devuelve las claves cuyo valor string aún contiene un placeholder [COMPLETAR. */
export function findIncompletePlaceholders(
  info: Record<string, unknown> = businessInfo,
): string[] {
  return Object.entries(info)
    .filter(([, v]) => typeof v === "string" && v.includes(PLACEHOLDER_PREFIX))
    .map(([k]) => k);
}
