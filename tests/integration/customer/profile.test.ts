import { describe, it, expect, vi } from "vitest";
import { updateProfile, type ProfileDb } from "@/lib/customer/profile";

describe("updateProfile", () => {
  it("actualiza name y phone (trim)", async () => {
    const update = vi.fn(async () => ({}));
    const db = { customer: { update } } as unknown as ProfileDb;
    const res = await updateProfile("u1", { name: "  Ana  ", phone: " 11 " }, { db });
    expect(res.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Ana", phone: "11" } });
  });
  it("rechaza nombre vacío", async () => {
    const db = { customer: { update: vi.fn() } } as unknown as ProfileDb;
    const res = await updateProfile("u1", { name: "  ", phone: "" }, { db });
    expect(res.ok).toBe(false);
  });
});
