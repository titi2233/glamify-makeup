import { describe, it, expect, vi } from "vitest";
import { processWebhook, type ProcessWebhookDeps } from "@/lib/orders/webhook-service";

/** Fake db con estado: 1 pedido pending_payment + variante con stock 5. */
function makeFakeDb() {
  const state = {
    order: {
      id: "ord-1", status: "pending_payment", couponId: "co-1", contactName: "Ana", contactEmail: "ana@example.com",
      shippingMethod: "domicilio", subtotal: 6400, shippingCost: 2500, discountTotal: 640, total: 8260,
      items: [{ variantId: "v1", comboId: null, productNameSnapshot: "Labial", variantNameSnapshot: "Rojo", qty: 2, lineTotal: 6400, combo: null }],
    } as any,
    variants: new Map<string, number>([["v1", 5]]),
    payments: [] as any[],
    couponUsed: 0,
    shipments: [] as any[],
  };
  const db: any = {
    order: {
      findFirst: vi.fn(async () => structuredCloneSafe(state.order)),
      update: vi.fn(async ({ data }: any) => { state.order.status = data.status ?? state.order.status; return state.order; }),
      // Guarda atómica: solo actualiza si el estado actual matchea la precondición (como Postgres).
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (state.order.status === where.status) { state.order.status = data.status; return { count: 1 }; }
        return { count: 0 };
      }),
    },
    payment: {
      findUnique: vi.fn(async ({ where }: any) => state.payments.find((p) => p.mpPaymentId === where.mpPaymentId) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = state.payments.find((p) => p.mpPaymentId === where.mpPaymentId);
        if (existing) { Object.assign(existing, update); return existing; }
        const p = { id: `pay-${state.payments.length + 1}`, ...create }; state.payments.push(p); return p;
      }),
    },
    productVariant: {
      findMany: vi.fn(async ({ where }: any) => [...state.variants].filter(([id]) => where.id.in.includes(id)).map(([id, stock]) => ({ id, stock }))),
      update: vi.fn(async ({ where, data }: any) => { state.variants.set(where.id, data.stock.decrement != null ? (state.variants.get(where.id)! - data.stock.decrement) : data.stock); return {}; }),
    },
    coupon: { update: vi.fn(async () => { state.couponUsed++; return {}; }) },
    shipment: { create: vi.fn(async ({ data }: any) => { state.shipments.push(data); return data; }) },
    $transaction: vi.fn(async (fn: any) => fn(db)),
  };
  return { db, state };
}
function structuredCloneSafe<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }

function makeDeps(over: Partial<ProcessWebhookDeps> = {}): ProcessWebhookDeps {
  return {
    db: makeFakeDb().db,
    getPayment: vi.fn(async () => ({ id: "mp-pay-1", status: "approved", external_reference: "ord-1", transaction_amount: 8260 })),
    sendEmail: vi.fn(async () => ({ id: "e1", logged: false })),
    verifySignature: vi.fn(async () => true),
    secret: "s",
    ownerEmail: "owner@test.com",
    now: new Date("2026-06-04T12:00:00Z"),
    ...over,
  };
}

describe("processWebhook", () => {
  it("firma inválida → 401, sin efectos", async () => {
    const deps = makeDeps({ verifySignature: vi.fn(async () => false) });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "bad", xRequestId: "r" }, deps);
    expect(r.status).toBe(401);
    expect(deps.getPayment).not.toHaveBeenCalled();
  });

  it("approved → paga, descuenta stock, incrementa cupón, manda 2 emails", async () => {
    const { db, state } = makeFakeDb();
    const deps = makeDeps({ db });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.order.status).toBe("paid");
    expect(state.variants.get("v1")).toBe(3); // 5 - 2
    expect(state.couponUsed).toBe(1);
    expect((deps.sendEmail as any).mock.calls.length).toBe(2);
  });

  it("idempotente: el mismo webhook 2× descuenta stock una sola vez", async () => {
    const { db, state } = makeFakeDb();
    const deps = makeDeps({ db });
    await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(state.variants.get("v1")).toBe(3); // sigue 3, no 1
    expect(state.couponUsed).toBe(1);
  });

  it("perdió la carrera concurrente (otro webhook ya transicionó) → sin efectos", async () => {
    const { db, state } = makeFakeDb();
    // Simula que otra invocación concurrente ya pasó el pedido a paid entre el read y el write:
    db.order.updateMany = vi.fn(async () => ({ count: 0 }));
    const deps = makeDeps({ db });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.variants.get("v1")).toBe(5); // no descontó (la otra invocación lo hizo)
    expect(state.couponUsed).toBe(0);
    expect((deps.sendEmail as any).mock.calls.length).toBe(0);
  });

  it("rejected → no cambia el pedido (reintento), sin descuento", async () => {
    const { db, state } = makeFakeDb();
    const deps = makeDeps({ db, getPayment: vi.fn(async () => ({ id: "mp-pay-1", status: "rejected", external_reference: "ord-1" })) });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.order.status).toBe("pending_payment");
    expect(state.variants.get("v1")).toBe(5);
  });

  it("pedido inexistente → 200 (ack)", async () => {
    const deps = makeDeps({ getPayment: vi.fn(async () => ({ id: "mp-pay-1", status: "approved", external_reference: "no-existe" })), db: { ...makeFakeDb().db, order: { findFirst: vi.fn(async () => null), update: vi.fn() } } as any });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
  });
});
