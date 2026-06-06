export interface ReviewInput {
  rating: number;
  title?: string | null;
  body: string;
}
export type ReviewValidation = { ok: true } | { ok: false; reason: string };

export function validateReview(input: ReviewInput): ReviewValidation {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, reason: "El puntaje debe ser de 1 a 5." };
  }
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Escribí tu reseña." };
  if (body.length > 2000) return { ok: false, reason: "La reseña es demasiado larga (máx 2000)." };
  if (input.title && input.title.trim().length > 120) {
    return { ok: false, reason: "El título es demasiado largo (máx 120)." };
  }
  return { ok: true };
}
