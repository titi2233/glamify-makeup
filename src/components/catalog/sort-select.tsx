"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPTIONS = [
  { value: "relevancia", label: "Relevancia" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
  { value: "novedades", label: "Novedades" },
] as const;

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("orden") ?? "relevancia";

  const onChange = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("orden", value);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-[190px]" aria-label="Ordenar">
        <SelectValue placeholder="Ordenar" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
