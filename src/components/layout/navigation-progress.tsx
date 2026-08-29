"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Al cambiar la ruta o search params, completar la barra y desvanecerla
  useEffect(() => {
    if (isLoading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, isLoading]);

  // Interceptar clicks en links internos para iniciar el feedback táctil inmediato
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignorar clicks con modificadores (abrir en nueva pestaña, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }

      const target = (e.target as Element)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignorar anclas, links externos, mailto, tel, downloads, target="_blank"
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.hasAttribute("download") ||
        target.getAttribute("target") === "_blank"
      ) {
        return;
      }

      // Si es un link relativo o del mismo origen
      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(href, window.location.href);

      if (targetUrl.origin !== currentUrl.origin) return;

      // Si es la misma página exacta (mismo path y search)
      if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
        return;
      }

      // Iniciar la barra de progreso
      startTransition(() => {
        setIsLoading(true);
        setProgress(25);
      });
    };

    const handlePopState = () => {
      startTransition(() => {
        setIsLoading(true);
        setProgress(35);
      });
    };

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Simulación de avance progresivo (trickle) mientras carga
  useEffect(() => {
    if (!isLoading || progress >= 90) return;

    const timer = setTimeout(() => {
      setProgress((prev) => {
        if (prev < 50) return prev + 20;
        if (prev < 70) return prev + 12;
        if (prev < 85) return prev + 5;
        return prev;
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [isLoading, progress]);

  if (!isLoading && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 top-0 z-[99999] h-[3px] overflow-hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-[#E6007A] via-[#FF2E93] to-[#FF9ED1] shadow-[0_0_12px_rgba(230,0,122,0.8),0_0_4px_rgba(230,0,122,0.6)] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
