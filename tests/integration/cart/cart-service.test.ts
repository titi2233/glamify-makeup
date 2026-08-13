import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock se hoistea sobre TODO lo demás (incluidas const de módulo) — las variables que la
// factory necesita van dentro de vi.hoisted() para que también se hoisteen y no exploten con
// "Cannot access before initialization".
const { cartItem } = vi.hoisted(() => ({
  cartItem: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { cartItem } }));

import { updateItem, removeItem } from "@/lib/cart/cart-service";

describe("updateItem / removeItem — scopeados a cartId (evita IDOR entre carritos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updateItem escribe con precondición cartId, no solo por itemId", async () => {
    cartItem.updateMany.mockResolvedValue({ count: 1 });
    await updateItem("cart-a", "item-1", 3);
    expect(cartItem.updateMany).toHaveBeenCalledWith({ where: { id: "item-1", cartId: "cart-a" }, data: { qty: 3 } });
    expect(cartItem.update).not.toHaveBeenCalled(); // nunca el update sin scope
  });

  it("updateItem tira error si el item no pertenece a ese carrito (carrito ajeno)", async () => {
    cartItem.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateItem("cart-a", "item-de-otro-carrito", 3)).rejects.toThrow(/no pertenece/i);
  });

  it("removeItem borra con precondición cartId, no solo por itemId", async () => {
    cartItem.deleteMany.mockResolvedValue({ count: 1 });
    await removeItem("cart-a", "item-1");
    expect(cartItem.deleteMany).toHaveBeenCalledWith({ where: { id: "item-1", cartId: "cart-a" } });
    expect(cartItem.delete).not.toHaveBeenCalled(); // nunca el delete sin scope
  });

  it("removeItem tira error si el item no pertenece a ese carrito", async () => {
    cartItem.deleteMany.mockResolvedValue({ count: 0 });
    await expect(removeItem("cart-a", "item-ajeno")).rejects.toThrow(/no pertenece/i);
  });

  it("updateItem con qty<=0 delega a removeItem, scopeado igual", async () => {
    cartItem.deleteMany.mockResolvedValue({ count: 1 });
    await updateItem("cart-a", "item-1", 0);
    expect(cartItem.deleteMany).toHaveBeenCalledWith({ where: { id: "item-1", cartId: "cart-a" } });
  });
});
