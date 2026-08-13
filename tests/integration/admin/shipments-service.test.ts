import { describe, it, expect, vi } from "vitest";
import { upsertShipment, type ShipmentsDeps, type ShipmentInput } from "@/lib/admin/shipments/service";

const baseInput: ShipmentInput = {
  service: "Clásico",
  trackingNumber: "CA123456789AR",
  labelUrl: null,
  cost: 2500,
  status: "dispatched",
};

function makeDeps(over: { orderStatus?: string; existingShipment?: { id: string; status: string } | null } = {}) {
  const tx = {
    shipment: {
      findUnique: vi.fn(async () => over.existingShipment ?? null),
      create: vi.fn(async ({ data }: { data: unknown }) => ({ id: "shp-1", ...(data as object) })),
      update: vi.fn(async () => ({ id: "shp-1" })),
    },
    order: { update: vi.fn(async () => ({})) },
  };
  const deps: ShipmentsDeps = {
    db: {
      order: { findUnique: vi.fn(async () => ({ id: "ord-1", status: over.orderStatus ?? "preparing" })) },
      $transaction: vi.fn(async (fn) => fn(tx as never)),
    } as never,
  };
  return { deps, tx };
}

describe("upsertShipment", () => {
  it("crea el shipment y, con tracking, mueve el pedido a shipped (desde preparing)", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "preparing", existingShipment: null });
    const r = await upsertShipment("ord-1", baseInput, deps);
    expect(r.id).toBe("ord-1");
    expect(tx.shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: "ord-1", carrier: "correo_argentino", trackingNumber: "CA123456789AR", cost: 2500 }) }),
    );
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "ord-1" }, data: { status: "shipped" } });
  });

  it("actualiza el shipment existente (upsert) sin duplicar — transición ready→dispatched válida", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "shipped", existingShipment: { id: "shp-1", status: "ready" } });
    await upsertShipment("ord-1", baseInput, deps); // baseInput.status = "dispatched"
    expect(tx.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: "ord-1" }, data: expect.objectContaining({ trackingNumber: "CA123456789AR" }) }),
    );
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });

  it("permite el no-op (mismo status, solo cambian otros campos)", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "shipped", existingShipment: { id: "shp-1", status: "dispatched" } });
    await upsertShipment("ord-1", baseInput, deps); // baseInput.status = "dispatched" también
    expect(tx.shipment.update).toHaveBeenCalled();
  });

  it("rechaza saltar pasos (pending directo a delivered, sin pasar por ready/dispatched/in_transit)", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "shipped", existingShipment: { id: "shp-1", status: "pending" } });
    await expect(upsertShipment("ord-1", { ...baseInput, status: "delivered" }, deps)).rejects.toThrow(/no se puede/i);
    expect(tx.shipment.update).not.toHaveBeenCalled();
  });

  it("rechaza retroceder (in_transit a ready)", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "shipped", existingShipment: { id: "shp-1", status: "in_transit" } });
    await expect(upsertShipment("ord-1", { ...baseInput, status: "ready" }, deps)).rejects.toThrow(/no se puede/i);
    expect(tx.shipment.update).not.toHaveBeenCalled();
  });

  it("sin trackingNumber NO mueve el pedido a shipped", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "preparing", existingShipment: null });
    await upsertShipment("ord-1", { ...baseInput, trackingNumber: null }, deps);
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("no mueve a shipped si la transición no es válida (pedido pending_payment)", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "pending_payment", existingShipment: null });
    await upsertShipment("ord-1", baseInput, deps);
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("rechaza si el pedido no existe", async () => {
    const deps: ShipmentsDeps = {
      db: { order: { findUnique: vi.fn(async () => null) }, $transaction: vi.fn(async (fn) => fn({} as never)) } as never,
    };
    await expect(upsertShipment("ord-x", baseInput, deps)).rejects.toThrow(/no existe/i);
  });
});
