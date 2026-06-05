"use client";

import { Plus, Trash2 } from "lucide-react";
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
    stock: 0,
    lowStockThreshold: 3,
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg">Variantes</h3>
          <p className="text-sm text-muted-foreground">
            Cada tono o color es una variante. Si no agregás ninguna, creamos una llamada &quot;Único&quot;.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" aria-hidden /> Agregar variante
        </Button>
      </div>

      {variants.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sin variantes: se creará una sola llamada &quot;Único&quot; con stock 0.
        </p>
      )}

      <div className="space-y-4">
        {variants.map((v, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Variante {i + 1}</span>
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
                <Input id={`v-stock-${i}`} type="number" inputMode="numeric" min={0} value={v.stock} onChange={(e) => update(i, { stock: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-low-${i}`}>Aviso de bajo stock</Label>
                <Input id={`v-low-${i}`} type="number" inputMode="numeric" min={0} value={v.lowStockThreshold} onChange={(e) => update(i, { lowStockThreshold: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-price-${i}`}>Precio especial (opcional)</Label>
                <Input id={`v-price-${i}`} type="number" inputMode="decimal" min={0} step="0.01" value={v.priceOverride ?? ""} onChange={(e) => update(i, { priceOverride: numOrNull(e.target.value) })} placeholder="Usa el precio base si lo dejás vacío" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-weight-${i}`}>Peso especial en gramos (opcional)</Label>
                <Input id={`v-weight-${i}`} type="number" inputMode="numeric" min={0} value={v.weightGrOverride ?? ""} onChange={(e) => update(i, { weightGrOverride: numOrNull(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-hex-${i}`}>Color del tono (hex, opcional)</Label>
                <Input id={`v-hex-${i}`} value={v.swatchHex ?? ""} onChange={(e) => update(i, { swatchHex: e.target.value.trim() === "" ? null : e.target.value })} placeholder="#FF2E93" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch id={`v-active-${i}`} checked={v.active} onCheckedChange={(checked) => update(i, { active: checked })} />
                <Label htmlFor={`v-active-${i}`}>Variante activa</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
