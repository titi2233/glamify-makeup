import { validateRetraction, type RetractionInput } from "./validation";
import { formatRetractionTicket, formatRetractionDate } from "./ticket";
import { retractionAlertEmail, retractionReceiptEmail } from "@/lib/email/templates";
import { sendEmail as defaultSendEmail } from "@/lib/email/resend";

export interface RetractionDb {
  retractionRequest: {
    create(args: {
      data: {
        contactName: string;
        contactEmail: string;
        contactPhone: string | null;
        orderNumber: string | null;
        reason: string | null;
      };
      select: { seq: true; createdAt: true };
    }): Promise<{ seq: number; createdAt: Date }>;
  };
}
export interface RetractionDeps {
  db: RetractionDb;
  sendEmail?: typeof defaultSendEmail;
  ownerEmail?: string;
}
export type RetractionResult = { ok: true; ticket: string; date: string } | { ok: false; error: string };

export async function createRetractionRequest(
  input: RetractionInput,
  deps: RetractionDeps,
): Promise<RetractionResult> {
  const parsed = validateRetraction(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.value;

  const { seq, createdAt } = await deps.db.retractionRequest.create({
    data: {
      contactName: v.contactName,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      orderNumber: v.orderNumber,
      reason: v.reason,
    },
    select: { seq: true, createdAt: true },
  });
  const ticket = formatRetractionTicket(seq);
  const date = formatRetractionDate(createdAt);

  const send = deps.sendEmail ?? defaultSendEmail;

  // Constancia al consumidor (comprobante propio del ejercicio del derecho).
  try {
    const receipt = retractionReceiptEmail({ ticket, date, contactName: v.contactName });
    await send({ to: v.contactEmail, subject: receipt.subject, html: receipt.html, text: receipt.text });
  } catch (err) {
    console.error("retraction receipt email failed", err);
  }

  // Alerta a la dueña.
  const ownerEmail = deps.ownerEmail ?? process.env.RESEND_OWNER_EMAIL ?? "";
  if (ownerEmail) {
    try {
      const mail = retractionAlertEmail({
        ticket,
        contactName: v.contactName,
        contactEmail: v.contactEmail,
        contactPhone: v.contactPhone,
        orderNumber: v.orderNumber,
        reason: v.reason,
      });
      await send({ to: ownerEmail, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (err) {
      console.error("retraction owner email failed", err);
    }
  }

  return { ok: true, ticket, date };
}
