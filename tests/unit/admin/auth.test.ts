import { describe, it, expect } from "vitest";
import { resolveAdminRole } from "@/lib/admin/auth";

describe("resolveAdminRole", () => {
  it("fila null → null (no hay usuario admin)", () => {
    expect(resolveAdminRole(null)).toBeNull();
  });

  it("role owner → AdminUser", () => {
    const row = { id: "u-1", email: "duenia@glamify.test", role: "owner" as const };
    expect(resolveAdminRole(row)).toEqual({ id: "u-1", email: "duenia@glamify.test", role: "owner" });
  });

  it("role admin → AdminUser", () => {
    const row = { id: "u-2", email: "staff@glamify.test", role: "admin" as const };
    expect(resolveAdminRole(row)).toEqual({ id: "u-2", email: "staff@glamify.test", role: "admin" });
  });
});
