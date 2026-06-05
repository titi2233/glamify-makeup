/**
 * Genera un slug URL-safe a partir de un nombre (M3 admin).
 * minúsculas → saca acentos/ñ → todo lo no [a-z0-9] pasa a guion → colapsa y recorta.
 * Pura, sin DB: la unicidad la chequea el servicio contra la base.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca tildes (incluye la tilde de la ñ → n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // cualquier cosa rara → guion
    .replace(/-+/g, "-") // colapsa guiones repetidos
    .replace(/^-+|-+$/g, ""); // recorta guiones de los extremos
}
