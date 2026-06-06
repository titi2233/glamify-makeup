import "server-only";

export interface ProfileDb {
  customer: {
    update: (args: { where: { id: string }; data: { name: string; phone: string | null } }) => Promise<unknown>;
  };
}

export interface UpdateProfileInput {
  name: string;
  phone: string;
}

export async function updateProfile(
  customerId: string,
  input: UpdateProfileInput,
  deps: { db: ProfileDb },
): Promise<{ ok: boolean; error?: string }> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name) return { ok: false, error: "Ingresá tu nombre." };
  await deps.db.customer.update({ where: { id: customerId }, data: { name, phone: phone || null } });
  return { ok: true };
}
