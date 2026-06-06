"use server";

import { revalidatePath } from "next/cache";
import { getCustomer } from "@/lib/customer/auth";
import { createReview } from "@/lib/reviews/service";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/forms/action-result";

export interface ReviewActionResult extends ActionResult {
  status?: string;
}

export async function createReviewAction(input: {
  productId: string;
  slug: string;
  rating: number;
  title: string;
  body: string;
  authorName?: string;
  website?: string; // honeypot anti-spam: debe llegar vacío
}): Promise<ReviewActionResult> {
  // Bot: campo trampa completado → fingimos éxito sin crear nada.
  if (input.website && input.website.trim() !== "") return { ok: true, status: "pending" };

  const customer = await getCustomer();
  try {
    const res = await createReview(
      {
        customerId: customer?.id ?? null,
        authorName: customer ? (customer.name ?? customer.email) : (input.authorName ?? "").trim(),
        productId: input.productId,
        rating: Number(input.rating),
        title: input.title,
        body: input.body,
      },
      { db: prisma as never },
    );
    revalidatePath(`/producto/${input.slug}`);
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo enviar la reseña." };
  }
}
