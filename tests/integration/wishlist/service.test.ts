import { describe, it, expect, vi } from "vitest";
import { toggleWishlist, type WishlistDb } from "@/lib/wishlist/service";

function makeDb(exists: boolean) {
  return {
    wishlist: {
      findUnique: vi.fn(async () => (exists ? { customerId: "u1", productId: "p1" } : null)),
      create: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
  } as unknown as WishlistDb;
}

describe("toggleWishlist", () => {
  it("agrega cuando no existe", async () => {
    const db = makeDb(false);
    const res = await toggleWishlist("u1", "p1", { db });
    expect(res.added).toBe(true);
    expect(db.wishlist.create).toHaveBeenCalledWith({ data: { customerId: "u1", productId: "p1" } });
  });
  it("quita cuando ya existe", async () => {
    const db = makeDb(true);
    const res = await toggleWishlist("u1", "p1", { db });
    expect(res.added).toBe(false);
    expect(db.wishlist.delete).toHaveBeenCalledWith({ where: { customerId_productId: { customerId: "u1", productId: "p1" } } });
  });
});
