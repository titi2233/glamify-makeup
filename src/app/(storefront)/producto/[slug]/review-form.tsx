"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RatingInput } from "@/components/ui/rating-stars";
import { createReviewAction } from "./review-actions";

export function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await createReviewAction({
      productId, slug,
      rating: Number(fd.get("rating") ?? 0),
      title: String(fd.get("title") ?? ""),
      body: String(fd.get("body") ?? ""),
    });
    setPending(false);
    if (res.ok) setDone(true); else setError(res.error ?? "Error");
  }

  if (done) return <p className="text-sm text-primary">¡Gracias por tu reseña! Ya está publicada.</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border p-4">
      <p className="text-sm font-medium">Dejá tu reseña</p>
      <RatingInput name="rating" />
      <div className="space-y-1">
        <Label htmlFor="rtitle">Título (opcional)</Label>
        <Input id="rtitle" name="title" maxLength={120} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rbody">Tu experiencia</Label>
        <Textarea id="rbody" name="body" required maxLength={2000} rows={3} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>Publicar reseña</Button>
    </form>
  );
}
