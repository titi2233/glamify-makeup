import "server-only";
import { hasPurchased } from "@/lib/reviews/purchase";
import { validateReview } from "@/lib/reviews/validation";

const PURCHASED_STATUSES = ["paid", "preparing", "shipped", "delivered"] as const;

export interface CreateReviewDb {
  orderItem: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: { variant: { select: { productId: true } } };
    }) => Promise<Array<{ variant: { productId: string } | null }> | Array<{ productId: string }>>;
  };
  review: {
    findUnique: (args: { where: { customerId_productId: { customerId: string; productId: string } } }) => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

export interface CreateReviewInput {
  customerId: string;
  customerName: string | null;
  customerEmail: string;
  productId: string;
  rating: number;
  title?: string | null;
  body: string;
}

export async function createReview(input: CreateReviewInput, deps: { db: CreateReviewDb }): Promise<{ id: string }> {
  const valid = validateReview({ rating: input.rating, title: input.title, body: input.body });
  if (!valid.ok) throw new Error(valid.reason);

  // Una reseña por clienta por producto.
  const existing = await deps.db.review.findUnique({
    where: { customerId_productId: { customerId: input.customerId, productId: input.productId } },
  });
  if (existing) throw new Error("Ya dejaste tu reseña para este producto.");

  // Verificación de compra.
  const rows = await deps.db.orderItem.findMany({
    where: {
      order: { customerId: input.customerId, status: { in: [...PURCHASED_STATUSES] } },
      variant: { productId: input.productId },
    },
    select: { variant: { select: { productId: true } } },
  });
  const items = (rows as Array<{ variant: { productId: string } | null }>).map((r) =>
    "productId" in r ? (r as unknown as { productId: string }) : { productId: r.variant?.productId ?? "" },
  );
  if (!hasPurchased(items, input.productId)) {
    throw new Error("Solo quienes compraron este producto pueden reseñarlo.");
  }

  return deps.db.review.create({
    data: {
      productId: input.productId,
      customerId: input.customerId,
      authorName: input.customerName ?? input.customerEmail,
      rating: input.rating,
      title: input.title?.trim() || null,
      body: input.body.trim(),
      verifiedPurchase: true,
      status: "approved",
    },
  });
}
