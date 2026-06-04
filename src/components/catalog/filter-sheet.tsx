"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function FilterSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const [oferta, setOferta] = useState(params.get("oferta") === "1");
  const [disponible, setDisponible] = useState(params.get("disponible") === "1");

  const apply = () => {
    const next = new URLSearchParams(params.toString());
    const setOrDel = (k: string, v: string | boolean) => {
      if (v === "" || v === false) next.delete(k);
      else next.set(k, v === true ? "1" : String(v));
    };
    setOrDel("min", min);
    setOrDel("max", max);
    setOrDel("oferta", oferta);
    setOrDel("disponible", disponible);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="size-4" aria-hidden /> Filtros
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-display">Filtros</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 py-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Precio (ARS)</legend>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Mín"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                aria-label="Precio mínimo"
              />
              <span aria-hidden>—</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Máx"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                aria-label="Precio máximo"
              />
            </div>
          </fieldset>
          <label className="flex items-center justify-between">
            <span className="text-sm">En oferta</span>
            <input type="checkbox" className="size-5 accent-primary" checked={oferta} onChange={(e) => setOferta(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Solo disponibles</span>
            <input type="checkbox" className="size-5 accent-primary" checked={disponible} onChange={(e) => setDisponible(e.target.checked)} />
          </label>
        </div>
        <SheetFooter>
          <Button onClick={apply} className="w-full">
            Aplicar filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
