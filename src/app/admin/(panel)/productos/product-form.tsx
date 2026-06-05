"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import type { ProductFormInput, VariantFormInput } from "@/lib/admin/products/validation";
import { VariantFields } from "@/app/admin/(panel)/productos/variant-fields";
import { ImageUploader } from "@/app/admin/(panel)/productos/image-uploader";
import { createProductAction, updateProductAction } from "@/app/admin/(panel)/productos/actions";

export interface CategoryOption { id: string; name: string }

interface Props {
  categories: CategoryOption[];
  publicBase: string;
  productId?: string;
  initial?: ProductFormInput;
}

function blank(): ProductFormInput {
  return {
    name: "",
    slug: "",
    description: null,
    categoryId: "",
    basePrice: 0,
    compareAtPrice: null,
    cost: 0,
    weightGr: 0,
    images: [],
    isFeatured: false,
    heroRank: null,
    tags: [],
    seoTitle: null,
    seoDescription: null,
    active: true,
    variants: [],
  };
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function ProductForm({ categories, publicBase, productId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormInput>(initial ?? blank());
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(", "));
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProductFormInput>(key: K, value: ProductFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setVariants = (variants: VariantFormInput[]) => setForm((f) => ({ ...f, variants }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: ProductFormInput = {
      ...form,
      tags: tagsText.split(",").map((t) => t.trim()).filter((t) => t !== ""),
    };
    startSubmit(async () => {
      const r = productId
        ? await updateProductAction(productId, payload)
        : await createProductAction(payload);
      if (r.ok) router.push("/admin/productos");
      else setError(r.error ?? "No se pudo guardar el producto.");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg">Datos básicos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Labial Mate Larga Duración" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Enlace (slug)</Label>
            <Input id="slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="Se genera solo si lo dejás vacío" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category">Categoría</Label>
            <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
              <SelectTrigger id="category"><SelectValue placeholder="Elegí una categoría" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="active" checked={form.active} onCheckedChange={(checked) => set("active", checked)} />
            <Label htmlFor="active">Producto activo (visible en la tienda)</Label>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Descripción</Label>
          <Textarea id="description" value={form.description ?? ""} onChange={(e) => set("description", e.target.value === "" ? null : e.target.value)} placeholder="Contale a la clienta de qué se trata" rows={4} />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg">Precio y peso</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="basePrice">Precio (ARS)</Label>
            <Input id="basePrice" type="number" inputMode="decimal" min={0} step="0.01" value={form.basePrice} onChange={(e) => set("basePrice", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="compareAtPrice">Precio anterior / oferta (opcional, mayor al actual)</Label>
            <Input id="compareAtPrice" type="number" inputMode="decimal" min={0} step="0.01" value={form.compareAtPrice ?? ""} onChange={(e) => set("compareAtPrice", numOrNull(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cost">Costo (ARS)</Label>
            <Input id="cost" type="number" inputMode="decimal" min={0} step="0.01" value={form.cost} onChange={(e) => set("cost", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weightGr">Peso en gramos</Label>
            <Input id="weightGr" type="number" inputMode="numeric" min={0} value={form.weightGr} onChange={(e) => set("weightGr", Number(e.target.value))} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg">Imágenes</h2>
        <ImageUploader value={form.images} onChange={(paths) => set("images", paths)} publicBase={publicBase} />
      </section>

      <section className="space-y-4 rounded-2xl border border-border p-5">
        <VariantFields variants={form.variants} onChange={setVariants} />
      </section>

      <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg">Destacado y SEO</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Switch id="isFeatured" checked={form.isFeatured} onCheckedChange={(checked) => set("isFeatured", checked)} />
            <Label htmlFor="isFeatured">Destacar en portada</Label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="heroRank">Orden en portada (opcional)</Label>
            <Input id="heroRank" type="number" inputMode="numeric" min={1} value={form.heroRank ?? ""} onChange={(e) => set("heroRank", numOrNull(e.target.value))} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
            <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="mate, larga duración, vegano" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seoTitle">Título SEO (opcional)</Label>
            <Input id="seoTitle" value={form.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value === "" ? null : e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seoDescription">Descripción SEO (opcional)</Label>
            <Input id="seoDescription" value={form.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value === "" ? null : e.target.value)} />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {productId ? "Guardar cambios" : "Crear producto"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.push("/admin/productos")} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
