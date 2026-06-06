import type { ReviewStatus } from "@prisma/client";

/**
 * Decide la visibilidad de una reseña recién creada (blueprint 06 §4):
 * la compra verificada se auto-publica; el resto entra a la cola de moderación.
 */
export function classifyReview(hasPurchased: boolean): { status: ReviewStatus; verifiedPurchase: boolean } {
  return hasPurchased
    ? { status: "approved", verifiedPurchase: true }
    : { status: "pending", verifiedPurchase: false };
}
