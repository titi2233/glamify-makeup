import { describe, it, expect } from "vitest";
import { canTransition, orderStatusForPayment } from "@/lib/orders/state-machine";

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
