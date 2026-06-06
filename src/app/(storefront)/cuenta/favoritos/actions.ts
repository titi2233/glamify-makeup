"use server";

import { revalidatePath } from "next/cache";
import { getCustomer } from "@/lib/customer/auth";
import { toggleWishlist } from "@/lib/wishlist/service";
import { prisma } from "@/lib/prisma";

export interface WishlistToggleResult {
  ok: boolean;
  added?: boolean;
  needsAuth?: boolean;
  error?: string;
}

export async function toggleWishlistAction(productId: string): Promise<WishlistToggleResult> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, needsAuth: true };
  try {
    const res = await toggleWishlist(customer.id, productId, { db: prisma as never });
    revalidatePath("/cuenta/favoritos");
    return { ok: true, added: res.added };
  } catch {
    return { ok: false, error: "No se pudo actualizar favoritos." };
  }
}

export async function isWishlisted(productId: string): Promise<boolean> {
  const customer = await getCustomer();
  if (!customer) return false;
  const row = await prisma.wishlist.findUnique({
    where: { customerId_productId: { customerId: customer.id, productId } },
  });
  return Boolean(row);
}
