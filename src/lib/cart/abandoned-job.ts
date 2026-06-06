import { findAbandonedCarts, type AbandonedCartRow } from "@/lib/cart/abandoned";
import { abandonedCartEmail } from "@/lib/email/templates";
import type { SendEmailInput, SendEmailResult } from "@/lib/email/resend";

interface JobCartItem {
  qty: number;
  unitPriceSnapshot: number | string;
  variant: { product: { name: string }; name: string } | null;
  combo: { name: string } | null;
}
interface JobCart {
  id: string;
  updatedAt: Date;
  abandonedEmailSentAt: Date | null;
  contactEmail: string | null;
  recoveryEmailConsent: boolean;
  customer: { email: string; name: string | null; marketingConsent: boolean } | null;
  items: JobCartItem[];
}

export interface AbandonedJobDb {
  cart: {
    findMany: (args: Record<string, unknown>) => Promise<JobCart[]>;
    update: (args: { where: { id: string }; data: { abandonedEmailSentAt: Date } }) => Promise<unknown>;
  };
}

export interface AbandonedJobDeps {
  db: AbandonedJobDb;
  sendEmail: (input: SendEmailInput) => Promise<SendEmailResult>;
  now: Date;
  appUrl: string;
  idleHours?: number;
  batch?: number;
}

function normalize(c: JobCart): { row: AbandonedCartRow; email: string | null; name: string | null } {
  const email = c.customer ? c.customer.email : c.contactEmail;
  const consent = c.customer ? c.customer.marketingConsent : c.recoveryEmailConsent;
  const name = c.customer ? c.customer.name : null;
  return {
    row: { cartId: c.id, email, consent, updatedAt: c.updatedAt, itemCount: c.items.length, abandonedEmailSentAt: c.abandonedEmailSentAt },
    email,
    name,
  };
}

export async function runAbandonedCartJob(deps: AbandonedJobDeps): Promise<{ sent: number }> {
  const idleHours = deps.idleHours ?? 24;
  const cutoff = new Date(deps.now.getTime() - idleHours * 3600_000);
  const carts = await deps.db.cart.findMany({
    where: { status: "active", abandonedEmailSentAt: null, updatedAt: { lte: cutoff } },
    include: { customer: true, items: { include: { variant: { include: { product: true } }, combo: true } } },
    take: deps.batch ?? 50,
  });

  const normalized = carts.map(normalize);
  const eligibleIds = new Set(findAbandonedCarts(normalized.map((n) => n.row), deps.now, idleHours));

  let sent = 0;
  for (const n of normalized) {
    if (!eligibleIds.has(n.row.cartId) || !n.email) continue;
    const cart = carts.find((c) => c.id === n.row.cartId)!;
    const items = cart.items.map((it) => ({
      name: it.combo ? it.combo.name : it.variant!.product.name,
      variantName: it.combo ? null : it.variant!.name,
      qty: it.qty,
      lineTotal: Number(it.unitPriceSnapshot) * it.qty,
    }));
    const email = abandonedCartEmail({ name: n.name, items, recoverUrl: `${deps.appUrl}/carrito` });
    await deps.sendEmail({ to: n.email, subject: email.subject, html: email.html, text: email.text });
    await deps.db.cart.update({ where: { id: n.row.cartId }, data: { abandonedEmailSentAt: deps.now } });
    sent += 1;
  }
  return { sent };
}
