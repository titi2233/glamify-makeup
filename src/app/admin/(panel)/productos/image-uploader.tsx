"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { uploadProductImageAction } from "@/app/admin/(panel)/productos/actions";
import { compressImageClient } from "@/lib/images/compress";

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
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = max - value.length;
    const selected = Array.from(files).slice(0, Math.max(0, remaining));

    startUpload(async () => {
      const next: string[] = [];
      try {
        for (let i = 0; i < selected.length; i++) {
          const rawFile = selected[i];
          setProgressMsg(`Optimizando y subiendo foto ${i + 1} de ${selected.length}...`);

          // Comprimir y redimensionar en el navegador antes de enviar a Cloudflare
          const fileToUpload = await compressImageClient(rawFile, 1600, 0.85);

          const fd = new FormData();
          fd.set("file", fileToUpload);

          const r = await uploadProductImageAction(fd);
          if (r.ok && r.path) {
            next.push(r.path);
          } else {
            setError(r.error ?? "No se pudo subir una de las imágenes.");
            break;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado al subir las imágenes.");
      } finally {
        setProgressMsg(null);
        if (inputRef.current) inputRef.current.value = "";
      }

      if (next.length > 0) {
        onChange([...value, ...next]);
      }
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
              className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-soft hover:bg-destructive hover:text-destructive-foreground transition-colors"
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
            className="grid size-24 place-items-center rounded-xl border border-dashed border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
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

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          Hasta {max} imágenes. Se optimizan automáticamente para carga ultra rápida.
        </p>
        {progressMsg && (
          <p className="text-xs font-medium text-primary animate-pulse flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" />
            <span>{progressMsg}</span>
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      {value.length >= max && (
        <Button type="button" variant="ghost" size="sm" disabled className="px-0">
          Llegaste al máximo de imágenes ({max})
        </Button>
      )}
    </div>
  );
}

