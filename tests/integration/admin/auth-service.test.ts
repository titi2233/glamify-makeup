import { describe, it, expect, vi } from "vitest";
import { getAdminUserWithDeps, type GetAdminUserDeps } from "@/lib/admin/auth";

function makeDeps(over: Partial<GetAdminUserDeps> = {}): GetAdminUserDeps {
  return {
    getUser: vi.fn(async () => ({ data: { user: { id: "u-1", email: "duenia@glamify.test" } }, error: null })),
    db: {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === "u-1" ? { id: "u-1", email: "duenia@glamify.test", role: "owner" as const } : null,
        ),
      },
    },
    ...over,
  };
}

describe("getAdminUserWithDeps", () => {
  it("usuario logueado + fila User owner → AdminUser", async () => {
    const deps = makeDeps();
    const u = await getAdminUserWithDeps(deps);
    expect(u).toEqual({ id: "u-1", email: "duenia@glamify.test", role: "owner" });
  });

  it("sin usuario en supabase → null (no consulta la db)", async () => {
    const deps = makeDeps({ getUser: vi.fn(async () => ({ data: { user: null }, error: null })) });
    const u = await getAdminUserWithDeps(deps);
    expect(u).toBeNull();
    expect(deps.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("usuario logueado pero sin fila User → null", async () => {
    const deps = makeDeps({
      db: { user: { findUnique: vi.fn(async () => null) } },
    });
    const u = await getAdminUserWithDeps(deps);
    expect(u).toBeNull();
  });

  it("usa el id del usuario de supabase para buscar la fila", async () => {
    const findUnique = vi.fn(async () => ({ id: "u-9", email: "x@glamify.test", role: "admin" as const }));
    const deps = makeDeps({
      getUser: vi.fn(async () => ({ data: { user: { id: "u-9", email: "x@glamify.test" } }, error: null })),
      db: { user: { findUnique } },
    });
    await getAdminUserWithDeps(deps);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "u-9" } });
  });
});
