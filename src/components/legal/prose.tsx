import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Wrapper tipográfico para páginas de texto (legales/contenido).
 *  Headings jerárquicos, ancho de lectura y links con contraste AA. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        "mx-auto max-w-prose space-y-4 py-6 text-foreground",
        "[&_h1]:mb-2 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold",
        "[&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl",
        "[&_p]:leading-relaxed",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_a]:text-primary-hover [&_a]:underline [&_a]:underline-offset-2",
        "[&_strong]:font-semibold",
        className,
      )}
    >
      {children}
    </article>
  );
}
