import { describe, it, expect } from "vitest";
import { retractionAlertEmail, retractionReceiptEmail } from "@/lib/email/templates";

describe("retractionAlertEmail", () => {
  const d = {
    ticket: "ARR-000001",
    contactName: "Ana",
    contactEmail: "ana@mail.com",
    contactPhone: "11",
    orderNumber: "GLM-000009",
    reason: "no me gustó",
  };
  it("incluye constancia y datos en subject/text/html", () => {
    const e = retractionAlertEmail(d);
    expect(e.subject).toContain("ARR-000001");
    expect(e.text).toContain("ana@mail.com");
    expect(e.text).toContain("GLM-000009");
    expect(e.html).toContain("Ana");
  });
  it("tolera opcionales ausentes", () => {
    const e = retractionAlertEmail({ ticket: "ARR-000002", contactName: "Bea", contactEmail: "bea@mail.com" });
    expect(e.html).toContain("ARR-000002");
    expect(e.text).toContain("Bea");
  });

  it("escapa HTML en campos del usuario (anti-inyección)", () => {
    const e = retractionAlertEmail({
      ticket: "ARR-000003",
      contactName: "<script>alert(1)</script>",
      contactEmail: "a@b.com",
      reason: '<a href="https://evil">click</a>',
    });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).not.toContain('<a href="https://evil">');
    expect(e.html).toContain("&lt;a href=");
  });
});

describe("retractionReceiptEmail", () => {
  it("constancia a la clienta con ticket y fecha, nombre escapado", () => {
    const e = retractionReceiptEmail({ ticket: "ARR-000007", date: "6 de junio de 2026, 15:00", contactName: "<b>Ana</b>" });
    expect(e.subject).toContain("ARR-000007");
    expect(e.html).toContain("ARR-000007");
    expect(e.html).toContain("6 de junio de 2026");
    expect(e.html).not.toContain("<b>Ana</b>");
    expect(e.html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(e.text).toContain("ARR-000007");
  });
});
