import { MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";

const WA_MESSAGE = "¡Hola! Tengo una consulta sobre Glamify Makeup 💄";

/** Botón flotante de WhatsApp (blueprint 02 §6). No renderiza si no hay número en Setting. */
export async function WhatsAppFab() {
  const setting = await prisma.setting.findUnique({
    where: { id: "default" },
    select: { whatsappNumber: true },
  });
  const num = setting?.whatsappNumber?.replace(/[^\d]/g, "") ?? "";
  if (!num) return null;

  const href = `https://wa.me/${num}?text=${encodeURIComponent(WA_MESSAGE)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar por WhatsApp"
      className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-soft-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none md:bottom-6"
    >
      <MessageCircle className="h-7 w-7" aria-hidden />
    </a>
  );
}
