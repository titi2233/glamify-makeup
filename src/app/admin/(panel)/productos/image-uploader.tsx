"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { uploadProductImageAction } from "@/app/admin/(panel)/productos/actions";

// Igual al límite del server (lib/admin/products/images.ts) y al bodySizeLimit de
// Server Actions. Pre-chequeo en el cliente: un archivo más grande muestra un
// mensaje inline en vez de reventar el body de la action.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface Props {
  value: string[];
  onChange: (paths: string[]) => void;
  publicBase: string; // base pública del bucket, ej. https://xxx.supabase.co/storage/v1/object/public/product-images/
  max?: number;
  className?: string;
}

export function ImageUploader({ value, onChange, publicBase, max = 6, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = max - value.length;
    const selected = Array.from(files).slice(0, Math.max(0, remaining));
    const tooBig = selected.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" supera el límite de 5 MB. Reducí el tamaño o elegí otra imagen.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    startUpload(async () => {
      const next: string[] = [];
      for (const file of selected) {
        const fd = new FormData();
        fd.set("file", file);
        const r = await uploadProductImageAction(fd);
        if (r.ok && r.path) next.push(r.path);
        else setError(r.error ?? "No se pudo subir una imagen.");
      }
      if (next.length > 0) onChange([...value, ...next]);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const remove = (path: string) => onChange(value.filter((p) => p !== path));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-3">
        {value.map((path) => (
          <div key={path} className="relative size-24 overflow-hidden rounded-xl border border-border">
            <Image src={`${publicBase}${path}`} alt="Imagen del producto" fill sizes="96px" className="object-cover" />
            <button
              type="button"
              onClick={() => remove(path)}
              aria-label="Quitar imagen"
              className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-soft"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            aria-label="Agregar imagen"
            className="grid size-24 place-items-center rounded-xl border border-dashed border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        Hasta {max} imágenes. PNG, JPG, WEBP o AVIF, máximo 5 MB cada una.
      </p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {value.length >= max && (
        <Button type="button" variant="ghost" size="sm" disabled className="px-0">
          Llegaste al máximo de imágenes
        </Button>
      )}
    </div>
  );
}
