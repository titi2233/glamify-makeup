import { isValidEmail } from "@/lib/forms/email";

export interface RetractionInput {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  orderNumber?: string;
  reason?: string;
  website?: string; // honeypot
}
export interface ValidRetraction {
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  orderNumber: string | null;
  reason: string | null;
}
export type ValidationResult =
  | { ok: true; value: ValidRetraction }
  | { ok: false; error: string };

function clean(v: string | undefined, max: number): string | null {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

export function validateRetraction(input: RetractionInput): ValidationResult {
  if ((input.website ?? "").trim() !== "") return { ok: false, error: "No se pudo procesar la solicitud." };
  const contactName = (input.contactName ?? "").trim();
  if (contactName.length < 2 || contactName.length > 80) return { ok: false, error: "Ingresá tu nombre completo." };
  const contactEmail = (input.contactEmail ?? "").trim().toLowerCase();
  if (!isValidEmail(contactEmail)) return { ok: false, error: "Ingresá un email válido." };
  return {
    ok: true,
    value: {
      contactName,
      contactEmail,
      contactPhone: clean(input.contactPhone, 40),
      orderNumber: clean(input.orderNumber, 40),
      reason: clean(input.reason, 1000),
    },
  };
}
