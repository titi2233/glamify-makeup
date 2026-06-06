import { describe, it, expect, vi } from "vitest";
import { createReview, type CreateReviewDb } from "@/lib/reviews/service";

function makeDb(opts: { purchased: boolean; already?: boolean }) {
  return {
    orderItem: {
      findMany: vi.fn(async () => (opts.purchased ? [{ productId: "p1" }] : [])),
    },
    review: {
      findUnique: vi.fn(async () => (opts.already ? { id: "r0" } : null)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "r1", ...data })),
    },
  } as unknown as CreateReviewDb;
}

const base = {
  customerId: "u1", customerName: "Ana", customerEmail: "ana@x.com",
  productId: "p1", rating: 5, title: "Top", body: "Hermoso",
};

describe("createReview", () => {
  it("crea reseña verificada y aprobada si compró", async () => {
    const db = makeDb({ purchased: true });
    const res = await createReview(base, { db });
    expect(res.id).toBe("r1");
    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "approved", verifiedPurchase: true, authorName: "Ana", rating: 5 }),
    }));
  });
  it("rechaza si no compró", async () => {
    const db = makeDb({ purchased: false });
    await expect(createReview(base, { db })).rejects.toThrow(/compr/i);
  });
  it("rechaza si ya reseñó", async () => {
    const db = makeDb({ purchased: true, already: true });
    await expect(createReview(base, { db })).rejects.toThrow(/ya dejaste/i);
  });
  it("rechaza input inválido", async () => {
    const db = makeDb({ purchased: true });
    await expect(createReview({ ...base, rating: 9 }, { db })).rejects.toThrow(/puntaje/i);
  });
});
