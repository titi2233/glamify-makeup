import { describe, it, expect } from "vitest";
import { classifyReview } from "@/lib/reviews/moderation";

describe("classifyReview", () => {
  it("compra verificada → approved + verifiedPurchase", () => {
    expect(classifyReview(true)).toEqual({ status: "approved", verifiedPurchase: true });
  });
  it("sin compra → pending + no verificada", () => {
    expect(classifyReview(false)).toEqual({ status: "pending", verifiedPurchase: false });
  });
});
