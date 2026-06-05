"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  /** El elemento que abre el diálogo (ej. un botón "Cancelar pedido"). */
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción peligrosa (ej. cancelar pedido, borrar categoría). */
  onConfirm: () => void | Promise<void>;
  /** Deshabilita los botones mientras corre la acción. */
  pending?: boolean;
}

/**
 * Diálogo de confirmación para acciones peligrosas del panel (borrar, cancelar).
 * Reusa el primitivo Sheet (Radix Dialog) — lo centramos como modal.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Sí, confirmar",
  cancelLabel = "No, volver",
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);

  async function handleConfirm() {
    await onConfirm();
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-2xl sm:bottom-1/2 sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-6 gap-2">
          <SheetClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              {cancelLabel}
            </Button>
          </SheetClose>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "Procesando…" : confirmLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
