import { describe, it, expect } from "vitest";
import { toCustomerUser } from "@/lib/customer/auth";

describe("toCustomerUser", () => {
  it("mapea una fila a CustomerUser", () => {
    expect(toCustomerUser({ id: "u1", email: "a@b.com", name: "Ana" })).toEqual({
      id: "u1", email: "a@b.com", name: "Ana",
    });
  });
  it("null si no hay fila", () => {
    expect(toCustomerUser(null)).toBeNull();
  });
});
