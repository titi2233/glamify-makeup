import { describe, it, expect } from "vitest";
import { findIncompletePlaceholders } from "@/lib/legal/launch-readiness";

// Warning NO bloqueante (D-M5-5): avisa, pero no falla la suite con placeholders sin completar.
describe("launch readiness (warning, no bloqueante)", () => {
  it("avisa si quedan datos del negocio sin completar", () => {
    const missing = findIncompletePlaceholders();
    if (missing.length) {
      console.warn(
        `⚠️  Datos del negocio sin completar antes del launch: ${missing.join(", ")} (ver docs/LAUNCH.md)`,
      );
    }
    expect(true).toBe(true);
  });
});
