import { describe, it, expect } from "vitest";
import { retractionAlertEmail } from "@/lib/email/templates";

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
});
