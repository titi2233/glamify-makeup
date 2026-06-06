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

export interface ModerationItem {
  id: string;
  productName: string;
  productSlug: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  createdAt: Date;
}

/** Cola de moderación: reseñas pendientes con su producto (blueprint 06 §4). */
export async function getModerationQueue(): Promise<ModerationItem[]> {
  const rows = await prisma.review.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, authorName: true, rating: true, title: true, body: true, verifiedPurchase: true, createdAt: true,
      product: { select: { name: true, slug: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    productName: r.product.name,
    productSlug: r.product.slug,
    authorName: r.authorName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verifiedPurchase: r.verifiedPurchase,
    createdAt: r.createdAt,
  }));
}
