import { describe, it, expect, vi } from "vitest";
import { changeOrderStatus, cancelOrder, type OrdersDeps, type AdminOrder } from "@/lib/admin/orders/service";

const variantOrder = (over: Partial<AdminOrder> = {}): AdminOrder => ({
  id: "ord-1",
  status: "paid",
  couponId: null,
  items: [
    { id: "oi-1", variantId: "v1", comboId: null, qty: 2, combo: null },
  ],
  ...over,
});

function makeDeps(order: AdminOrder | null) {
  const tx = {
    order: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
    productVariant: { update: vi.fn(async () => ({})) },
  };
  const deps: OrdersDeps = {
    db: {
      order: { findUnique: vi.fn(async () => order) },
      $transaction: vi.fn(async (fn) => fn(tx as never)),
    } as never,
    now: new Date("2026-06-05T12:00:00Z"),
  };
  return { deps, tx };
}

describe("changeOrderStatus", () => {
  it("aplica una transición válida (paid → preparing)", async () => {
    const { deps, tx } = makeDeps(variantOrder({ status: "paid" }));
    const r = await changeOrderStatus("ord-1", "preparing", deps);
    expect(r.id).toBe("ord-1");
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "ord-1" }, data: { status: "preparing" } });
  });

  it("rechaza una transición inválida (delivered → preparing) con error claro", async () => {
    const { deps } = makeDeps(variantOrder({ status: "delivered" }));
    await expect(changeOrderStatus("ord-1", "preparing", deps)).rejects.toThrow(/no se puede pasar/i);
  });

  it("rechaza si el pedido no existe", async () => {
    const { deps } = makeDeps(null);
    await expect(changeOrderStatus("ord-x", "paid", deps)).rejects.toThrow(/no existe/i);
  });
});

describe("cancelOrder", () => {
  it("repone stock de variantes y componentes de combo al cancelar un pedido pagado", async () => {
    const order: AdminOrder = {
      id: "ord-2",
      status: "paid",
      couponId: null,
      items: [
        { id: "oi-1", variantId: "v1", comboId: null, qty: 2, combo: null },
        { id: "oi-2", variantId: null, comboId: "cmb-1", qty: 1, combo: { items: [{ variantId: "v2", qty: 3 }, { variantId: "v1", qty: 1 }] } },
      ],
    };
    const tx = {
      order: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
      productVariant: { update: vi.fn(async () => ({})) },
    };
    const deps: OrdersDeps = {
      db: { order: { findUnique: vi.fn(async () => order) }, $transaction: vi.fn(async (fn) => fn(tx as never)) } as never,
    };
    const r = await cancelOrder("ord-2", deps);
    expect(r.id).toBe("ord-2");
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "ord-2" }, data: { status: "cancelled" } });
    // v1: 2 (línea) + 1 (combo×1) = 3 ; v2: 3 (combo×1) = 3
    expect(tx.productVariant.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { stock: { increment: 3 } } });
    expect(tx.productVariant.update).toHaveBeenCalledWith({ where: { id: "v2" }, data: { stock: { increment: 3 } } });
    expect(tx.productVariant.update).toHaveBeenCalledTimes(2);
  });

  it("NO repone stock si el pedido estaba en pending_payment (stock nunca descontado)", async () => {
    const order: AdminOrder = {
      id: "ord-3", status: "pending_payment", couponId: null,
      items: [{ id: "oi-1", variantId: "v1", comboId: null, qty: 2, combo: null }],
    };
    const tx = {
      order: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
      productVariant: { update: vi.fn(async () => ({})) },
    };
    const deps: OrdersDeps = {
      db: { order: { findUnique: vi.fn(async () => order) }, $transaction: vi.fn(async (fn) => fn(tx as never)) } as never,
    };
    await cancelOrder("ord-3", deps);
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "ord-3" }, data: { status: "cancelled" } });
    expect(tx.productVariant.update).not.toHaveBeenCalled();
  });

  it("rechaza cancelar un pedido ya entregado", async () => {
    const order: AdminOrder = {
      id: "ord-4", status: "delivered", couponId: null,
      items: [{ id: "oi-1", variantId: "v1", comboId: null, qty: 1, combo: null }],
    };
    const deps: OrdersDeps = {
      db: { order: { findUnique: vi.fn(async () => order) }, $transaction: vi.fn(async (fn) => fn({} as never)) } as never,
    };
    await expect(cancelOrder("ord-4", deps)).rejects.toThrow(/no se puede cancelar/i);
  });
});
