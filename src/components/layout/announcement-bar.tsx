"use client";

import { useEffect, useState } from "react";
import { Sparkles, Truck, CreditCard, ShieldCheck } from "lucide-react";

const MESSAGES = [
  { icon: Truck, text: "Envío gratis a todo el país en compras mayores a $47.500" },
  { icon: CreditCard, text: "3 cuotas sin interés con todas las tarjetas" },
  { icon: Sparkles, text: "Garantía de Tono: 100% satisfacción en tu compra" },
  { icon: ShieldCheck, text: "Fórmulas Cruelty-Free y Testeadas Dermatológicamente" },
];

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const current = MESSAGES[index];
  const Icon = current.icon;

  return (
    <div className="relative overflow-hidden bg-[#161413] text-[#FBF9F6] py-2 px-4 text-center border-b border-white/10 select-none">
      <div className="container flex items-center justify-center min-h-[20px]">
        <div
          key={index}
          className="inline-flex items-center justify-center gap-2 text-xs md:text-sm font-medium tracking-wide animate-fade-up"
        >
          <Icon className="size-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>{current.text}</span>
        </div>
      </div>
    </div>
  );
}
