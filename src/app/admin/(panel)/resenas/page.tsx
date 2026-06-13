import Link from "next/link";
import { Star, Clock, BadgeCheck, ExternalLink, MessageSquareQuote, User, CalendarDays } from "lucide-react";
import { getModerationQueue } from "@/lib/reviews/queries";
import { PageHeader } from "@/components/admin/page-header";
import { RatingStars } from "@/components/ui/rating-stars";
import { Badge } from "@/components/ui/badge";
import { ReviewActionsButtons } from "./review-actions-buttons";

export const dynamic = "force-dynamic";

function dateLabel(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ResenasPage() {
  const queue = await getModerationQueue();

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={Star}
        title="Reseñas — Moderación"
        subtitle="Aprobá o rechazá las reseñas pendientes antes de que se publiquen en la tienda."
        action={
          queue.length > 0 ? (
            <Badge variant="warning" className="gap-1.5 px-3 py-1.5 text-sm">
              <Clock className="size-3.5" aria-hidden />
              {queue.length} {queue.length === 1 ? "pendiente" : "pendientes"}
            </Badge>
          ) : undefined
        }
      />

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <span className="icon-medallion mx-auto grid size-14 place-items-center rounded-2xl" aria-hidden>
            <Star className="size-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">No hay reseñas pendientes</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Cuando una clienta deje una reseña que necesite revisión, va a aparecer acá lista para que la apruebes.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {queue.map((r) => (
            <li
              key={r.id}
              className="admin-card flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft"
            >
              {/* Cabecera: producto + estado */}
              <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-surface-alt/60 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                    <MessageSquareQuote className="size-[18px]" />
                  </span>
                  <Link
                    href={`/producto/${r.productSlug}`}
                    target="_blank"
                    className="inline-flex min-w-0 items-center gap-1.5 font-display text-base font-semibold text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate">{r.productName}</span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </Link>
                </div>
                <Badge variant="warning" className="shrink-0 gap-1">
                  <Clock className="size-3" aria-hidden /> Pendiente
                </Badge>
              </div>

              {/* Cuerpo de la reseña */}
              <div className="flex flex-1 flex-col gap-3 px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <RatingStars value={r.rating} size="sm" />
                  {r.verifiedPurchase && (
                    <Badge variant="success" className="gap-1">
                      <BadgeCheck className="size-3" aria-hidden /> Compra verificada
                    </Badge>
                  )}
                </div>

                {r.title && <p className="font-semibold leading-snug text-foreground">{r.title}</p>}
                <p className="text-sm leading-relaxed text-muted-foreground">{r.body}</p>

                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="size-3.5 text-primary/70" aria-hidden />
                    {r.authorName}
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <CalendarDays className="size-3.5 text-primary/70" aria-hidden />
                    {dateLabel(r.createdAt)}
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div className="border-t border-border/70 bg-surface-alt/40 px-5 py-3">
                <ReviewActionsButtons id={r.id} slug={r.productSlug} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
