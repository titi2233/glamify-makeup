"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/admin/slug";
import { createCategoryAction, updateCategoryAction } from "@/app/admin/(panel)/categorias/actions";

export interface CategoryFormValues {
  id?: string;
  name: string;
  slug: string;
  parentId: string | null;
  skuPrefix: string;
  order: number;
  active: boolean;
  image: string | null;
}

export interface ParentOption {
  id: string;
  name: string;
}

interface Props {
  /** Cuando viene, el form edita; si no, crea. */
  initial?: CategoryFormValues;
  /** Categorías raíz disponibles como padre (sin incluir la propia al editar). */
  parents: ParentOption[];
}

export function CategoryForm({ initial, parents }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [parentId, setParentId] = useState<string>(initial?.parentId ?? "");
  const [skuPrefix, setSkuPrefix] = useState(initial?.skuPrefix ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [image, setImage] = useState(initial?.image ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Slug auto desde el nombre mientras la admin no lo edite a mano.
  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        name,
        slug,
        parentId: parentId || null,
        skuPrefix,
        order,
        active,
        image: image || null,
      };
      const r = initial?.id
        ? await updateCategoryAction(initial.id, payload)
        : await createCategoryAction(payload);
      if (r.ok) {
        router.push("/admin/categorias");
        router.refresh();
      } else {
        setError(r.error ?? "No se pudo guardar la categoría.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="cat-name">Nombre</Label>
        <Input
          id="cat-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Ej: Labiales"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-slug">Slug (la dirección en la web)</Label>
        <Input
          id="cat-slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="labiales"
        />
        <p className="text-xs text-muted-foreground">Se arma solo desde el nombre. Podés cambiarlo.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-parent">Categoría padre (opcional)</Label>
        <select
          id="cat-parent"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Sin padre (categoría principal)</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Elegí una principal para crear una subcategoría. Solo hay dos niveles.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cat-prefix">Prefijo de SKU</Label>
          <Input
            id="cat-prefix"
            value={skuPrefix}
            onChange={(e) => setSkuPrefix(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="LAB"
          />
          <p className="text-xs text-muted-foreground">1 a 3 letras. Arma los códigos de producto.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-order">Orden</Label>
          <Input
            id="cat-order"
            value={order}
            onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">Más chico = aparece antes.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-image">Imagen (ruta, opcional)</Label>
        <Input
          id="cat-image"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="categorias/labiales.webp"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <div>
          <Label htmlFor="cat-active">Activa</Label>
          <p className="text-xs text-muted-foreground">Si está apagada, no se muestra en la tienda.</p>
        </div>
        <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {initial?.id ? "Guardar cambios" : "Crear categoría"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/categorias")} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
