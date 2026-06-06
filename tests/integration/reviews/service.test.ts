import { describe, it, expect, vi } from "vitest";
import { createReview, moderateReview, type CreateReviewDb } from "@/lib/reviews/service";

function makeDb(opts: { purchased: boolean; already?: boolean }) {
  return {
    orderItem: {
      findMany: vi.fn(async () => (opts.purchased ? [{ productId: "p1" }] : [])),
    },
    review: {
      findUnique: vi.fn(async () => (opts.already ? { id: "r0" } : null)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "r1", ...data })),
      update: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
    },
  } as unknown as CreateReviewDb;
}

const loggedIn = {
  customerId: "u1", authorName: "Ana",
  productId: "p1", rating: 5, title: "Top", body: "Hermoso",
};

describe("createReview", () => {
  it("logueada que compró → aprobada + verificada", async () => {
    const db = makeDb({ purchased: true });
    const res = await createReview(loggedIn, { db });
    expect(res).toEqual({ id: "r1", status: "approved" });
    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "approved", verifiedPurchase: true, authorName: "Ana", rating: 5 }),
    }));
  });

  it("logueada que NO compró → pending (ya no rechaza)", async () => {
    const db = makeDb({ purchased: false });
    const res = await createReview(loggedIn, { db });
    expect(res.status).toBe("pending");
    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "pending", verifiedPurchase: false }),
    }));
  });

  it("invitada (sin customerId) → pending, sin chequeo de unique ni de compra", async () => {
    const db = makeDb({ purchased: false });
    const res = await createReview({ customerId: null, authorName: "Caro", productId: "p1", rating: 4, body: "Lindo" }, { db });
    expect(res.status).toBe("pending");
    expect(db.review.findUnique).not.toHaveBeenCalled();
    expect(db.orderItem.findMany).not.toHaveBeenCalled();
    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: null, authorName: "Caro", status: "pending", verifiedPurchase: false }),
    }));
  });

  it("invitada sin nombre → inválida", async () => {
    const db = makeDb({ purchased: false });
    await expect(createReview({ customerId: null, authorName: "", productId: "p1", rating: 4, body: "Lindo" }, { db })).rejects.toThrow(/nombre/i);
  });

  it("logueada que ya reseñó → rechaza", async () => {
    const db = makeDb({ purchased: true, already: true });
    await expect(createReview(loggedIn, { db })).rejects.toThrow(/ya dejaste/i);
  });

  it("rechaza input inválido (rating)", async () => {
    const db = makeDb({ purchased: true });
    await expect(createReview({ ...loggedIn, rating: 9 }, { db })).rejects.toThrow(/puntaje/i);
  });
});

describe("moderateReview", () => {
  it("approve → status approved", async () => {
    const db = makeDb({ purchased: false });
    await moderateReview("r9", "approve", { db });
    expect(db.review.update).toHaveBeenCalledWith({ where: { id: "r9" }, data: { status: "approved" } });
  });
  it("reject → status rejected", async () => {
    const db = makeDb({ purchased: false });
    await moderateReview("r9", "reject", { db });
    expect(db.review.update).toHaveBeenCalledWith({ where: { id: "r9" }, data: { status: "rejected" } });
  });
});
