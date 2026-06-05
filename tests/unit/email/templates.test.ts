import { describe, it, expect } from "vitest";
import { orderConfirmationEmail, newOrderAlertEmail, type OrderEmailData } from "@/lib/email/templates";

const data: OrderEmailData = {
  orderNumber: "GLM-000123",
  contactName: "Ana",
  contactEmail: "ana@example.com",
  items: [
    { name: "Labial Mate", variantName: "Rojo Pasión", qty: 2, lineTotal: 6400 },
    { name: "Gloss Brillo", variantName: null, qty: 1, lineTotal: 2500 },
  ],
  subtotal: 8900, shippingCost: 2500, discountTotal: 500, total: 10900,
  shippingMethod: "domicilio",
};

describe("orderConfirmationEmail", () => {
  it("incluye nº de pedido, ítems y total formateado", () => {
    const m = orderConfirmationEmail(data);
    expect(m.subject).toContain("GLM-000123");
    expect(m.html).toContain("Labial Mate");
    expect(m.html).toContain("Rojo Pasión");
    expect(m.html).toContain("$ 10.900,00");
    expect(m.text).toContain("GLM-000123");
  });
});

describe("newOrderAlertEmail", () => {
  it("avisa a la dueña con el total y el contacto", () => {
    const m = newOrderAlertEmail(data);
    expect(m.subject).toContain("GLM-000123");
    expect(m.html).toContain("ana@example.com");
    expect(m.html).toContain("$ 10.900,00");
  });
  it("destaca oversell cuando hay líneas sin stock", () => {
    const m = newOrderAlertEmail({ ...data, oversoldLines: [{ name: "Labial Mate (Rojo Pasión)" }] });
    expect(m.subject.toLowerCase()).toContain("stock");
    expect(m.html).toContain("Labial Mate (Rojo Pasión)");
  });
});
