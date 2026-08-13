import { describe, it, expect } from "vitest";
import { canTransition, orderStatusForPayment, canTransitionShipment } from "@/lib/orders/state-machine";

describe("canTransition", () => {
  it("permite el camino feliz", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("paid", "preparing")).toBe(true);
    expect(canTransition("preparing", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });
  it("permite cancelar/reembolsar según el estado", () => {
    expect(canTransition("pending_payment", "cancelled")).toBe(true);
    expect(canTransition("paid", "refunded")).toBe(true);
  });
  it("rechaza saltos inválidos", () => {
    expect(canTransition("pending_payment", "shipped")).toBe(false);
    expect(canTransition("delivered", "paid")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
  });
});

describe("orderStatusForPayment", () => {
  it("mapea el estado de MP al estado de pedido", () => {
    expect(orderStatusForPayment("approved")).toBe("paid");
    expect(orderStatusForPayment("refunded")).toBe("refunded");
    expect(orderStatusForPayment("cancelled")).toBe("cancelled");
  });
  it("rejected/pending/in_process no cambian el pedido (null)", () => {
    expect(orderStatusForPayment("rejected")).toBeNull();
    expect(orderStatusForPayment("pending")).toBeNull();
    expect(orderStatusForPayment("in_process")).toBeNull();
  });
});

describe("canTransitionShipment", () => {
  it("permite el camino feliz", () => {
    expect(canTransitionShipment("pending", "ready")).toBe(true);
    expect(canTransitionShipment("ready", "dispatched")).toBe(true);
    expect(canTransitionShipment("dispatched", "in_transit")).toBe(true);
    expect(canTransitionShipment("in_transit", "delivered")).toBe(true);
  });
  it("permite 'returned' una vez que ya salió (dispatched/in_transit), no antes", () => {
    expect(canTransitionShipment("dispatched", "returned")).toBe(true);
    expect(canTransitionShipment("in_transit", "returned")).toBe(true);
    expect(canTransitionShipment("pending", "returned")).toBe(false);
    expect(canTransitionShipment("ready", "returned")).toBe(false);
  });
  it("el no-op (mismo status) siempre es válido", () => {
    expect(canTransitionShipment("pending", "pending")).toBe(true);
    expect(canTransitionShipment("delivered", "delivered")).toBe(true);
  });
  it("rechaza saltar pasos o retroceder", () => {
    expect(canTransitionShipment("pending", "delivered")).toBe(false);
    expect(canTransitionShipment("pending", "dispatched")).toBe(false);
    expect(canTransitionShipment("in_transit", "ready")).toBe(false);
    expect(canTransitionShipment("delivered", "in_transit")).toBe(false);
  });
  it("delivered/returned son terminales", () => {
    expect(canTransitionShipment("delivered", "returned")).toBe(false);
    expect(canTransitionShipment("returned", "pending")).toBe(false);
  });
});
