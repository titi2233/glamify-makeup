"use client";

import { Plus, Trash2, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { VariantFormInput } from "@/lib/admin/products/validation";

export function emptyVariant(order: number): VariantFormInput {
  return {
    name: "",
    swatchHex: null,
    sku: "",
    stock: "",
    lowStockThreshold: "",
    priceOverride: null,
    weightGrOverride: null,
    image: null,
    active: true,
    order,
  };
}

interface Props {
  variants: VariantFormInput[];
  onChange: (variants: VariantFormInput[]) => void;
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function VariantFields({ variants, onChange }: Props) {
  const update = (i: number, patch: Partial<VariantFormInput>) => {
    onChange(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };
  const add = () => onChange([...variants, emptyVariant(variants.length)]);
  const remove = (i: number) => onChange(variants.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums">
            {variants.length}
          </span>
          {variants.length === 1 ? "variante cargada" : "variantes cargadas"}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" aria-hidden /> Agregar variante
        </Button>
      </div>

      {variants.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
          <span className="icon-medallion mx-auto grid size-14 place-items-center rounded-2xl" aria-hidden>
            <Palette className="size-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">Todavía no hay variantes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Si no agregás ninguna, creamos una sola llamada &quot;Único&quot; con stock 0.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-5" onClick={add}>
            <Plus className="size-4" aria-hidden /> Agregar la primera variante
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {variants.map((v, i) => (
          <div key={i} className="admin-card space-y-3 rounded-2xl border border-border/70 bg-surface-alt/40 p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-lg border border-border/70 bg-background"
                  aria-hidden
                  style={v.swatchHex ? { backgroundColor: v.swatchHex } : undefined}
                >
                  {v.swatchHex ? null : <Palette className="size-3.5 text-primary" />}
                </span>
                <span className="truncate font-display text-base font-semibold text-foreground">
                  {v.name.trim() ? v.name : `Variante ${i + 1}`}
                </span>
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Quitar variante">
                <Trash2 className="size-4" aria-hidden /> Quitar
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`v-name-${i}`}>Nombre del tono</Label>
                <Input id={`v-name-${i}`} value={v.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Rojo Pasión / Único" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-sku-${i}`}>SKU (se autogenera si lo dejás vacío)</Label>
                <Input id={`v-sku-${i}`} value={v.sku} onChange={(e) => update(i, { sku: e.target.value.toUpperCase() })} placeholder="LAB-0007" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-stock-${i}`}>Stock</Label>
                <Input id={`v-stock-${i}`} type="number" inputMode="numeric" min={0} value={v.stock} onChange={(e) => update(i, { stock: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Ej: 10" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-low-${i}`}>Aviso de bajo stock</Label>
                <Input id={`v-low-${i}`} type="number" inputMode="numeric" min={0} value={v.lowStockThreshold} onChange={(e) => update(i, { lowStockThreshold: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Ej: 3" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-price-${i}`}>Precio especial (opcional)</Label>
                <Input id={`v-price-${i}`} type="number" inputMode="decimal" min={0} step="0.01" value={v.priceOverride ?? ""} onChange={(e) => update(i, { priceOverride: numOrNull(e.target.value) })} placeholder="Usa el precio base si lo dejás vacío" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-weight-${i}`}>Peso especial en gramos (opcional)</Label>
                <Input id={`v-weight-${i}`} type="number" inputMode="numeric" min={0} value={v.weightGrOverride ?? ""} onChange={(e) => update(i, { weightGrOverride: numOrNull(e.target.value) })} placeholder="Ej: 80" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-hex-${i}`}>Color del tono (hex, opcional)</Label>
                <Input id={`v-hex-${i}`} value={v.swatchHex ?? ""} onChange={(e) => update(i, { swatchHex: e.target.value.trim() === "" ? null : e.target.value })} placeholder="#FF2E93" />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-4 py-3 sm:mt-[1.625rem] sm:py-0">
                <Switch id={`v-active-${i}`} checked={v.active} onCheckedChange={(checked) => update(i, { active: checked })} />
                <Label htmlFor={`v-active-${i}`} className="cursor-pointer">Variante activa</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
