import { formatARS } from "@/lib/money";

export interface CartSummaryProps {
  subtotal: number;
  discount: number;
  shippingCost: number | null; // null = "se calcula en checkout"
  total: number;
  freeShipping?: boolean;
}

export function CartSummary({ subtotal, discount, shippingCost, total, freeShipping }: CartSummaryProps) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatARS(subtotal)}</dd></div>
      {discount > 0 && (
        <div className="flex justify-between text-primary"><dt>Descuento</dt><dd className="tabular-nums">−{formatARS(discount)}</dd></div>
      )}
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Envío</dt>
        <dd className="tabular-nums">{freeShipping ? "Gratis" : shippingCost == null ? "A calcular" : formatARS(shippingCost)}</dd>
      </div>
      <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
        <dt>Total</dt><dd className="tabular-nums">{formatARS(total)}</dd>
      </div>
    </dl>
  );
}
