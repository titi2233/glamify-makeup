import { describe, it, expect, vi } from "vitest";
import { processWebhook, type ProcessWebhookDeps } from "@/lib/orders/webhook-service";

interface FakeDbOpts {
  customerId?: string | null;
  couponMaxUses?: number | null;
  couponUsedCountStart?: number;
  couponPerCustomerLimit?: number | null;
  redemptions?: Record<string, number>; // customerId -> redeemedCount ya registrado
}

/** Fake db con estado: 1 pedido pending_payment + variante con stock 5. */
function makeFakeDb(opts: FakeDbOpts = {}) {
  const state = {
    order: {
      id: "ord-1", status: "pending_payment", couponId: "co-1", customerId: opts.customerId ?? null,
      contactName: "Ana", contactEmail: "ana@example.com",
      shippingMethod: "domicilio", subtotal: 6400, shippingCost: 2500, discountTotal: 640, total: 8260,
      items: [{ variantId: "v1", comboId: null, productNameSnapshot: "Labial", variantNameSnapshot: "Rojo", qty: 2, lineTotal: 6400, combo: null }],
    } as any,
    variants: new Map<string, number>([["v1", 5]]),
    // Fila "pending" creada en el checkout (mpPaymentId null). El webhook debe reusarla, no crear otra.
    payments: [{ id: "pay-pending", orderId: "ord-1", mpPaymentId: null, status: "pending", amount: 8260 }] as any[],
    couponUsed: 0,
    couponUsedCount: opts.couponUsedCountStart ?? 0,
    couponMaxUses: opts.couponMaxUses ?? null,
    couponPerCustomerLimit: opts.couponPerCustomerLimit ?? null,
    redemptions: new Map<string, number>(Object.entries(opts.redemptions ?? {})),
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
      findFirst: vi.fn(async ({ where }: any) =>
        state.payments.find(
          (p) =>
            p.orderId === where.orderId &&
            (where.OR ? where.OR.some((c: any) => "mpPaymentId" in c && p.mpPaymentId === c.mpPaymentId) : true),
        ) ?? null,
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const p = state.payments.find((x) => x.id === where.id);
        if (p) Object.assign(p, data);
        return p;
      }),
      create: vi.fn(async ({ data }: any) => {
        const p = { id: `pay-${state.payments.length + 1}`, ...data };
        state.payments.push(p);
        return p;
      }),
    },
    productVariant: {
      // Update atómico con precondición de stock real (stock >= gte) — como Postgres: si no
      // alcanza, no decrementa y devuelve count 0 (señal real de oversold/carrera perdida).
      updateMany: vi.fn(async ({ where, data }: any) => {
        const current = state.variants.get(where.id) ?? 0;
        const minRequired = where.stock?.gte ?? 0;
        if (current < minRequired) return { count: 0 };
        state.variants.set(where.id, current - data.stock.decrement);
        return { count: 1 };
      }),
    },
    coupon: {
      findUnique: vi.fn(async () => ({ maxUses: state.couponMaxUses, perCustomerLimit: state.couponPerCustomerLimit })),
      update: vi.fn(async () => { state.couponUsed++; state.couponUsedCount++; return {}; }),
      // Guarda atómica (mismo patrón que stock/order): solo incrementa si usedCount < maxUses leído.
      updateMany: vi.fn(async ({ where }: any) => {
        if (state.couponUsedCount < where.usedCount.lt) { state.couponUsed++; state.couponUsedCount++; return { count: 1 }; }
        return { count: 0 };
      }),
    },
    couponRedemption: {
      findUnique: vi.fn(async ({ where }: any) => {
        const cid = where.customerId_couponId.customerId;
        return state.redemptions.has(cid) ? { redeemedCount: state.redemptions.get(cid) } : null;
      }),
      updateMany: vi.fn(async ({ where }: any) => {
        const current = state.redemptions.get(where.customerId);
        if (current == null) return { count: 0 };
        if (current < where.redeemedCount.lt) { state.redemptions.set(where.customerId, current + 1); return { count: 1 }; }
        return { count: 0 };
      }),
      create: vi.fn(async ({ data }: any) => { state.redemptions.set(data.customerId, data.redeemedCount); return data; }),
      upsert: vi.fn(async ({ where }: any) => {
        const cid = where.customerId_couponId.customerId;
        state.redemptions.set(cid, (state.redemptions.get(cid) ?? 0) + 1);
        return {};
      }),
    },
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
    // Reconciliación: reusó la fila pending, sin huérfano.
    expect(state.payments).toHaveLength(1);
    expect(state.payments[0].status).toBe("approved");
    expect(state.payments[0].mpPaymentId).toBe("mp-pay-1");
  });

  it("idempotente: el mismo webhook 2× descuenta stock una sola vez", async () => {
    const { db, state } = makeFakeDb();
    const deps = makeDeps({ db });
    await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(state.variants.get("v1")).toBe(3); // sigue 3, no 1
    expect(state.couponUsed).toBe(1);
    expect(state.payments).toHaveLength(1); // sin huérfano tras 2 webhooks
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

  it("pedido ya 'paid' (lectura stale de 'pending_payment') → webhook 'cancelled' tardío NO lo pisa", async () => {
    const { db, state } = makeFakeDb();
    state.order.status = "paid"; // el pedido YA está pagado en la "DB" real (otro webhook ganó antes)
    // Este webhook leyó un snapshot desactualizado (findFirst antes de que el otro commiteara).
    db.order.findFirst = vi.fn(async () => ({ ...structuredCloneSafe(state.order), status: "pending_payment" }));
    const deps = makeDeps({ db, getPayment: vi.fn(async () => ({ id: "mp-pay-1", status: "cancelled", external_reference: "ord-1" })) });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.order.status).toBe("paid"); // no lo pisó con "cancelled"
  });

  it("stock insuficiente al momento de decrementar (perdió la carrera contra otro pedido) → no sobrevende, marca oversoldLines", async () => {
    const { db, state } = makeFakeDb();
    state.variants.set("v1", 1); // otro pedido ya se llevó el resto justo antes de este decremento
    const deps = makeDeps({ db }); // este pedido pide qty:2 (ver items del fake db)
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.variants.get("v1")).toBe(1); // NO decrementó (no hay negativo, no hay parcial)
    expect(state.order.status).toBe("paid"); // el pago se acepta igual, se avisa por email
    const ownerEmail = (deps.sendEmail as any).mock.calls.find((c: any) => c[0].to === "owner@test.com");
    expect(ownerEmail[0].html).toContain("Labial");
  });

  it("cupón con maxUses global ya alcanzado (perdió la carrera) → no incrementa más allá del límite", async () => {
    const { db, state } = makeFakeDb({ couponMaxUses: 5, couponUsedCountStart: 5 }); // ya en el límite
    const deps = makeDeps({ db });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.order.status).toBe("paid"); // el pago se acepta igual
    expect(state.couponUsedCount).toBe(5); // NO se incrementó más allá del límite
  });

  it("cupón con perCustomerLimit ya alcanzado para esta clienta → no incrementa más para ella", async () => {
    const { db, state } = makeFakeDb({
      customerId: "cust-1", couponPerCustomerLimit: 1, redemptions: { "cust-1": 1 }, // ya usó su único uso
    });
    const deps = makeDeps({ db });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.order.status).toBe("paid");
    expect(state.redemptions.get("cust-1")).toBe(1); // sigue en 1, no pasó a 2
  });

  it("clienta usa el cupón por primera vez dentro del límite → se registra la redemption", async () => {
    const { db, state } = makeFakeDb({ customerId: "cust-2", couponPerCustomerLimit: 1 });
    const deps = makeDeps({ db });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.redemptions.get("cust-2")).toBe(1);
  });

  it("webhook 'in_process' reordenado tras un 'approved' ya guardado → NO retrocede Payment.status", async () => {
    const { db, state } = makeFakeDb();
    // El pago ya quedó "approved" en una fila reconciliada (mpPaymentId ya asignado).
    state.payments = [{ id: "pay-1", orderId: "ord-1", mpPaymentId: "mp-pay-1", status: "approved", amount: 8260 }];
    const deps = makeDeps({ db, getPayment: vi.fn(async () => ({ id: "mp-pay-1", status: "in_process", external_reference: "ord-1" })) });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.payments[0].status).toBe("approved"); // no retrocedió a in_process
  });

  it("pedido inexistente → 200 (ack)", async () => {
    const deps = makeDeps({ getPayment: vi.fn(async () => ({ id: "mp-pay-1", status: "approved", external_reference: "no-existe" })), db: { ...makeFakeDb().db, order: { findFirst: vi.fn(async () => null), update: vi.fn() } } as any });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
  });
});
