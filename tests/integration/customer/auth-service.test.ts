import { describe, it, expect, vi } from "vitest";
import { getCustomerWithDeps, type CustomerAuthDb } from "@/lib/customer/auth";

function makeDeps(user: { id: string; email?: string; name?: string } | null) {
  const upsert = vi.fn(async ({ create }: { create: { id: string; email: string; name: string | null } }) => ({
    id: create.id, email: create.email, name: create.name,
  }));
  const db = { customer: { upsert } } as unknown as CustomerAuthDb;
  const getUser = async () => ({
    data: { user: user ? { id: user.id, email: user.email, user_metadata: { name: user.name ?? null } } : null },
    error: null,
  });
  return { getUser, db, upsert };
}

describe("getCustomerWithDeps", () => {
  it("upsertea y devuelve CustomerUser cuando hay sesión", async () => {
    const { getUser, db, upsert } = makeDeps({ id: "u1", email: "ana@x.com", name: "Ana" });
    const res = await getCustomerWithDeps({ getUser, db });
    expect(res).toEqual({ id: "u1", email: "ana@x.com", name: "Ana" });
    expect(upsert).toHaveBeenCalledOnce();
  });
  it("null si no hay sesión", async () => {
    const { getUser, db } = makeDeps(null);
    expect(await getCustomerWithDeps({ getUser, db })).toBeNull();
  });
  it("null si el user no tiene email", async () => {
    const { getUser, db } = makeDeps({ id: "u1" });
    expect(await getCustomerWithDeps({ getUser, db })).toBeNull();
  });
});
