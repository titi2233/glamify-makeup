import Link from "next/link";
import { Star } from "lucide-react";
import { getModerationQueue } from "@/lib/reviews/queries";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/ui/rating-stars";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReviewActionsButtons } from "./review-actions-buttons";

export const dynamic = "force-dynamic";

function dateLabel(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ResenasPage() {
  const queue = await getModerationQueue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reseñas — Moderación"
        subtitle="Aprobá o rechazá las reseñas pendientes antes de que se publiquen en la tienda."
      />

      {queue.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
          <Star className="size-8 text-muted-foreground" />
          <p className="font-display text-lg">No hay reseñas pendientes</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Cuando una clienta deje una reseña que necesite revisión, va a aparecer acá.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Reseña</TableHead>
              <TableHead>Autora</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-[12rem]">
                  <Link href={`/producto/${r.productSlug}`} className="font-medium text-primary hover:underline" target="_blank">
                    {r.productName}
                  </Link>
                </TableCell>
                <TableCell className="max-w-sm">
                  <RatingStars value={r.rating} size="sm" />
                  {r.title && <p className="font-medium">{r.title}</p>}
                  <p className="line-clamp-3 text-sm text-muted-foreground">{r.body}</p>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{r.authorName}</span>
                  {r.verifiedPurchase && (
                    <Badge variant="secondary" className="mt-1 block w-fit">Compra verificada</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{dateLabel(r.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <ReviewActionsButtons id={r.id} slug={r.productSlug} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
