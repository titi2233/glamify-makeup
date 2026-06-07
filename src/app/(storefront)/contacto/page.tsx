import type { Metadata } from "next";
import { Mail, MessageCircle, Instagram, Music2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { businessInfo } from "@/lib/legal/business-info";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escribinos por email o WhatsApp. Estamos para ayudarte con tu compra en Glamify Makeup.",
};

const itemClass =
  "flex min-h-[44px] items-center gap-3 rounded-2xl border border-border p-3 text-foreground transition hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function ContactoPage() {
  const setting = await prisma.setting.findUnique({
    where: { id: "default" },
    select: { whatsappNumber: true, instagramUrl: true, tiktokUrl: true },
  });
  const waHref = whatsappLink(setting?.whatsappNumber);
  const emailIsSet = !businessInfo.email.includes("[COMPLETAR");

  return (
    <section className="mx-auto max-w-prose space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Contacto</h1>
        <p className="text-foreground/90">
          ¿Tenés una consulta sobre un producto, tu pedido o un cambio? Escribinos y te respondemos a la brevedad.
        </p>
      </header>

      <ul className="space-y-3">
        <li>
          <a
            href={emailIsSet ? `mailto:${businessInfo.email}` : undefined}
            className={itemClass}
            aria-label={`Escribir un email a ${businessInfo.email}`}
          >
            <Mail className="h-5 w-5 text-primary-hover" aria-hidden />
            <span>{businessInfo.email}</span>
          </a>
        </li>

        {waHref && (
          <li>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
              aria-label="Escribir por WhatsApp"
            >
              <MessageCircle className="h-5 w-5 text-primary-hover" aria-hidden />
              <span>WhatsApp</span>
            </a>
          </li>
        )}

        {setting?.instagramUrl && (
          <li>
            <a
              href={setting.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
              aria-label="Abrir Instagram de Glamify Makeup"
            >
              <Instagram className="h-5 w-5 text-primary-hover" aria-hidden />
              <span>Instagram</span>
            </a>
          </li>
        )}

        {setting?.tiktokUrl && (
          <li>
            <a
              href={setting.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
              aria-label="Abrir TikTok de Glamify Makeup"
            >
              <Music2 className="h-5 w-5 text-primary-hover" aria-hidden />
              <span>TikTok</span>
            </a>
          </li>
        )}
      </ul>

      <p className="text-sm text-muted-foreground">
        Horario de atención: lunes a viernes de 9 a 18 h. Respondemos consultas dentro de las 48 horas hábiles.
      </p>
    </section>
  );
}
