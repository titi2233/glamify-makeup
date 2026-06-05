"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createComboAction, updateComboAction, type ComboActionInput } from "./actions";

/** Variante seleccionable: aplanada como producto → variante para el picker. */
export interface VariantOption {
  id: string;
  label: string; // "Labial Mate — Rojo Pasión (LAB-0001)"
}

export interface ComboFormItem {
  variantId: string;
  qty: number;
}

export interface ComboFormInitial {
  id?: string;
  name: string;
  slug: string;
  description: string;
  comboPrice: number;
  active: boolean;
  validFrom: string | null; // "YYYY-MM-DD" para <input type=date>
  validTo: string | null;
  images: string[];
  items: ComboFormItem[];
}

interface ComboFormProps {
  variantOptions: VariantOption[];
  initial?: ComboFormInitial;
}

const empty: ComboFormInitial = {
  name: "",
  slug: "",
  description: "",
  comboPrice: 0,
  active: true,
  validFrom: null,
  validTo: null,
  images: [],
  items: [{ variantId: "", qty: 1 }],
};

export function ComboForm({ variantOptions, initial }: ComboFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const start = initial ?? empty;

  const [name, setName] = useState(start.name);
  const [slug, setSlug] = useState(start.slug);
  const [description, setDescription] = useState(start.description);
  const [comboPrice, setComboPrice] = useState(String(start.comboPrice || ""));
  const [active, setActive] = useState(start.active);
  const [validFrom, setValidFrom] = useState(start.validFrom ?? "");
  const [validTo, setValidTo] = useState(start.validTo ?? "");
  const [items, setItems] = useState<ComboFormItem[]>(start.items.length > 0 ? start.items : [{ variantId: "", qty: 1 }]);

  const addItem = () => setItems((prev) => [...prev, { variantId: "", qty: 1 }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const setVariant = (idx: number, variantId: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, variantId } : it)));
  const setQty = (idx: number, qty: number) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty } : it)));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const payload: ComboActionInput = {
      name,
      slug,
      description,
      comboPrice: Number(comboPrice),
      images: start.images,
      active,
      validFrom: validFrom ? new Date(`${validFrom}T00:00:00.000Z`).toISOString() : null,
      validTo: validTo ? new Date(`${validTo}T00:00:00.000Z`).toISOString() : null,
      items: items.map((it) => ({ variantId: it.variantId, qty: it.qty })),
    };
    startTransition(async () => {
      const res = initial?.id
        ? await updateComboAction(initial.id, payload)
        : await createComboAction(payload);
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar el combo.");
        return;
      }
      router.push("/admin/combos");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="combo-name">Nombre del combo</Label>
        <Input id="combo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Combo Glow" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="combo-slug">Slug (link)</Label>
        <Input id="combo-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="se arma solo desde el nombre" />
        <p className="text-sm text-muted-foreground">Si lo dejás vacío, se arma solo a partir del nombre.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="combo-desc">Descripción</Label>
        <Textarea id="combo-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué incluye el combo" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="combo-price">Precio del combo (ARS)</Label>
        <Input
          id="combo-price"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={comboPrice}
          onChange={(e) => setComboPrice(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="combo-from">Desde (opcional)</Label>
          <Input id="combo-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="combo-to">Hasta (opcional)</Label>
          <Input id="combo-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch id="combo-active" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="combo-active">Combo activo (se ve en la tienda)</Label>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-foreground">Productos del combo</legend>
        <p className="text-sm text-muted-foreground">Elegí qué variantes entran y cuántas de cada una.</p>
        {items.map((it, idx) => (
          <div key={idx} className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor={`item-variant-${idx}`}>Producto / variante</Label>
              <Select value={it.variantId} onValueChange={(v) => setVariant(idx, v)}>
                <SelectTrigger id={`item-variant-${idx}`}>
                  <SelectValue placeholder="Elegí una variante" />
                </SelectTrigger>
                <SelectContent>
                  {variantOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-2">
              <Label htmlFor={`item-qty-${idx}`}>Cantidad</Label>
              <Input
                id={`item-qty-${idx}`}
                type="number"
                min="1"
                step="1"
                value={it.qty}
                onChange={(e) => setQty(idx, Number(e.target.value))}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(idx)}
              disabled={items.length <= 1}
              aria-label="Quitar producto del combo"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addItem}>
          <Plus className="size-4" aria-hidden />
          Agregar producto
        </Button>
      </fieldset>

      {error ? (
        <p className={cn("rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive")} role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : initial?.id ? "Guardar cambios" : "Crear combo"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/combos")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
