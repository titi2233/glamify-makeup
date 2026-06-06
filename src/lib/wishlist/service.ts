import "server-only";

export interface WishlistDb {
  wishlist: {
    findUnique: (args: { where: { customerId_productId: { customerId: string; productId: string } } }) => Promise<{ customerId: string } | null>;
    create: (args: { data: { customerId: string; productId: string } }) => Promise<unknown>;
    delete: (args: { where: { customerId_productId: { customerId: string; productId: string } } }) => Promise<unknown>;
  };
}

export async function toggleWishlist(
  customerId: string,
  productId: string,
  deps: { db: WishlistDb },
): Promise<{ added: boolean }> {
  const key = { customerId_productId: { customerId, productId } };
  const existing = await deps.db.wishlist.findUnique({ where: key });
  if (existing) {
    await deps.db.wishlist.delete({ where: key });
    return { added: false };
  }
  await deps.db.wishlist.create({ data: { customerId, productId } });
  return { added: true };
}
