import "server-only";
import { cookies } from "next/headers";

const CART_COOKIE = "glamify_cart";
const COUPON_COOKIE = "glamify_coupon";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export async function getCartIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}
export async function setCartIdCookie(id: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}
export async function getCouponCodeFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(COUPON_COOKIE)?.value ?? null;
}
export async function setCouponCodeCookie(code: string | null): Promise<void> {
  const store = await cookies();
  if (code) store.set(COUPON_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
  else store.delete(COUPON_COOKIE);
}
export async function clearCartCookies(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
  store.delete(COUPON_COOKIE);
}
