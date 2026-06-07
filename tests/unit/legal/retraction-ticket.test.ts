import { describe, it, expect } from "vitest";
import { formatRetractionTicket, formatRetractionDate } from "@/lib/legal/retraction/ticket";

describe("formatRetractionTicket", () => {
  it("formatea con padding ARR-000123", () => {
    expect(formatRetractionTicket(123)).toBe("ARR-000123");
    expect(formatRetractionTicket(1)).toBe("ARR-000001");
  });
  it("rechaza secuencias inválidas", () => {
    expect(() => formatRetractionTicket(0)).toThrow();
    expect(() => formatRetractionTicket(1.5)).toThrow();
  });
});

describe("formatRetractionDate", () => {
  it("formatea la fecha en es-AR / huso horario de Argentina", () => {
    const s = formatRetractionDate(new Date("2026-06-06T18:00:00Z"));
    expect(s).toContain("2026");
    expect(s.toLowerCase()).toContain("junio");
  });
});
