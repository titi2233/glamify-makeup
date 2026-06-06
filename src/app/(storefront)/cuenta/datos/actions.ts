"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/customer/auth";
import { updateProfile } from "@/lib/customer/profile";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/forms/action-result";

export async function updateProfileAction(input: { name: string; phone: string }): Promise<ActionResult> {
  const customer = await requireCustomer();
  const res = await updateProfile(customer.id, input, { db: prisma as never });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/cuenta/datos");
  return { ok: true };
}
