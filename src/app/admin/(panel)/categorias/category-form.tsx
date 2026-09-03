"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Tag,
  Link2,
  Hash,
  Image as ImageIcon,
  Eye,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
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
  showInMenu: boolean;
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

/** Sección del form tipo card: medallón + título serif + ayuda opcional. */
function FormSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft space-y-4">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <Icon className="size-[18px]" />
        </span>
        <div className="space-y-0.5">
          <h2 className="font-display text-lg font-semibold leading-tight text-foreground">{title}</h2>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
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
  const [showInMenu, setShowInMenu] = useState(initial?.showInMenu ?? true);
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
        showInMenu,
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
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <FormSection
        icon={Tag}
        title="Datos básicos"
        hint="El nombre y la dirección con la que tus clientas la van a ver."
      >
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
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="labiales"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">Se arma solo desde el nombre. Podés cambiarlo.</p>
        </div>
      </FormSection>

      <FormSection
        icon={Hash}
        title="Organización"
        hint="Dónde vive la categoría y cómo se ordena en la tienda."
      >
        <div className="space-y-2">
          <Label htmlFor="cat-parent">Categoría padre (opcional)</Label>
          <select
            id="cat-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
          >
            <option value="">Sin padre (categoría principal)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Elegí una principal para crear una subcategoría. Solo hay dos niveles.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cat-prefix">Prefijo de SKU</Label>
            <Input
              id="cat-prefix"
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="LAB"
              className="font-mono uppercase"
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
              className="tabular-nums"
            />
            <p className="text-xs text-muted-foreground">Más chico = aparece antes.</p>
          </div>
        </div>
      </FormSection>

      <FormSection
        icon={ImageIcon}
        title="Imagen y visibilidad"
        hint="Una foto opcional y si la categoría aparece en la tienda."
      >
        <div className="space-y-2">
          <Label htmlFor="cat-image">Imagen (ruta, opcional)</Label>
          <Input
            id="cat-image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="categorias/labiales.webp"
            className="font-mono text-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-surface-alt/50 p-3.5">
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
              <Eye className="size-[18px]" />
            </span>
            <div>
              <Label htmlFor="cat-active">Activa</Label>
              <p className="text-xs text-muted-foreground">Si está apagada, no se muestra en la tienda.</p>
            </div>
          </div>
          <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-surface-alt/50 p-3.5">
          <div>
            <Label htmlFor="cat-show-in-menu">Mostrar en menú</Label>
            <p className="text-xs text-muted-foreground">
              Si está apagado, la categoría sigue visible en /tienda pero no aparece en el menú principal ni en &ldquo;Comprar por categoría&rdquo; del home.
            </p>
          </div>
          <Switch id="cat-show-in-menu" checked={showInMenu} onCheckedChange={setShowInMenu} />
        </div>
      </FormSection>

      {error && (
        <p
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {initial?.id ? "Guardar cambios" : "Crear categoría"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/categorias")} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
