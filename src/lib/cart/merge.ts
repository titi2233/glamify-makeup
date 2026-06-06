import "server-only";

interface MinimalCart {
  id: string;
  status: "active" | "ordered" | "abandoned";
  customerId: string | null;
}

export interface MergeCartDb {
  cart: {
    findUnique: (args: { where: { id: string } }) => Promise<MinimalCart | null>;
    findFirst: (args: { where: { customerId: string; status: "active" } }) => Promise<MinimalCart | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  cartItem: {
    findMany: (args: { where: { cartId: string } }) => Promise<Array<{ id: string; variantId: string | null; comboId: string | null; qty: number }>>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
}

export interface MergeCartInput {
  cookieCartId: string | null;
  customerId: string;
  marketingConsent: boolean;
}

/**
 * Regla: el cart de la cookie gana. Si la clienta ya tenía un cart activo distinto,
 * se mueven/consolidan sus items al de la cookie y el viejo queda `abandoned`.
 * Si no hay cookie pero sí cart previo, ese es el canónico (la action setea la cookie).
 */
export async function mergeGuestCartIntoCustomer(
  input: MergeCartInput,
  deps: { db: MergeCartDb },
): Promise<{ canonicalCartId: string | null }> {
  const { db } = deps;
  const cookie = input.cookieCartId
    ? await db.cart.findUnique({ where: { id: input.cookieCartId } })
    : null;
  const cookieActive = cookie && cookie.status === "active" ? cookie : null;

  // Guard: si el cart de la cookie ya pertenece a otra clienta, no lo robamos.
  if (cookieActive && cookieActive.customerId !== null && cookieActive.customerId !== input.customerId) {
    const previous = await db.cart.findFirst({ where: { customerId: input.customerId, status: "active" } });
    return { canonicalCartId: previous ? previous.id : null };
  }

  // Buscamos el cart previo de la clienta una sola vez y lo reutilizamos en ambas ramas.
  const previous = await db.cart.findFirst({ where: { customerId: input.customerId, status: "active" } });

  if (!cookieActive) {
    return { canonicalCartId: previous ? previous.id : null };
  }

  // Cookie gana: asignarle la clienta + consentimiento.
  await db.cart.update({
    where: { id: cookieActive.id },
    data: { customerId: input.customerId, recoveryEmailConsent: input.marketingConsent },
  });

  // Consolidar el cart previo (si existe y es distinto) dentro del de la cookie.
  if (previous && previous.id !== cookieActive.id) {
    const prevItems = await db.cartItem.findMany({ where: { cartId: previous.id } });
    const cookieItems = await db.cartItem.findMany({ where: { cartId: cookieActive.id } });
    for (const it of prevItems) {
      const match = cookieItems.find((c) => c.variantId === it.variantId && c.comboId === it.comboId);
      if (match) {
        await db.cartItem.update({ where: { id: match.id }, data: { qty: match.qty + it.qty } });
        await db.cartItem.delete({ where: { id: it.id } });
      } else {
        await db.cartItem.update({ where: { id: it.id }, data: { cartId: cookieActive.id } });
      }
    }
    await db.cart.update({ where: { id: previous.id }, data: { status: "abandoned" } });
  }

  return { canonicalCartId: cookieActive.id };
}
