import { describe, it, expect } from "vitest";
import { validateReview } from "@/lib/reviews/validation";

describe("validateReview", () => {
  it("acepta rating 1-5 y body no vacío", () => {
    expect(validateReview({ rating: 5, body: "Hermoso", title: "Top" }).ok).toBe(true);
  });
  it("rechaza rating fuera de rango", () => {
    expect(validateReview({ rating: 6, body: "x" })).toEqual({ ok: false, reason: "El puntaje debe ser de 1 a 5." });
    expect(validateReview({ rating: 0, body: "x" }).ok).toBe(false);
    expect(validateReview({ rating: 3.5, body: "x" }).ok).toBe(false);
  });
  it("rechaza body vacío", () => {
    expect(validateReview({ rating: 4, body: "   " }).ok).toBe(false);
  });
  it("rechaza body > 2000", () => {
    expect(validateReview({ rating: 4, body: "a".repeat(2001) }).ok).toBe(false);
  });
  it("invitada sin nombre → inválido", () => {
    expect(validateReview({ rating: 5, body: "Buenísimo", authorName: "" }).ok).toBe(false);
    expect(validateReview({ rating: 5, body: "Buenísimo", authorName: " a " }).ok).toBe(false);
  });
  it("invitada con nombre válido → ok", () => {
    expect(validateReview({ rating: 5, body: "Buenísimo", authorName: "Caro" }).ok).toBe(true);
  });
  it("logueada sin authorName → ok (no se valida)", () => {
    expect(validateReview({ rating: 5, body: "Buenísimo" }).ok).toBe(true);
  });
});
