import { describe, it, expect } from "vitest";
import { abandonedCartEmail } from "@/lib/email/templates";

describe("abandonedCartEmail", () => {
  it("incluye el nombre, los items y el link de recupero", () => {
    const r = abandonedCartEmail({
      name: "Ana",
      items: [{ name: "Labial", variantName: "Rojo", qty: 2, lineTotal: 9000 }],
      recoverUrl: "http://localhost:3000/carrito",
    });
    expect(r.subject).toMatch(/carrito/i);
    expect(r.html).toContain("Ana");
    expect(r.html).toContain("Labial");
    expect(r.html).toContain("http://localhost:3000/carrito");
    expect(r.text).toContain("Labial");
  });
});
