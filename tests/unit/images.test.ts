import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { productImageUrl } from "@/lib/images";

const ORIG = process.env.NEXT_PUBLIC_SUPABASE_URL;

describe("productImageUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://xyz.supabase.co";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIG;
  });

  it("antepone la base pública del bucket a un path crudo", () => {
    expect(productImageUrl("products/abc.jpg")).toBe(
      "https://xyz.supabase.co/storage/v1/object/public/product-images/products/abc.jpg",
    );
  });

  it("devuelve null si no hay path", () => {
    expect(productImageUrl(null)).toBeNull();
    expect(productImageUrl(undefined)).toBeNull();
    expect(productImageUrl("")).toBeNull();
  });

  it("pasa de largo una URL absoluta", () => {
    const url = "https://cdn.example.com/x.png";
    expect(productImageUrl(url)).toBe(url);
  });

  it("no duplica la barra si el path arranca con /", () => {
    expect(productImageUrl("/products/abc.jpg")).toBe(
      "https://xyz.supabase.co/storage/v1/object/public/product-images/products/abc.jpg",
    );
  });

  it("tolera barra final en la base", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://xyz.supabase.co/";
    expect(productImageUrl("products/abc.jpg")).toBe(
      "https://xyz.supabase.co/storage/v1/object/public/product-images/products/abc.jpg",
    );
  });

  it("devuelve null si falta la env (no rompe el render)", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(productImageUrl("products/abc.jpg")).toBeNull();
  });
});
