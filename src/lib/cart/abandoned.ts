export interface AbandonedCartRow {
  cartId: string;
  email: string | null;
  consent: boolean;
  updatedAt: Date;
  itemCount: number;
  abandonedEmailSentAt: Date | null;
}

/** Pura: ids de carritos elegibles para el email de recupero. */
export function findAbandonedCarts(rows: AbandonedCartRow[], now: Date, idleHours = 24): string[] {
  const cutoff = now.getTime() - idleHours * 3600_000;
  return rows
    .filter(
      (r) =>
        r.email != null &&
        r.consent &&
        r.itemCount > 0 &&
        r.abandonedEmailSentAt == null &&
        r.updatedAt.getTime() <= cutoff,
    )
    .map((r) => r.cartId);
}
