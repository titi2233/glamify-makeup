import { RatingStars } from "@/components/ui/rating-stars";

export interface ReviewView {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  createdAt: Date;
}

export function ReviewCard({ review }: { review: ReviewView }) {
  return (
    <article className="space-y-2 rounded-2xl border border-border p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <RatingStars value={review.rating} size="sm" />
        {review.verifiedPurchase && <span className="text-xs text-primary">Compra verificada</span>}
      </div>
      {review.title && <h3 className="text-sm font-semibold">{review.title}</h3>}
      <p className="text-sm leading-relaxed text-muted-foreground">{review.body}</p>
      <p className="text-xs text-muted-foreground">{review.authorName} · {review.createdAt.toLocaleDateString("es-AR")}</p>
    </article>
  );
}
