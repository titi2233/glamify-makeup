import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSubtitle?: boolean;
}

export function Logo({ size = "md", className, showSubtitle = true }: LogoProps) {
  return (
    <div className={cn("inline-flex flex-col items-center select-none group leading-none", className)}>
      <div className="relative inline-flex items-center">
        <span
          className={cn(
            "font-display tracking-[0.16em] font-bold text-foreground transition-colors",
            size === "sm" && "text-xl md:text-2xl",
            size === "md" && "text-2xl md:text-3xl",
            size === "lg" && "text-3xl md:text-4xl",
            size === "xl" && "text-4xl md:text-5xl"
          )}
        >
          GLAMIFY
        </span>
        {/* Destello estrella de 4 puntas sobre la Y */}
        <svg
          viewBox="0 0 24 24"
          className={cn(
            "absolute text-primary fill-current transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12",
            size === "sm" && "size-3.5 -right-2.5 -top-1",
            size === "md" && "size-4.5 -right-3 -top-1.5",
            size === "lg" && "size-6 -right-4 -top-2",
            size === "xl" && "size-7 -right-5 -top-2.5"
          )}
          aria-hidden="true"
        >
          <path d="M 12 0 Q 12 12 24 12 Q 12 12 12 24 Q 12 12 0 12 Q 12 12 12 0 Z" />
        </svg>
      </div>

      {showSubtitle && (
        <span
          className={cn(
            "font-sans font-medium tracking-[0.4em] uppercase text-muted-foreground group-hover:text-primary transition-colors pl-[0.4em]",
            size === "sm" && "text-[8px] mt-0.5",
            size === "md" && "text-[9px] mt-1",
            size === "lg" && "text-[11px] mt-1.5",
            size === "xl" && "text-xs mt-2"
          )}
        >
          MAKEUP
        </span>
      )}
    </div>
  );
}
