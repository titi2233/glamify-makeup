import "server-only";
import { hasPurchased } from "@/lib/reviews/purchase";
import { validateReview } from "@/lib/reviews/validation";
import { classifyReview } from "@/lib/reviews/moderation";

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
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

export interface CreateReviewInput {
  customerId: string | null;
  /** Nombre a mostrar: logueada → name ?? email; invitada → nombre del form. */
  authorName: string;
  productId: string;
  rating: number;
  title?: string | null;
  body: string;
}

/**
 * Crea una reseña. Logueada que compró → auto-aprobada con badge; logueada sin compra o
 * invitada → entra a la cola de moderación (pending). Una reseña por clienta por producto.
 */
export async function createReview(input: CreateReviewInput, deps: { db: CreateReviewDb }): Promise<{ id: string; status: string }> {
  const valid = validateReview({
    rating: input.rating,
    title: input.title,
    body: input.body,
    authorName: input.customerId == null ? input.authorName : undefined,
  });
  if (!valid.ok) throw new Error(valid.reason);

  let purchased = false;
  if (input.customerId != null) {
    const existing = await deps.db.review.findUnique({
      where: { customerId_productId: { customerId: input.customerId, productId: input.productId } },
    });
    if (existing) throw new Error("Ya dejaste tu reseña para este producto.");

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
    purchased = hasPurchased(items, input.productId);
  }

  const { status, verifiedPurchase } = classifyReview(purchased);
  const created = await deps.db.review.create({
    data: {
      productId: input.productId,
      customerId: input.customerId,
      authorName: input.authorName,
      rating: input.rating,
      title: input.title?.trim() || null,
      body: input.body.trim(),
      verifiedPurchase,
      status,
    },
  });
  return { id: created.id, status };
}

export type ModerationAction = "approve" | "reject";

/** Aprueba o rechaza una reseña pendiente desde el panel. */
export async function moderateReview(
  id: string,
  action: ModerationAction,
  deps: { db: Pick<CreateReviewDb, "review"> },
): Promise<{ id: string }> {
  return deps.db.review.update({
    where: { id },
    data: { status: action === "approve" ? "approved" : "rejected" },
  });
}
