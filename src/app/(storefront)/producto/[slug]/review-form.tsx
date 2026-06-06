"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RatingInput } from "@/components/ui/rating-stars";
import { track } from "@/lib/analytics/track";
import { createReviewAction } from "./review-actions";

export function ReviewForm({ productId, slug, isLoggedIn }: { productId: string; slug: string; isLoggedIn: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [doneStatus, setDoneStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await createReviewAction({
      productId,
      slug,
      rating: Number(fd.get("rating") ?? 0),
      title: String(fd.get("title") ?? ""),
      body: String(fd.get("body") ?? ""),
      authorName: isLoggedIn ? undefined : String(fd.get("authorName") ?? ""),
      website: String(fd.get("website") ?? ""),
    });
    setPending(false);
    if (res.ok) {
      setDoneStatus(res.status ?? "pending");
      track("review_submitted", { status: res.status });
    } else {
      setError(res.error ?? "Error");
    }
  }

  if (doneStatus) {
    return (
      <p className="text-sm text-primary">
        {doneStatus === "approved"
          ? "¡Gracias por tu reseña! Ya está publicada."
          : "¡Gracias por tu reseña! Se publicará tras la revisión de la dueña."}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border p-4">
      <p className="text-sm font-medium">Dejá tu reseña</p>
      <RatingInput name="rating" />
      {!isLoggedIn && (
        <div className="space-y-1">
          <Label htmlFor="rname">Tu nombre</Label>
          <Input id="rname" name="authorName" required minLength={2} maxLength={60} autoComplete="name" />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="rtitle">Título (opcional)</Label>
        <Input id="rtitle" name="title" maxLength={120} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rbody">Tu experiencia</Label>
        <Textarea id="rbody" name="body" required maxLength={2000} rows={3} />
      </div>
      {/* Honeypot anti-spam: oculto para humanos, los bots tienden a completarlo. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {!isLoggedIn && (
        <p className="text-xs text-muted-foreground">Tu reseña se publica tras la revisión de la dueña.</p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Enviando…" : "Publicar reseña"}</Button>
    </form>
  );
}
