/** Mensaje por defecto al abrir WhatsApp desde la web. */
export const WHATSAPP_DEFAULT_MESSAGE = "¡Hola! Tengo una consulta sobre Glamify Makeup 💄";

/** Deja solo dígitos (formato que espera wa.me). Devuelve "" si no hay número. */
export function toWhatsappDigits(raw?: string | null): string {
  return raw?.replace(/[^\d]/g, "") ?? "";
}

/** Construye el link wa.me; devuelve null si no hay número válido. */
export function whatsappLink(raw?: string | null, message: string = WHATSAPP_DEFAULT_MESSAGE): string | null {
  const digits = toWhatsappDigits(raw);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
