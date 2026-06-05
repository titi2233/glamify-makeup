"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface CartUI {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  setOpen: (v: boolean) => void;
}
const CartContext = createContext<CartUI | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <CartContext.Provider value={{ open, openCart: () => setOpen(true), closeCart: () => setOpen(false), setOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCartUI(): CartUI {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartUI debe usarse dentro de CartProvider");
  return ctx;
}
