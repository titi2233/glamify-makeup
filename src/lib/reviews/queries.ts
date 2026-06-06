import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReviewView } from "@/components/catalog/review-card";

export interface ReviewsSummary {
  reviews: ReviewView[];
  count: number;
  average: number;
}

export async function getApprovedReviews(productId: string): Promise<ReviewsSummary> {
  const rows = await prisma.review.findMany({
    where: { productId, status: "approved" },
    orderBy: { createdAt: "desc" },
    select: { id: true, authorName: true, rating: true, title: true, body: true, verifiedPurchase: true, createdAt: true },
  });
  const count = rows.length;
  const average = count === 0 ? 0 : rows.reduce((a, r) => a + r.rating, 0) / count;
  return { reviews: rows, count, average };
}
