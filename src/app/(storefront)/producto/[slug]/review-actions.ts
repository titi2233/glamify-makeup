"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/customer/auth";
import { createReview } from "@/lib/reviews/service";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/forms/action-result";

export async function createReviewAction(input: {
  productId: string; slug: string; rating: number; title: string; body: string;
}): Promise<ActionResult> {
  const customer = await requireCustomer();
  try {
    await createReview(
      {
        customerId: customer.id, customerName: customer.name, customerEmail: customer.email,
        productId: input.productId, rating: Number(input.rating), title: input.title, body: input.body,
      },
      { db: prisma as never },
    );
    revalidatePath(`/producto/${input.slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo publicar la reseña." };
  }
}
