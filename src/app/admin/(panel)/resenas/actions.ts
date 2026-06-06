"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { moderateReview } from "@/lib/reviews/service";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/forms/action-result";

async function moderate(id: string, action: "approve" | "reject", slug: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await moderateReview(id, action, { db: prisma as never });
    revalidatePath("/admin/resenas");
    revalidatePath(`/producto/${slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo moderar la reseña." };
  }
}

export async function approveReviewAction(id: string, slug: string): Promise<ActionResult> {
  return moderate(id, "approve", slug);
}

export async function rejectReviewAction(id: string, slug: string): Promise<ActionResult> {
  return moderate(id, "reject", slug);
}
