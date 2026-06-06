import { describe, it, expect } from "vitest";
import { hasPurchased } from "@/lib/reviews/purchase";

describe("hasPurchased", () => {
  it("true si compró el producto", () => {
    expect(hasPurchased([{ productId: "p1" }, { productId: "p2" }], "p2")).toBe(true);
  });
  it("false si no lo compró", () => {
    expect(hasPurchased([{ productId: "p1" }], "p9")).toBe(false);
  });
  it("false con lista vacía", () => {
    expect(hasPurchased([], "p1")).toBe(false);
  });
});
