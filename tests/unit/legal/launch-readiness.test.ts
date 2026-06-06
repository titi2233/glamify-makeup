import { describe, it, expect } from "vitest";
import { findIncompletePlaceholders } from "@/lib/legal/launch-readiness";

describe("findIncompletePlaceholders", () => {
  it("detecta valores con [COMPLETAR", () => {
    const missing = findIncompletePlaceholders({ a: "[COMPLETAR: x]", b: "ok", c: 10 });
    expect(missing).toEqual(["a"]);
  });
  it("devuelve [] cuando no hay placeholders", () => {
    expect(findIncompletePlaceholders({ a: "Glamify", b: 5 })).toEqual([]);
  });
});
