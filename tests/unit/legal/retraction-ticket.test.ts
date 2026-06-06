import { describe, it, expect } from "vitest";
import { formatRetractionTicket } from "@/lib/legal/retraction/ticket";

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
