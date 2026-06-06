# M4 — Cuentas + Clientas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a la clienta una cuenta completa (registro/login email+Google, perfil con datos/pedidos/favoritos), reseñas con compra verificada auto-publicadas, recupero de carrito abandonado (Cron Trigger), autocancelación de pedidos (Cron Trigger) y enforcement de cupones por clienta.

**Architecture:** Se reusa el patrón del admin (M3): Server Components para lecturas, Server Actions que devuelven `ActionResult` para mutaciones, lógica de dominio en funciones puras (`src/lib/<domain>/*`, unit-tested) y servicios con `deps` inyectable (integration-tested con `vi.fn`). La auth de clientas espeja `src/lib/admin/auth.ts` sobre Supabase Auth (`@supabase/ssr`). Los crons usan un worker entry custom que re-exporta el `fetch` de `@opennextjs/cloudflare` y agrega `scheduled()`, invocando módulos de job auto-contenidos (sin `server-only`, Prisma construido desde `env`).

**Tech Stack:** Next.js 15 (App Router) · TypeScript strict · Prisma + `@prisma/adapter-pg` · Supabase Auth · Resend · Cloudflare Workers (`@opennextjs/cloudflare` + Cron Triggers) · Vitest · Playwright · shadcn/ui + Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-06-m4-cuentas-clientas-design.md`. **Branch:** `m4-cuentas` (ya creada off `m3-admin`).

---

## Convenciones (recordatorio)

- Después de **cada** cambio: `pnpm typecheck` + `pnpm test`. Nunca `any`. Strict.
- Tests unit en `tests/unit/<domain>/*.test.ts`; integration en `tests/integration/<domain>/*.test.ts`. `vitest run`.
- Server Actions: archivo con `"use server"` arriba; cada action de área protegida llama `requireCustomer()` **primero**.
- Commits frecuentes, mensajes `feat(m4): …` / `test(m4): …` / `chore(m4): …`. Cada commit termina con la línea `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Montos `Decimal(12,2)` → `toNumber()` para cálculo; UTC en DB.

## Interfaces & contratos compartidos (fuente de verdad de tipos)

Estos tipos se **definen** en las tareas indicadas y se **reusan** tal cual en tareas posteriores:

- `ActionResult { ok: boolean; error?: string }` — `src/lib/forms/action-result.ts` (Task 1).
- `CustomerUser { id: string; email: string; name: string | null }` — `src/lib/customer/auth.ts` (Task 2).
- `requireCustomer(): Promise<CustomerUser>` y `getCustomer(): Promise<CustomerUser | null>` — Task 2.
- `mergeGuestCartIntoCustomer(args): Promise<{ canonicalCartId: string | null }>` — `src/lib/cart/merge.ts` (Task 5).
- `hasPurchased(items: { productId: string }[], productId: string): boolean` — `src/lib/reviews/purchase.ts` (Task 14).
- `validateReview(input: ReviewInput): ReviewValidation` — `src/lib/reviews/validation.ts` (Task 14).
- `createReview(input, deps): Promise<{ id: string }>` — `src/lib/reviews/service.ts` (Task 15).
- `toggleWishlist(customerId, productId, deps): Promise<{ added: boolean }>` — `src/lib/wishlist/service.ts` (Task 11).
- `validateCoupon(coupon, ctx)` extendido con `perCustomerLimit?`/`customerRedemptions?` — `src/lib/coupons/apply.ts` (Task 17).
- `findAbandonedCarts(rows, now, idleHours)` y `runAbandonedCartJob(deps)` — `src/lib/cart/abandoned.ts` (Task 21/22).
- `runOrderExpiryJob(deps)` — `src/lib/orders/expiry-job.ts` (Task 23).
- `buildCronDeps(env)` — `src/lib/cron/deps.ts` (Task 24).

---

## Task 1: Migración de schema + tipo `ActionResult`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/forms/action-result.ts`
- Create (generada): `prisma/migrations/<timestamp>_m4_accounts/`

- [ ] **Step 1: Agregar el modelo `CouponRedemption` y back-relations**

En `prisma/schema.prisma`, agregar el modelo nuevo (cerca de `Coupon`):

```prisma
model CouponRedemption {
  customerId     String    @db.Uuid
  customer       Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  couponId       String    @db.Uuid
  coupon         Coupon    @relation(fields: [couponId], references: [id], onDelete: Cascade)
  redeemedCount  Int       @default(0)
  lastRedeemedAt DateTime?

  @@id([customerId, couponId])
  @@index([couponId])
}
```

En `model Customer`, agregar dos líneas:

```prisma
  marketingConsent Boolean            @default(false)
  redemptions      CouponRedemption[]
```

En `model Coupon`, agregar la back-relation:

```prisma
  redemptions      CouponRedemption[]
```

- [ ] **Step 2: Agregar campos a `Cart` y unique a `Review`**

En `model Cart`, agregar:

```prisma
  recoveryEmailConsent Boolean   @default(false)
  abandonedEmailSentAt DateTime?
```

En `model Review`, agregar al final del bloque (junto a `@@index([productId])`):

```prisma
  @@unique([customerId, productId])
```

- [ ] **Step 3: Crear y aplicar la migración**

Run: `npx prisma migrate dev --name m4_accounts`
Expected: crea `prisma/migrations/<ts>_m4_accounts/migration.sql` y aplica sin error. (En worktree: asegurar `.env` con `DATABASE_URL`/`DIRECT_URL`, no solo `.env.local`.)

- [ ] **Step 4: Regenerar el client y typecheck**

Run: `npx prisma generate && pnpm typecheck`
Expected: sin errores. (Aparecen los tipos `CouponRedemption`, `Cart.recoveryEmailConsent`, etc.)

- [ ] **Step 5: Crear el tipo compartido `ActionResult`**

Create `src/lib/forms/action-result.ts`:

```ts
/** Resultado estándar de un Server Action (mismo shape que (storefront)/actions.ts). */
export interface ActionResult {
  ok: boolean;
  error?: string;
}
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/forms/action-result.ts
git commit -m "feat(m4): migración de cuentas (CouponRedemption, consentimiento de carrito, unique de reseña) + ActionResult"
```

---

## Task 2: Auth de clientas — `requireCustomer()` (mirror de admin/auth)

**Files:**
- Create: `src/lib/customer/auth.ts`
- Test: `tests/unit/customer/auth.test.ts`, `tests/integration/customer/auth-service.test.ts`

- [ ] **Step 1: Escribir el test unit de la pura `toCustomerUser`**

Create `tests/unit/customer/auth.test.ts`:

```ts
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
```

- [ ] **Step 2: Run para verificar que falla**

Run: `pnpm test -- tests/unit/customer/auth.test.ts`
Expected: FAIL ("Cannot find module '@/lib/customer/auth'").

- [ ] **Step 3: Implementar `src/lib/customer/auth.ts`**

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export interface CustomerUser {
  id: string;
  email: string;
  name: string | null;
}

export type CustomerRow = { id: string; email: string; name: string | null } | null;

/** Pura: fila Customer → CustomerUser | null. */
export function toCustomerUser(row: CustomerRow): CustomerUser | null {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name };
}

/** Superficie mínima de DB para el upsert-on-load (mockeable en tests). */
export interface CustomerAuthDb {
  customer: {
    upsert: (args: {
      where: { id: string };
      create: { id: string; email: string; name: string | null };
      update: { email: string };
    }) => Promise<CustomerRow>;
  };
}

export type SupabaseGetUser = () => Promise<{
  data: { user: { id: string; email?: string | null; user_metadata?: { name?: string | null } } | null };
  error: unknown;
}>;

export interface GetCustomerDeps {
  getUser: SupabaseGetUser;
  db: CustomerAuthDb;
}

/** Core inyectable: supabase user → upsert Customer (id=uid) → CustomerUser | null. */
export async function getCustomerWithDeps(deps: GetCustomerDeps): Promise<CustomerUser | null> {
  const { data } = await deps.getUser();
  const authUser = data.user;
  if (!authUser || !authUser.email) return null;
  const row = await deps.db.customer.upsert({
    where: { id: authUser.id },
    create: { id: authUser.id, email: authUser.email, name: authUser.user_metadata?.name ?? null },
    update: { email: authUser.email },
  });
  return toCustomerUser(row);
}

/** Wrapper real: cablea supabase server client + prisma. */
export async function getCustomer(): Promise<CustomerUser | null> {
  const supabase = await createClient();
  return getCustomerWithDeps({
    getUser: () => supabase.auth.getUser(),
    db: prisma as unknown as CustomerAuthDb,
  });
}

/** Guard: sin sesión → redirect /ingresar; si hay clienta, la devuelve. */
export async function requireCustomer(): Promise<CustomerUser> {
  const user = await getCustomer();
  if (!user) redirect("/ingresar");
  return user;
}
```

- [ ] **Step 4: Run unit, verificar PASS**

Run: `pnpm test -- tests/unit/customer/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir el test integration de `getCustomerWithDeps`**

Create `tests/integration/customer/auth-service.test.ts`:

```ts
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
```

- [ ] **Step 6: Run integration, verificar PASS**

Run: `pnpm test -- tests/integration/customer/auth-service.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/customer/auth.ts tests/unit/customer/auth.test.ts tests/integration/customer/auth-service.test.ts
git commit -m "feat(m4): requireCustomer() y upsert de Customer on-load (mirror de admin auth)"
```

---

## Task 3: Merge de carrito invitado → clienta

**Files:**
- Create: `src/lib/cart/merge.ts`
- Test: `tests/integration/cart/merge.test.ts`

- [ ] **Step 1: Escribir el test integration**

Create `tests/integration/cart/merge.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { mergeGuestCartIntoCustomer, type MergeCartDb } from "@/lib/cart/merge";

function makeDb(over: Partial<Record<string, unknown>> = {}) {
  return {
    cart: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "cookie" ? { id: "cookie", status: "active", customerId: null } : null),
      findFirst: vi.fn(async () => null), // sin cart previo de la clienta
      update: vi.fn(async () => ({})),
    },
    cartItem: { findMany: vi.fn(async () => []), update: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) },
    ...over,
  } as unknown as MergeCartDb;
}

describe("mergeGuestCartIntoCustomer", () => {
  it("asigna customerId al cart de la cookie y propaga consentimiento", async () => {
    const db = makeDb();
    const res = await mergeGuestCartIntoCustomer(
      { cookieCartId: "cookie", customerId: "u1", marketingConsent: true },
      { db },
    );
    expect(res.canonicalCartId).toBe("cookie");
    expect(db.cart.update).toHaveBeenCalledWith({
      where: { id: "cookie" },
      data: { customerId: "u1", recoveryEmailConsent: true },
    });
  });

  it("sin cookie pero con cart previo de la clienta → devuelve ese id", async () => {
    const db = makeDb({
      cart: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => ({ id: "prev", status: "active", customerId: "u1" })),
        update: vi.fn(async () => ({})),
      },
    });
    const res = await mergeGuestCartIntoCustomer(
      { cookieCartId: null, customerId: "u1", marketingConsent: false },
      { db },
    );
    expect(res.canonicalCartId).toBe("prev");
  });

  it("sin cookie ni cart previo → null", async () => {
    const db = makeDb({
      cart: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    });
    const res = await mergeGuestCartIntoCustomer(
      { cookieCartId: null, customerId: "u1", marketingConsent: false },
      { db },
    );
    expect(res.canonicalCartId).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/integration/cart/merge.test.ts`
Expected: FAIL ("Cannot find module '@/lib/cart/merge'").

- [ ] **Step 3: Implementar `src/lib/cart/merge.ts`**

```ts
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
```

- [ ] **Step 4: Run, verificar PASS**

Run: `pnpm test -- tests/integration/cart/merge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cart/merge.ts tests/integration/cart/merge.test.ts
git commit -m "feat(m4): merge de carrito invitado al loguear (cookie gana, propaga consentimiento)"
```

---

## Task 4: Página `/ingresar` + Server Actions de auth

**Files:**
- Create: `src/app/(storefront)/ingresar/actions.ts`
- Create: `src/app/(storefront)/ingresar/page.tsx`
- Create: `src/app/(storefront)/ingresar/ingresar-form.tsx`
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Implementar las actions de auth**

Create `src/app/(storefront)/ingresar/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer/auth";
import { mergeGuestCartIntoCustomer } from "@/lib/cart/merge";
import { getCartIdFromCookie, setCartIdCookie } from "@/lib/cart/cart-cookie";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/forms/action-result";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Tras autenticar, asocia el carrito de la cookie a la clienta. */
export async function mergeCartForCurrentCustomer(): Promise<void> {
  const customer = await getCustomer();
  if (!customer) return;
  const row = await prisma.customer.findUnique({ where: { id: customer.id }, select: { marketingConsent: true } });
  const cookieCartId = await getCartIdFromCookie();
  const { canonicalCartId } = await mergeGuestCartIntoCustomer(
    { cookieCartId, customerId: customer.id, marketingConsent: row?.marketingConsent ?? false },
    { db: prisma as never },
  );
  if (canonicalCartId && canonicalCartId !== cookieCartId) await setCartIdCookie(canonicalCartId);
}

export async function signInAction(input: { email: string; password: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error) return { ok: false, error: "Email o contraseña incorrectos." };
  await mergeCartForCurrentCustomer();
  return { ok: true };
}

export async function signUpAction(input: {
  email: string; password: string; name: string; marketingConsent: boolean;
}): Promise<ActionResult & { needsConfirmation?: boolean }> {
  const supabase = await createClient();
  const email = input.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { name: input.name.trim() }, emailRedirectTo: `${appUrl()}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  // Persistir consentimiento si la fila ya existe (confirmación ON → puede no haber sesión aún).
  if (data.user) {
    await prisma.customer.upsert({
      where: { id: data.user.id },
      create: { id: data.user.id, email, name: input.name.trim(), marketingConsent: input.marketingConsent },
      update: { marketingConsent: input.marketingConsent },
    });
  }
  return { ok: true, needsConfirmation: !data.session };
}

export async function signInWithGoogleAction(): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${appUrl()}/auth/callback` },
  });
  if (error || !data.url) return { ok: false, error: "No se pudo iniciar sesión con Google." };
  return { ok: true, url: data.url };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 2: Implementar el form (client)**

Create `src/app/(storefront)/ingresar/ingresar-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, signUpAction, signInWithGoogleAction } from "./actions";

type Mode = "in" | "up";

export function IngresarForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("in");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setInfo(null); setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    try {
      if (mode === "in") {
        const res = await signInAction({ email, password });
        if (!res.ok) { setError(res.error ?? "Error"); return; }
        router.push("/cuenta");
      } else {
        const res = await signUpAction({
          email, password,
          name: String(fd.get("name") ?? ""),
          marketingConsent: fd.get("consent") === "on",
        });
        if (!res.ok) { setError(res.error ?? "Error"); return; }
        if (res.needsConfirmation) setInfo("¡Listo! Revisá tu correo para confirmar tu cuenta.");
        else router.push("/cuenta");
      }
    } finally { setPending(false); }
  }

  async function onGoogle() {
    setError(null);
    const res = await signInWithGoogleAction();
    if (res.ok && res.url) window.location.href = res.url;
    else setError(res.error ?? "Error con Google.");
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <div className="grid grid-cols-2 rounded-xl border border-border p-1 text-sm">
        <button type="button" onClick={() => setMode("in")} className={mode === "in" ? "rounded-lg bg-primary py-2 font-medium text-primary-foreground" : "py-2"}>Ingresar</button>
        <button type="button" onClick={() => setMode("up")} className={mode === "up" ? "rounded-lg bg-primary py-2 font-medium text-primary-foreground" : "py-2"}>Crear cuenta</button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "up" && (
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} required />
        </div>
        {mode === "up" && (
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="consent" className="mt-1" />
            Quiero recibir novedades y recordatorios de mi carrito.
          </label>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-primary">{info}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {mode === "in" ? "Ingresar" : "Crear cuenta"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
        Continuar con Google
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Implementar la página**

Create `src/app/(storefront)/ingresar/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer/auth";
import { IngresarForm } from "./ingresar-form";

export const metadata: Metadata = { title: "Ingresar — Glamify Makeup" };

export default async function IngresarPage() {
  const customer = await getCustomer();
  if (customer) redirect("/cuenta");
  return (
    <section className="py-8">
      <h1 className="mb-6 text-center font-display text-2xl font-bold">Tu cuenta Glamify</h1>
      <IngresarForm />
    </section>
  );
}
```

- [ ] **Step 4: Implementar el callback OAuth**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mergeCartForCurrentCustomer } from "@/app/(storefront)/ingresar/actions";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  if (error) return NextResponse.redirect(`${origin}/ingresar?error=oauth`);
  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return NextResponse.redirect(`${origin}/ingresar?error=oauth`);
    await mergeCartForCurrentCustomer();
  }
  return NextResponse.redirect(`${origin}/cuenta`);
}
```

- [ ] **Step 5: Typecheck + build verifican que compila**

Run: `pnpm typecheck`
Expected: PASS. (La verificación funcional de `/ingresar` queda para el e2e de Task 26; manual opcional: `pnpm dev` → abrir `/ingresar`.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/(storefront)/ingresar" src/app/auth/callback/route.ts
git commit -m "feat(m4): /ingresar (email+password + Google) + callback OAuth con merge de carrito"
```

---

## Task 5: Middleware — refrescar sesión en `/cuenta` y `/auth`

**Files:**
- Modify: `src/middleware.ts:33-35`

- [ ] **Step 1: Extender el matcher**

En `src/middleware.ts`, reemplazar el bloque `config`:

```ts
export const config = {
  matcher: ["/admin/:path*", "/cuenta/:path*", "/auth/:path*"],
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/middleware.ts
git commit -m "feat(m4): middleware refresca sesión también en /cuenta y /auth"
```

---

## Task 6: Layout y dashboard de `/cuenta`

**Files:**
- Create: `src/app/(storefront)/cuenta/layout.tsx`
- Create: `src/app/(storefront)/cuenta/page.tsx`
- Create: `src/app/(storefront)/cuenta/account-nav.tsx`

- [ ] **Step 1: Layout protegido + nav**

Create `src/app/(storefront)/cuenta/account-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "../ingresar/actions";

const LINKS = [
  { href: "/cuenta", label: "Inicio" },
  { href: "/cuenta/datos", label: "Mis datos" },
  { href: "/cuenta/pedidos", label: "Mis pedidos" },
  { href: "/cuenta/favoritos", label: "Favoritos" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/cuenta" ? pathname === "/cuenta" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={cn("rounded-full border border-border px-3 py-1.5", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {l.label}
          </Link>
        );
      })}
      <form action={signOutAction}>
        <button type="submit" className="rounded-full border border-border px-3 py-1.5 text-muted-foreground">Salir</button>
      </form>
    </nav>
  );
}
```

Create `src/app/(storefront)/cuenta/layout.tsx`:

```tsx
import { requireCustomer } from "@/lib/customer/auth";
import { AccountNav } from "./account-nav";

export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  await requireCustomer();
  return (
    <section className="space-y-6 py-6">
      <h1 className="font-display text-2xl font-bold">Mi cuenta</h1>
      <AccountNav />
      <div>{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Dashboard**

Create `src/app/(storefront)/cuenta/page.tsx`:

```tsx
import Link from "next/link";
import { requireCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";

export default async function CuentaHome() {
  const customer = await requireCustomer();
  const [orders, wishlistCount] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { orderNumber: true, total: true, status: true },
    }),
    prisma.wishlist.count({ where: { customerId: customer.id } }),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Hola{customer.name ? `, ${customer.name}` : ""} 👋</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/cuenta/pedidos" className="rounded-2xl border border-border p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Últimos pedidos</p>
          {orders.length === 0 ? (
            <p className="mt-2 text-sm">Todavía no tenés pedidos.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {orders.map((o) => (
                <li key={o.orderNumber} className="flex justify-between">
                  <span>{o.orderNumber}</span>
                  <span className="tabular-nums">{formatARS(Number(o.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </Link>
        <Link href="/cuenta/favoritos" className="rounded-2xl border border-border p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Favoritos</p>
          <p className="mt-2 text-2xl font-bold">{wishlistCount}</p>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add "src/app/(storefront)/cuenta/layout.tsx" "src/app/(storefront)/cuenta/page.tsx" "src/app/(storefront)/cuenta/account-nav.tsx"
git commit -m "feat(m4): layout protegido de /cuenta + dashboard"
```

---

## Task 7: `/cuenta/datos` — editar perfil

**Files:**
- Create: `src/lib/customer/profile.ts`
- Create: `src/app/(storefront)/cuenta/datos/actions.ts`
- Create: `src/app/(storefront)/cuenta/datos/page.tsx`
- Create: `src/app/(storefront)/cuenta/datos/datos-form.tsx`
- Test: `tests/integration/customer/profile.test.ts`

- [ ] **Step 1: Test integration del servicio `updateProfile`**

Create `tests/integration/customer/profile.test.ts`:

```ts
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
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/integration/customer/profile.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar el servicio**

Create `src/lib/customer/profile.ts`:

```ts
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
```

- [ ] **Step 4: Run, verificar PASS**

Run: `pnpm test -- tests/integration/customer/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Action + página + form**

Create `src/app/(storefront)/cuenta/datos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/customer/auth";
import { updateProfile } from "@/lib/customer/profile";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/forms/action-result";

export async function updateProfileAction(input: { name: string; phone: string }): Promise<ActionResult> {
  const customer = await requireCustomer();
  const res = await updateProfile(customer.id, input, { db: prisma as never });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/cuenta/datos");
  return { ok: true };
}
```

Create `src/app/(storefront)/cuenta/datos/datos-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "./actions";

export function DatosForm({ initial }: { initial: { name: string; phone: string; email: string } }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false); setError(null); setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await updateProfileAction({ name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? "") });
    setPending(false);
    if (res.ok) setSaved(true); else setError(res.error ?? "Error");
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={initial.name} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={initial.phone} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={initial.email} readOnly disabled />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-primary">Guardado ✓</p>}
      <Button type="submit" disabled={pending}>Guardar</Button>
    </form>
  );
}
```

Create `src/app/(storefront)/cuenta/datos/page.tsx`:

```tsx
import { requireCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { DatosForm } from "./datos-form";

export default async function DatosPage() {
  const customer = await requireCustomer();
  const row = await prisma.customer.findUnique({ where: { id: customer.id }, select: { name: true, phone: true, email: true } });
  return <DatosForm initial={{ name: row?.name ?? "", phone: row?.phone ?? "", email: row?.email ?? "" }} />;
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck && pnpm test -- tests/integration/customer/profile.test.ts`
Expected: PASS.

```bash
git add src/lib/customer/profile.ts "src/app/(storefront)/cuenta/datos" tests/integration/customer/profile.test.ts
git commit -m "feat(m4): /cuenta/datos editar perfil (name/phone)"
```

---

## Task 8: `/cuenta/pedidos` — lista y detalle

**Files:**
- Create: `src/app/(storefront)/cuenta/pedidos/page.tsx`
- Create: `src/app/(storefront)/cuenta/pedidos/[orderNumber]/page.tsx`
- Reuse: `src/components/ui/badge.tsx`, `src/lib/money.ts`

- [ ] **Step 1: Lista de pedidos**

Create `src/app/(storefront)/cuenta/pedidos/page.tsx`:

```tsx
import Link from "next/link";
import { requireCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pago pendiente", paid: "Pagado", preparing: "Preparando",
  shipped: "Enviado", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reembolsado",
};

export default async function PedidosPage() {
  const customer = await requireCustomer();
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true, total: true, status: true, createdAt: true },
  });

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <p>Todavía no hiciste ningún pedido.</p>
        <Link href="/tienda" className="mt-3 inline-block text-primary underline">Ver la tienda</Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.orderNumber}>
          <Link href={`/cuenta/pedidos/${o.orderNumber}`} className="flex items-center justify-between rounded-2xl border border-border p-4 shadow-soft">
            <div>
              <p className="font-medium">{o.orderNumber}</p>
              <p className="text-xs text-muted-foreground">{o.createdAt.toLocaleDateString("es-AR")}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{STATUS_LABEL[o.status] ?? o.status}</Badge>
              <span className="tabular-nums font-semibold">{formatARS(Number(o.total))}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Detalle de pedido (read-only, linkea al producto)**

Create `src/app/(storefront)/cuenta/pedidos/[orderNumber]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pago pendiente", paid: "Pagado", preparing: "Preparando",
  shipped: "Enviado", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reembolsado",
};

export default async function PedidoDetallePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const customer = await requireCustomer();
  const order = await prisma.order.findFirst({
    where: { orderNumber, customerId: customer.id },
    include: {
      items: { include: { variant: { include: { product: { select: { slug: true } } } } } },
      shipment: true,
    },
  });
  if (!order) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{order.orderNumber}</h2>
        <Badge variant="secondary">{STATUS_LABEL[order.status] ?? order.status}</Badge>
      </div>

      <ul className="space-y-2">
        {order.items.map((it) => {
          const slug = it.variant?.product.slug;
          const label = it.variantNameSnapshot ? `${it.productNameSnapshot} — ${it.variantNameSnapshot}` : it.productNameSnapshot;
          return (
            <li key={it.id} className="flex justify-between text-sm">
              <span>{slug ? <Link href={`/producto/${slug}`} className="underline">{label}</Link> : label} × {it.qty}</span>
              <span className="tabular-nums">{formatARS(Number(it.lineTotal))}</span>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatARS(Number(order.subtotal))}</span></div>
        {Number(order.discountTotal) > 0 && <div className="flex justify-between"><span>Descuento</span><span className="tabular-nums">-{formatARS(Number(order.discountTotal))}</span></div>}
        <div className="flex justify-between"><span>Envío</span><span className="tabular-nums">{formatARS(Number(order.shippingCost))}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{formatARS(Number(order.total))}</span></div>
      </div>

      {order.shipment?.trackingNumber && (
        <p className="text-sm text-muted-foreground">Seguimiento: <strong>{order.shipment.trackingNumber}</strong></p>
      )}
      <Link href="/cuenta/pedidos" className="inline-block text-sm text-primary underline">← Volver a mis pedidos</Link>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add "src/app/(storefront)/cuenta/pedidos"
git commit -m "feat(m4): /cuenta/pedidos lista + detalle read-only con link al producto"
```

---

## Task 9: Habilitar acceso a la cuenta (bottom-nav + header)

**Files:**
- Modify: `src/components/layout/bottom-nav.tsx:21`
- Modify: `src/components/layout/site-header.tsx`

- [ ] **Step 1: Habilitar "Cuenta" en el bottom-nav**

En `src/components/layout/bottom-nav.tsx`, reemplazar la línea del ítem Cuenta:

```ts
  { href: "/cuenta", label: "Cuenta", icon: User, enabled: true },
```

(El guard `requireCustomer()` del layout redirige a `/ingresar` si no hay sesión.)

- [ ] **Step 2: Agregar acceso en el header (desktop)**

En `src/components/layout/site-header.tsx`, agregar un link a `/cuenta` junto al `CartButton`. Importar el ícono y añadir, dentro del contenedor de acciones del header (al lado de `<CartButton .../>`):

```tsx
import { User } from "lucide-react";
import Link from "next/link";
// ...
<Link href="/cuenta" aria-label="Mi cuenta" className="hidden md:inline-flex p-2 text-foreground hover:text-primary">
  <User className="size-5" aria-hidden />
</Link>
```

(Ubicarlo respetando el layout existente del header; si `Link` ya está importado, no duplicar el import.)

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/components/layout/bottom-nav.tsx src/components/layout/site-header.tsx
git commit -m "feat(m4): habilitar acceso a /cuenta en bottom-nav y header"
```

---

## Task 10: Wishlist — servicio + action

**Files:**
- Create: `src/lib/wishlist/service.ts`
- Create: `src/app/(storefront)/cuenta/favoritos/actions.ts`
- Test: `tests/integration/wishlist/service.test.ts`

- [ ] **Step 1: Test integration del toggle**

Create `tests/integration/wishlist/service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { toggleWishlist, type WishlistDb } from "@/lib/wishlist/service";

function makeDb(exists: boolean) {
  return {
    wishlist: {
      findUnique: vi.fn(async () => (exists ? { customerId: "u1", productId: "p1" } : null)),
      create: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
  } as unknown as WishlistDb;
}

describe("toggleWishlist", () => {
  it("agrega cuando no existe", async () => {
    const db = makeDb(false);
    const res = await toggleWishlist("u1", "p1", { db });
    expect(res.added).toBe(true);
    expect(db.wishlist.create).toHaveBeenCalledWith({ data: { customerId: "u1", productId: "p1" } });
  });
  it("quita cuando ya existe", async () => {
    const db = makeDb(true);
    const res = await toggleWishlist("u1", "p1", { db });
    expect(res.added).toBe(false);
    expect(db.wishlist.delete).toHaveBeenCalledWith({ where: { customerId_productId: { customerId: "u1", productId: "p1" } } });
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/integration/wishlist/service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar el servicio**

Create `src/lib/wishlist/service.ts`:

```ts
import "server-only";

export interface WishlistDb {
  wishlist: {
    findUnique: (args: { where: { customerId_productId: { customerId: string; productId: string } } }) => Promise<{ customerId: string } | null>;
    create: (args: { data: { customerId: string; productId: string } }) => Promise<unknown>;
    delete: (args: { where: { customerId_productId: { customerId: string; productId: string } } }) => Promise<unknown>;
  };
}

export async function toggleWishlist(
  customerId: string,
  productId: string,
  deps: { db: WishlistDb },
): Promise<{ added: boolean }> {
  const key = { customerId_productId: { customerId, productId } };
  const existing = await deps.db.wishlist.findUnique({ where: key });
  if (existing) {
    await deps.db.wishlist.delete({ where: key });
    return { added: false };
  }
  await deps.db.wishlist.create({ data: { customerId, productId } });
  return { added: true };
}
```

- [ ] **Step 4: Run, verificar PASS**

Run: `pnpm test -- tests/integration/wishlist/service.test.ts`
Expected: PASS.

- [ ] **Step 5: Action**

Create `src/app/(storefront)/cuenta/favoritos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCustomer } from "@/lib/customer/auth";
import { toggleWishlist } from "@/lib/wishlist/service";
import { prisma } from "@/lib/prisma";

export interface WishlistToggleResult {
  ok: boolean;
  added?: boolean;
  needsAuth?: boolean;
  error?: string;
}

export async function toggleWishlistAction(productId: string): Promise<WishlistToggleResult> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, needsAuth: true };
  try {
    const res = await toggleWishlist(customer.id, productId, { db: prisma as never });
    revalidatePath("/cuenta/favoritos");
    return { ok: true, added: res.added };
  } catch {
    return { ok: false, error: "No se pudo actualizar favoritos." };
  }
}

export async function isWishlisted(productId: string): Promise<boolean> {
  const customer = await getCustomer();
  if (!customer) return false;
  const row = await prisma.wishlist.findUnique({
    where: { customerId_productId: { customerId: customer.id, productId } },
  });
  return Boolean(row);
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/lib/wishlist/service.ts "src/app/(storefront)/cuenta/favoritos/actions.ts" tests/integration/wishlist/service.test.ts
git commit -m "feat(m4): servicio + action de wishlist (toggle)"
```

---

## Task 11: WishlistHeart + página de favoritos + wiring

**Files:**
- Create: `src/components/catalog/wishlist-heart.tsx`
- Create: `src/app/(storefront)/cuenta/favoritos/page.tsx`
- Modify: `src/app/(storefront)/producto/[slug]/page.tsx`
- Modify: `src/components/catalog/product-card.tsx`

- [ ] **Step 1: Componente WishlistHeart (client, optimista)**

Create `src/components/catalog/wishlist-heart.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleWishlistAction } from "@/app/(storefront)/cuenta/favoritos/actions";

export function WishlistHeart({ productId, initial = false, className }: { productId: string; initial?: boolean; className?: string }) {
  const router = useRouter();
  const [active, setActive] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !active;
    setActive(next); // optimista
    startTransition(async () => {
      const res = await toggleWishlistAction(productId);
      if (res.needsAuth) { router.push("/ingresar"); return; }
      if (!res.ok) { setActive(!next); return; } // revertir
      if (typeof res.added === "boolean") setActive(res.added);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? "Quitar de favoritos" : "Agregar a favoritos"}
      className={cn("grid size-9 place-items-center rounded-full border border-border bg-background/80 backdrop-blur transition", className)}
    >
      <Heart className={cn("size-5", active ? "fill-primary text-primary" : "text-muted-foreground")} aria-hidden />
    </button>
  );
}
```

- [ ] **Step 2: Página de favoritos**

Create `src/app/(storefront)/cuenta/favoritos/page.tsx`:

```tsx
import Link from "next/link";
import { requireCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/catalog/product-card";
import { CATALOG_LIST_SELECT } from "@/lib/catalog/queries";

export default async function FavoritosPage() {
  const customer = await requireCustomer();
  const rows = await prisma.wishlist.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    include: { product: { select: CATALOG_LIST_SELECT } },
  });
  const products = rows.map((r) => r.product).filter((p) => p.active && !p.deletedAt);

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <p>Todavía no guardaste favoritos.</p>
        <Link href="/tienda" className="mt-3 inline-block text-primary underline">Explorar la tienda</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
```

> **Nota de implementación:** `CATALOG_LIST_SELECT` debe ser el `select`/shape que ya usa el listado de catálogo para `CatalogListItem` (en `src/lib/catalog/queries.ts`). Si hoy ese shape se arma con un objeto literal no exportado, **exportá** la constante `CATALOG_LIST_SELECT` desde `queries.ts` y reusala acá (DRY). Verificar que incluye `id, slug, name, images, category, variants, basePrice, compareAtPrice, active, deletedAt` (lo que consume `ProductCard`).

- [ ] **Step 3: Insertar el corazón en la ficha de producto**

En `src/app/(storefront)/producto/[slug]/page.tsx`:

Agregar imports:

```tsx
import { WishlistHeart } from "@/components/catalog/wishlist-heart";
import { isWishlisted } from "@/app/(storefront)/cuenta/favoritos/actions";
```

Dentro del componente, antes del `return`, calcular el estado:

```tsx
  const wishlisted = await isWishlisted(product.id);
```

Reemplazar el `<header>` del bloque de info por:

```tsx
          <header className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{product.category.name}</p>
              <h1 className="font-display text-2xl font-bold md:text-3xl">{product.name}</h1>
            </div>
            <WishlistHeart productId={product.id} initial={wishlisted} />
          </header>
```

- [ ] **Step 4: Insertar el corazón en `ProductCard`**

En `src/components/catalog/product-card.tsx`, agregar el import:

```tsx
import { WishlistHeart } from "@/components/catalog/wishlist-heart";
```

Dentro del `<div className="relative">` (después del bloque de `stockState`), agregar:

```tsx
        <span className="absolute right-2 bottom-2 z-10">
          <WishlistHeart productId={product.id} />
        </span>
```

(El `WishlistHeart` ya hace `e.preventDefault()/stopPropagation()`, así que no dispara la navegación del `Link` contenedor.)

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/components/catalog/wishlist-heart.tsx "src/app/(storefront)/cuenta/favoritos/page.tsx" "src/app/(storefront)/producto/[slug]/page.tsx" src/components/catalog/product-card.tsx src/lib/catalog/queries.ts
git commit -m "feat(m4): WishlistHeart en ficha y card + página /cuenta/favoritos"
```

---

## Task 12: Reseñas — puras `hasPurchased` y `validateReview`

**Files:**
- Create: `src/lib/reviews/purchase.ts`
- Create: `src/lib/reviews/validation.ts`
- Test: `tests/unit/reviews/purchase.test.ts`, `tests/unit/reviews/validation.test.ts`

- [ ] **Step 1: Tests unit**

Create `tests/unit/reviews/purchase.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hasPurchased } from "@/lib/reviews/purchase";

describe("hasPurchased", () => {
  it("true si compró el producto", () => {
    expect(hasPurchased([{ productId: "p1" }, { productId: "p2" }], "p2")).toBe(true);
  });
  it("false si no lo compró", () => {
    expect(hasPurchased([{ productId: "p1" }], "p9")).toBe(false);
  });
  it("false con lista vacía", () => {
    expect(hasPurchased([], "p1")).toBe(false);
  });
});
```

Create `tests/unit/reviews/validation.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/unit/reviews/`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar las puras**

Create `src/lib/reviews/purchase.ts`:

```ts
/** Pura: ¿alguna línea comprada corresponde a este producto? */
export function hasPurchased(items: { productId: string }[], productId: string): boolean {
  return items.some((it) => it.productId === productId);
}
```

Create `src/lib/reviews/validation.ts`:

```ts
export interface ReviewInput {
  rating: number;
  title?: string | null;
  body: string;
}
export type ReviewValidation = { ok: true } | { ok: false; reason: string };

export function validateReview(input: ReviewInput): ReviewValidation {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, reason: "El puntaje debe ser de 1 a 5." };
  }
  const body = input.body.trim();
  if (!body) return { ok: false, reason: "Escribí tu reseña." };
  if (body.length > 2000) return { ok: false, reason: "La reseña es demasiado larga (máx 2000)." };
  if (input.title && input.title.trim().length > 120) {
    return { ok: false, reason: "El título es demasiado largo (máx 120)." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run, verificar PASS**

Run: `pnpm test -- tests/unit/reviews/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reviews/purchase.ts src/lib/reviews/validation.ts tests/unit/reviews/
git commit -m "test(m4): puras de reseñas (hasPurchased, validateReview)"
```

---

## Task 13: Reseñas — servicio `createReview`

**Files:**
- Create: `src/lib/reviews/service.ts`
- Test: `tests/integration/reviews/service.test.ts`

- [ ] **Step 1: Test integration**

Create `tests/integration/reviews/service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createReview, type CreateReviewDb } from "@/lib/reviews/service";

function makeDb(opts: { purchased: boolean; already?: boolean }) {
  return {
    orderItem: {
      findMany: vi.fn(async () => (opts.purchased ? [{ productId: "p1" }] : [])),
    },
    review: {
      findUnique: vi.fn(async () => (opts.already ? { id: "r0" } : null)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "r1", ...data })),
    },
  } as unknown as CreateReviewDb;
}

const base = {
  customerId: "u1", customerName: "Ana", customerEmail: "ana@x.com",
  productId: "p1", rating: 5, title: "Top", body: "Hermoso",
};

describe("createReview", () => {
  it("crea reseña verificada y aprobada si compró", async () => {
    const db = makeDb({ purchased: true });
    const res = await createReview(base, { db });
    expect(res.id).toBe("r1");
    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "approved", verifiedPurchase: true, authorName: "Ana", rating: 5 }),
    }));
  });
  it("rechaza si no compró", async () => {
    const db = makeDb({ purchased: false });
    await expect(createReview(base, { db })).rejects.toThrow(/compr/i);
  });
  it("rechaza si ya reseñó", async () => {
    const db = makeDb({ purchased: true, already: true });
    await expect(createReview(base, { db })).rejects.toThrow(/ya dejaste/i);
  });
  it("rechaza input inválido", async () => {
    const db = makeDb({ purchased: true });
    await expect(createReview({ ...base, rating: 9 }, { db })).rejects.toThrow(/puntaje/i);
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/integration/reviews/service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar el servicio**

Create `src/lib/reviews/service.ts`:

```ts
import "server-only";
import { hasPurchased } from "@/lib/reviews/purchase";
import { validateReview } from "@/lib/reviews/validation";

const PURCHASED_STATUSES = ["paid", "preparing", "shipped", "delivered"] as const;

export interface CreateReviewDb {
  orderItem: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: { variant: { select: { productId: true } } };
    }) => Promise<Array<{ variant: { productId: string } | null }> | Array<{ productId: string }>>;
  };
  review: {
    findUnique: (args: { where: { customerId_productId: { customerId: string; productId: string } } }) => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

export interface CreateReviewInput {
  customerId: string;
  customerName: string | null;
  customerEmail: string;
  productId: string;
  rating: number;
  title?: string | null;
  body: string;
}

export async function createReview(input: CreateReviewInput, deps: { db: CreateReviewDb }): Promise<{ id: string }> {
  const valid = validateReview({ rating: input.rating, title: input.title, body: input.body });
  if (!valid.ok) throw new Error(valid.reason);

  // Una reseña por clienta por producto.
  const existing = await deps.db.review.findUnique({
    where: { customerId_productId: { customerId: input.customerId, productId: input.productId } },
  });
  if (existing) throw new Error("Ya dejaste tu reseña para este producto.");

  // Verificación de compra.
  const rows = await deps.db.orderItem.findMany({
    where: {
      order: { customerId: input.customerId, status: { in: [...PURCHASED_STATUSES] } },
      variant: { productId: input.productId },
    },
    select: { variant: { select: { productId: true } } },
  });
  const items = (rows as Array<{ variant: { productId: string } | null }>).map((r) =>
    "productId" in r ? (r as unknown as { productId: string }) : { productId: r.variant?.productId ?? "" },
  );
  if (!hasPurchased(items, input.productId)) {
    throw new Error("Solo quienes compraron este producto pueden reseñarlo.");
  }

  return deps.db.review.create({
    data: {
      productId: input.productId,
      customerId: input.customerId,
      authorName: input.customerName ?? input.customerEmail,
      rating: input.rating,
      title: input.title?.trim() || null,
      body: input.body.trim(),
      verifiedPurchase: true,
      status: "approved",
    },
  });
}
```

> El test mockea `orderItem.findMany` devolviendo `[{ productId }]` directamente; el `map` tolera ambos shapes (`{ productId }` o `{ variant: { productId } }`).

- [ ] **Step 4: Run, verificar PASS**

Run: `pnpm test -- tests/integration/reviews/service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reviews/service.ts tests/integration/reviews/service.test.ts
git commit -m "feat(m4): createReview (compra verificada → aprobada, una por clienta/producto)"
```

---

## Task 14: Componentes RatingStars + ReviewCard

**Files:**
- Create: `src/components/ui/rating-stars.tsx`
- Create: `src/components/catalog/review-card.tsx`

- [ ] **Step 1: RatingStars (display + input)**

Create `src/components/ui/rating-stars.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const px = size === "sm" ? "size-3.5" : "size-5";
  return (
    <span className="inline-flex" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(px, n <= Math.round(value) ? "fill-primary text-primary" : "text-border")} aria-hidden />
      ))}
    </span>
  );
}

export function RatingInput({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <span className="inline-flex gap-1" role="radiogroup" aria-label="Puntaje">
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} estrella${n > 1 ? "s" : ""}`} onClick={() => setValue(n)}>
          <Star className={cn("size-7", n <= value ? "fill-primary text-primary" : "text-border")} aria-hidden />
        </button>
      ))}
    </span>
  );
}
```

- [ ] **Step 2: ReviewCard**

Create `src/components/catalog/review-card.tsx`:

```tsx
import { RatingStars } from "@/components/ui/rating-stars";

export interface ReviewView {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  createdAt: Date;
}

export function ReviewCard({ review }: { review: ReviewView }) {
  return (
    <article className="space-y-2 rounded-2xl border border-border p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <RatingStars value={review.rating} size="sm" />
        {review.verifiedPurchase && <span className="text-xs text-primary">Compra verificada</span>}
      </div>
      {review.title && <h3 className="text-sm font-semibold">{review.title}</h3>}
      <p className="text-sm leading-relaxed text-muted-foreground">{review.body}</p>
      <p className="text-xs text-muted-foreground">{review.authorName} · {review.createdAt.toLocaleDateString("es-AR")}</p>
    </article>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/components/ui/rating-stars.tsx src/components/catalog/review-card.tsx
git commit -m "feat(m4): componentes RatingStars y ReviewCard"
```

---

## Task 15: Sección de reseñas en la ficha + alta

**Files:**
- Create: `src/lib/reviews/queries.ts`
- Create: `src/app/(storefront)/producto/[slug]/review-form.tsx`
- Create: `src/app/(storefront)/producto/[slug]/review-actions.ts`
- Modify: `src/app/(storefront)/producto/[slug]/page.tsx`

- [ ] **Step 1: Query de reseñas aprobadas + resumen**

Create `src/lib/reviews/queries.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReviewView } from "@/components/catalog/review-card";

export interface ReviewsSummary {
  reviews: ReviewView[];
  count: number;
  average: number;
}

export async function getApprovedReviews(productId: string): Promise<ReviewsSummary> {
  const rows = await prisma.review.findMany({
    where: { productId, status: "approved" },
    orderBy: { createdAt: "desc" },
    select: { id: true, authorName: true, rating: true, title: true, body: true, verifiedPurchase: true, createdAt: true },
  });
  const count = rows.length;
  const average = count === 0 ? 0 : rows.reduce((a, r) => a + r.rating, 0) / count;
  return { reviews: rows, count, average };
}
```

- [ ] **Step 2: Action de alta**

Create `src/app/(storefront)/producto/[slug]/review-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/customer/auth";
import { createReview } from "@/lib/reviews/service";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/forms/action-result";

export async function createReviewAction(input: {
  productId: string; slug: string; rating: number; title: string; body: string;
}): Promise<ActionResult> {
  const customer = await requireCustomer();
  try {
    await createReview(
      {
        customerId: customer.id, customerName: customer.name, customerEmail: customer.email,
        productId: input.productId, rating: Number(input.rating), title: input.title, body: input.body,
      },
      { db: prisma as never },
    );
    revalidatePath(`/producto/${input.slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo publicar la reseña." };
  }
}
```

- [ ] **Step 3: Form de reseña (client)**

Create `src/app/(storefront)/producto/[slug]/review-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RatingInput } from "@/components/ui/rating-stars";
import { createReviewAction } from "./review-actions";

export function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await createReviewAction({
      productId, slug,
      rating: Number(fd.get("rating") ?? 0),
      title: String(fd.get("title") ?? ""),
      body: String(fd.get("body") ?? ""),
    });
    setPending(false);
    if (res.ok) setDone(true); else setError(res.error ?? "Error");
  }

  if (done) return <p className="text-sm text-primary">¡Gracias por tu reseña! Ya está publicada.</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border p-4">
      <p className="text-sm font-medium">Dejá tu reseña</p>
      <RatingInput name="rating" />
      <div className="space-y-1">
        <Label htmlFor="rtitle">Título (opcional)</Label>
        <Input id="rtitle" name="title" maxLength={120} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rbody">Tu experiencia</Label>
        <Textarea id="rbody" name="body" required maxLength={2000} rows={3} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>Publicar reseña</Button>
    </form>
  );
}
```

- [ ] **Step 4: Insertar la sección en la ficha**

En `src/app/(storefront)/producto/[slug]/page.tsx`, agregar imports:

```tsx
import { getApprovedReviews } from "@/lib/reviews/queries";
import { hasPurchased } from "@/lib/reviews/purchase";
import { getCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { RatingStars } from "@/components/ui/rating-stars";
import { ReviewCard } from "@/components/catalog/review-card";
import { ReviewForm } from "./review-form";
```

Antes del `return`, calcular el contexto de reseñas:

```tsx
  const { reviews, count, average } = await getApprovedReviews(product.id);
  const customer = await getCustomer();
  let canReview = false;
  let alreadyReviewed = false;
  if (customer) {
    const [purchasedRows, existing] = await Promise.all([
      prisma.orderItem.findMany({
        where: {
          order: { customerId: customer.id, status: { in: ["paid", "preparing", "shipped", "delivered"] } },
          variant: { productId: product.id },
        },
        select: { variant: { select: { productId: true } } },
      }),
      prisma.review.findUnique({ where: { customerId_productId: { customerId: customer.id, productId: product.id } } }),
    ]);
    canReview = hasPurchased(purchasedRows.map((r) => ({ productId: r.variant?.productId ?? "" })), product.id);
    alreadyReviewed = Boolean(existing);
  }
```

Antes de cerrar el `</article>` (después del bloque de Descripción), agregar la sección:

```tsx
        <section className="border-t border-border pt-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-display text-lg">Reseñas</h2>
            {count > 0 && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <RatingStars value={average} size="sm" /> {average.toFixed(1)} ({count})
              </span>
            )}
          </div>

          {!customer && (
            <p className="text-sm text-muted-foreground">
              <a href="/ingresar" className="text-primary underline">Iniciá sesión</a> para dejar tu reseña.
            </p>
          )}
          {customer && !canReview && (
            <p className="text-sm text-muted-foreground">Solo quienes compraron este producto pueden reseñarlo.</p>
          )}
          {customer && canReview && !alreadyReviewed && <ReviewForm productId={product.id} slug={product.slug} />}
          {customer && alreadyReviewed && <p className="text-sm text-muted-foreground">Ya dejaste tu reseña. ¡Gracias!</p>}

          <div className="mt-4 space-y-3">
            {reviews.length === 0
              ? <p className="text-sm text-muted-foreground">Todavía no hay reseñas. ¡Sé la primera!</p>
              : reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
        </section>
```

> Mover el bloque para que la sección de reseñas quede **dentro** del segundo `<div className="space-y-5">` o como hermano dentro de `<article>` (ambas opciones renderizan bien; preferir hermano de la grilla, ancho completo).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/lib/reviews/queries.ts "src/app/(storefront)/producto/[slug]"
git commit -m "feat(m4): sección de reseñas en la ficha + alta con compra verificada"
```

---

## Task 16: Cupones — `validateCoupon` por clienta (pura)

**Files:**
- Modify: `src/lib/coupons/apply.ts:6-31`
- Test: `tests/unit/coupons/per-customer.test.ts`

- [ ] **Step 1: Test unit de la regla nueva**

Create `tests/unit/coupons/per-customer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateCoupon } from "@/lib/coupons/apply";

const base = { active: true, minSubtotal: null, validFrom: null, validTo: null, maxUses: null, usedCount: 0 };

describe("validateCoupon — perCustomerLimit", () => {
  it("rechaza si la clienta alcanzó su límite", () => {
    const res = validateCoupon({ ...base, perCustomerLimit: 1 }, { subtotal: 5000, now: new Date(), customerRedemptions: 1 });
    expect(res).toEqual({ ok: false, reason: "Ya usaste este cupón el máximo de veces." });
  });
  it("acepta por debajo del límite", () => {
    const res = validateCoupon({ ...base, perCustomerLimit: 2 }, { subtotal: 5000, now: new Date(), customerRedemptions: 1 });
    expect(res.ok).toBe(true);
  });
  it("sin perCustomerLimit ni redenciones → válido (invitada)", () => {
    const res = validateCoupon({ ...base }, { subtotal: 5000, now: new Date() });
    expect(res.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/unit/coupons/per-customer.test.ts`
Expected: FAIL (la regla todavía no existe; `customerRedemptions`/`perCustomerLimit` no se chequean).

- [ ] **Step 3: Extender la pura (campos opcionales → no rompe callers existentes)**

En `src/lib/coupons/apply.ts`, modificar las interfaces y agregar la regla:

```ts
export interface ValidatableCoupon {
  active: boolean;
  minSubtotal: number | string | null;
  validFrom: Date | null;
  validTo: Date | null;
  maxUses: number | null;
  usedCount: number;
  perCustomerLimit?: number | null;
}
export interface CouponContext {
  subtotal: number;
  now: Date;
  customerRedemptions?: number;
}
```

Dentro de `validateCoupon`, agregar **antes** del `return { ok: true }` final:

```ts
  if (coupon.perCustomerLimit != null && (ctx.customerRedemptions ?? 0) >= coupon.perCustomerLimit) {
    return { ok: false, reason: "Ya usaste este cupón el máximo de veces." };
  }
```

- [ ] **Step 4: Run la suite de cupones completa, verificar PASS**

Run: `pnpm test -- tests/unit/coupons/`
Expected: PASS (los tests existentes siguen verdes; los campos nuevos son opcionales).

- [ ] **Step 5: Commit**

```bash
git add src/lib/coupons/apply.ts tests/unit/coupons/per-customer.test.ts
git commit -m "feat(m4): validateCoupon hace cumplir perCustomerLimit (opcional, no rompe invitadas)"
```

---

## Task 17: Cupones — enforcement en checkout

**Files:**
- Modify: `src/lib/orders/checkout-service.ts:42-113`
- Test: `tests/integration/orders/checkout-per-customer.test.ts`

- [ ] **Step 1: Test integration (rechazo al límite)**

Create `tests/integration/orders/checkout-per-customer.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createCheckout, type CreateCheckoutDeps, type CheckoutDb } from "@/lib/orders/checkout-service";
import type { CartLine } from "@/lib/cart/types";

const line: CartLine = { id: "i1", kind: "variant", refId: "v1", unitPrice: 5000, qty: 1, weightGr: 50, productId: "p1", categoryId: "c1" };

function makeDeps(redemptions: number): { deps: CreateCheckoutDeps; createOrder: ReturnType<typeof vi.fn> } {
  const createOrder = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "ord1", orderNumber: "GLM-000001", ...data, payments: [{ id: "pay1" }] }));
  const db = {
    coupon: { findUnique: vi.fn(async () => ({
      id: "cpn1", code: "RECOMPRA", type: "percentage", value: 10, scope: "all", scopeId: null,
      active: true, minSubtotal: null, validFrom: null, validTo: null, maxUses: null, usedCount: 0, perCustomerLimit: 1,
    })) },
    couponRedemption: { findUnique: vi.fn(async () => (redemptions > 0 ? { redeemedCount: redemptions } : null)) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      order: { create: createOrder },
      cart: { update: vi.fn(async () => ({})) },
      payment: { update: vi.fn(async () => ({})) },
    })),
  } as unknown as CheckoutDb;

  const deps: CreateCheckoutDeps = {
    db,
    nextOrderSeq: vi.fn(async () => 1),
    createPreference: vi.fn(async () => ({ id: "pref1", init_point: "http://mp", sandbox_init_point: "http://mp" })) as never,
    quoteShipping: vi.fn(async () => ({ cost: 2500, free: false, source: "zone", zoneId: "z1" })),
    appUrl: "http://localhost:3000",
    now: new Date("2026-06-06T12:00:00Z"),
  };
  return { deps, createOrder };
}

describe("createCheckout — perCustomerLimit", () => {
  it("NO aplica el cupón si la clienta superó su límite (descuento 0)", async () => {
    const { deps, createOrder } = makeDeps(1);
    await createCheckout({
      contactName: "Ana", contactEmail: "ana@x.com", contactPhone: "11", shippingMethod: "domicilio",
      address: { cp: "1414" }, lines: [{ line, productNameSnapshot: "P", variantNameSnapshot: "V", skuSnapshot: "S", title: "P—V" }],
      couponCode: "RECOMPRA", customerId: "u1", cartId: "cart1",
    }, deps);
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ discountTotal: 0, couponId: null }),
    }));
  });

  it("aplica el cupón si está por debajo del límite", async () => {
    const { deps, createOrder } = makeDeps(0);
    await createCheckout({
      contactName: "Ana", contactEmail: "ana@x.com", contactPhone: "11", shippingMethod: "domicilio",
      address: { cp: "1414" }, lines: [{ line, productNameSnapshot: "P", variantNameSnapshot: "V", skuSnapshot: "S", title: "P—V" }],
      couponCode: "RECOMPRA", customerId: "u1", cartId: "cart1",
    }, deps);
    const call = createOrder.mock.calls[0][0] as { data: { couponId: string | null; discountTotal: number } };
    expect(call.data.couponId).toBe("cpn1");
    expect(call.data.discountTotal).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/integration/orders/checkout-per-customer.test.ts`
Expected: FAIL (hoy `CheckoutDb` no tiene `couponRedemption`, ni `CouponRow.perCustomerLimit`, ni se chequea el límite).

- [ ] **Step 3: Extender `CheckoutDb`, `CouponRow` y la lógica de validación**

En `src/lib/orders/checkout-service.ts`:

Agregar `perCustomerLimit` a `CouponRow` (después de `usedCount: number;`):

```ts
  perCustomerLimit: number | null;
```

Agregar `couponRedemption` a `CheckoutDb`:

```ts
export interface CheckoutDb {
  coupon: { findUnique: (args: { where: { code: string } }) => Promise<CouponRow | null> };
  couponRedemption: {
    findUnique: (args: { where: { customerId_couponId: { customerId: string; couponId: string } } }) => Promise<{ redeemedCount: number } | null>;
  };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}
```

Dentro de `createCheckout`, reemplazar el bloque de cupón (`if (input.couponCode) { … }`) por:

```ts
  if (input.couponCode) {
    const coupon = await deps.db.coupon.findUnique({ where: { code: input.couponCode } });
    if (coupon) {
      let customerRedemptions = 0;
      if (input.customerId && coupon.perCustomerLimit != null) {
        const r = await deps.db.couponRedemption.findUnique({
          where: { customerId_couponId: { customerId: input.customerId, couponId: coupon.id } },
        });
        customerRedemptions = r?.redeemedCount ?? 0;
      }
      const v = validateCoupon(coupon, { subtotal, now, customerRedemptions });
      if (v.ok) {
        const res = applyCoupon(coupon, cartLines);
        discount = res.discount;
        freeShippingByCoupon = res.freeShipping;
        couponId = coupon.id;
      }
    }
  }
```

- [ ] **Step 4: Run, verificar PASS (y la suite de checkout existente)**

Run: `pnpm test -- tests/integration/orders/checkout-per-customer.test.ts tests/integration/checkout-service.test.ts`
Expected: PASS. (Si el test existente de checkout construye `CheckoutDb` sin `couponRedemption`, agregarle `couponRedemption: { findUnique: vi.fn(async () => null) }` a su mock — incluir ese ajuste en este commit.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/checkout-service.ts tests/integration/orders/checkout-per-customer.test.ts tests/integration/checkout-service.test.ts
git commit -m "feat(m4): checkout hace cumplir perCustomerLimit (consulta CouponRedemption)"
```

---

## Task 18: Cupones — registrar redención en el webhook

**Files:**
- Modify: `src/lib/orders/webhook-service.ts:38-51,163-166`
- Test: `tests/integration/orders/webhook-redemption.test.ts`

- [ ] **Step 1: Test integration del incremento por clienta**

Create `tests/integration/orders/webhook-redemption.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { processWebhook, type ProcessWebhookDeps, type WebhookOrder } from "@/lib/orders/webhook-service";

function makeOrder(over: Partial<WebhookOrder> = {}): WebhookOrder {
  return {
    id: "ord1", orderNumber: "GLM-000001", status: "pending_payment", couponId: "cpn1", customerId: "u1",
    contactName: "Ana", contactEmail: "ana@x.com", shippingMethod: "domicilio",
    subtotal: 5000, shippingCost: 2500, discountTotal: 500, total: 7000, items: [], ...over,
  };
}

function makeDeps(order: WebhookOrder) {
  const couponUpsert = vi.fn(async () => ({}));
  const tx = {
    payment: { findFirst: vi.fn(async () => null), update: vi.fn(), create: vi.fn(async () => ({})) },
    order: { updateMany: vi.fn(async () => ({ count: 1 })), update: vi.fn() },
    productVariant: { findMany: vi.fn(async () => []), update: vi.fn() },
    shipment: { create: vi.fn(async () => ({})) },
    coupon: { update: vi.fn(async () => ({})) },
    couponRedemption: { upsert: couponUpsert },
  };
  const deps: ProcessWebhookDeps = {
    db: {
      order: { findFirst: vi.fn(async () => order) },
      $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    } as never,
    getPayment: vi.fn(async () => ({ id: 123, status: "approved", external_reference: "ord1", transaction_amount: 7000 })) as never,
    sendEmail: vi.fn(async () => ({ id: null, logged: true })),
    verifySignature: vi.fn(async () => true),
    secret: "s",
    now: new Date("2026-06-06T12:00:00Z"),
  };
  return { deps, couponUpsert };
}

describe("processWebhook — CouponRedemption", () => {
  it("upsertea la redención por clienta al aprobarse el pago", async () => {
    const { deps, couponUpsert } = makeDeps(makeOrder());
    await processWebhook({ dataId: "123", xSignature: null, xRequestId: null }, deps);
    expect(couponUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId_couponId: { customerId: "u1", couponId: "cpn1" } },
    }));
  });
  it("NO upsertea si el pedido fue de invitada (customerId null)", async () => {
    const { deps, couponUpsert } = makeDeps(makeOrder({ customerId: null }));
    await processWebhook({ dataId: "123", xSignature: null, xRequestId: null }, deps);
    expect(couponUpsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/integration/orders/webhook-redemption.test.ts`
Expected: FAIL (no existe `WebhookOrder.customerId` ni el upsert).

- [ ] **Step 3: Agregar `customerId` a `WebhookOrder` y el upsert en la tx**

En `src/lib/orders/webhook-service.ts`, en `interface WebhookOrder`, agregar después de `id: string;`:

```ts
  customerId: string | null;
```

En el bloque `if (wonPaidTransition) { … }`, reemplazar el incremento de cupón:

```ts
      if (order.couponId) {
        await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
        if (order.customerId) {
          await tx.couponRedemption.upsert({
            where: { customerId_couponId: { customerId: order.customerId, couponId: order.couponId } },
            create: { customerId: order.customerId, couponId: order.couponId, redeemedCount: 1, lastRedeemedAt: deps.now ?? new Date() },
            update: { redeemedCount: { increment: 1 }, lastRedeemedAt: deps.now ?? new Date() },
          });
        }
      }
```

- [ ] **Step 4: Run, verificar PASS + suite del webhook existente**

Run: `pnpm test -- tests/integration/orders/webhook-redemption.test.ts tests/integration/webhook-service.test.ts`
Expected: PASS. (Si los fixtures del webhook existente no tienen `customerId`, agregarles `customerId: null`; incluir ese ajuste en este commit.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/webhook-service.ts tests/integration/orders/webhook-redemption.test.ts tests/integration/webhook-service.test.ts
git commit -m "feat(m4): el webhook registra la redención de cupón por clienta (CouponRedemption)"
```

---

## Task 19: Cupones — contexto de clienta en `applyCouponAction` (advisory)

**Files:**
- Modify: `src/app/(storefront)/actions.ts:62-83`

- [ ] **Step 1: Pasar `customerRedemptions` cuando hay clienta logueada**

En `src/app/(storefront)/actions.ts`, agregar import:

```ts
import { getCustomer } from "@/lib/customer/auth";
```

En `applyCouponAction`, reemplazar la construcción de `validatable` y la llamada a `validateCoupon`:

```ts
  const customer = await getCustomer();
  let customerRedemptions = 0;
  if (customer && coupon.perCustomerLimit != null) {
    const r = await prisma.couponRedemption.findUnique({
      where: { customerId_couponId: { customerId: customer.id, couponId: coupon.id } },
    });
    customerRedemptions = r?.redeemedCount ?? 0;
  }
  const validatable = { ...coupon, minSubtotal: coupon.minSubtotal != null ? toNumber(coupon.minSubtotal) : null };
  const v = validateCoupon(validatable, { subtotal, now: new Date(), customerRedemptions });
```

- [ ] **Step 2: Typecheck + test (cupones no rompen) + commit**

Run: `pnpm typecheck && pnpm test -- tests/unit/coupons/ tests/integration/`
Expected: PASS.

```bash
git add "src/app/(storefront)/actions.ts"
git commit -m "feat(m4): applyCouponAction considera el límite por clienta cuando hay sesión"
```

---

## Task 20: Email de carrito abandonado (template)

**Files:**
- Modify: `src/lib/email/templates.ts`
- Test: `tests/unit/email/abandoned-template.test.ts`

- [ ] **Step 1: Test unit del template**

Create `tests/unit/email/abandoned-template.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { abandonedCartEmail } from "@/lib/email/templates";

describe("abandonedCartEmail", () => {
  it("incluye el nombre, los items y el link de recupero", () => {
    const r = abandonedCartEmail({
      name: "Ana",
      items: [{ name: "Labial", variantName: "Rojo", qty: 2, lineTotal: 9000 }],
      recoverUrl: "http://localhost:3000/carrito",
    });
    expect(r.subject).toMatch(/carrito/i);
    expect(r.html).toContain("Ana");
    expect(r.html).toContain("Labial");
    expect(r.html).toContain("http://localhost:3000/carrito");
    expect(r.text).toContain("Labial");
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/unit/email/abandoned-template.test.ts`
Expected: FAIL.

- [ ] **Step 3: Agregar el template a `templates.ts`**

En `src/lib/email/templates.ts`, agregar al final (reusa `formatARS`, `itemLabel` ya existen en el archivo):

```ts
export interface AbandonedCartEmailData {
  name?: string | null;
  items: OrderEmailItem[];
  recoverUrl: string;
}

/** Email de recupero de carrito abandonado (un único recordatorio a 24h). */
export function abandonedCartEmail(d: AbandonedCartEmailData): EmailContent {
  const hi = d.name ? `${d.name}, ` : "";
  const subject = "Te quedó algo en el carrito 💄 — Glamify Makeup";
  const rows = d.items
    .map((it) => `<tr><td>${itemLabel(it)} × ${it.qty}</td><td style="text-align:right">${formatARS(it.lineTotal)}</td></tr>`)
    .join("");
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1 style="color:#FF2E93">${hi}¿lo dejamos para después? 💕</h1>
    <p>Guardamos tu carrito. Estos productos te están esperando:</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="margin-top:16px">
      <a href="${d.recoverUrl}" style="background:#FF2E93;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;display:inline-block">Volver a mi carrito</a>
    </p>
    <p style="font-size:12px;color:#999">Si ya compraste o no te interesa, ignorá este mensaje.</p>
  </div>`;
  const text = `${hi}te quedó algo en el carrito:\n\n${d.items.map((it) => `- ${itemLabel(it)} × ${it.qty}: ${formatARS(it.lineTotal)}`).join("\n")}\n\nVolvé a tu carrito: ${d.recoverUrl}`;
  return { subject, html, text };
}
```

- [ ] **Step 4: Run, verificar PASS**

Run: `pnpm test -- tests/unit/email/abandoned-template.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates.ts tests/unit/email/abandoned-template.test.ts
git commit -m "feat(m4): template de email de carrito abandonado"
```

---

## Task 21: Detección de carritos abandonados (pura)

**Files:**
- Create: `src/lib/cart/abandoned.ts`
- Test: `tests/unit/cart/abandoned.test.ts`

- [ ] **Step 1: Test unit de `findAbandonedCarts`**

Create `tests/unit/cart/abandoned.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findAbandonedCarts, type AbandonedCartRow } from "@/lib/cart/abandoned";

const now = new Date("2026-06-06T12:00:00Z");
const old = new Date("2026-06-05T11:00:00Z"); // 25h antes
const recent = new Date("2026-06-06T11:00:00Z"); // 1h antes

function row(over: Partial<AbandonedCartRow>): AbandonedCartRow {
  return { cartId: "c", email: "a@b.com", consent: true, updatedAt: old, itemCount: 1, abandonedEmailSentAt: null, ...over };
}

describe("findAbandonedCarts", () => {
  it("elige carritos con email+consent, items, idle≥24h y sin email enviado", () => {
    expect(findAbandonedCarts([row({ cartId: "c1" })], now)).toEqual(["c1"]);
  });
  it("excluye sin consentimiento", () => {
    expect(findAbandonedCarts([row({ cartId: "c2", consent: false })], now)).toEqual([]);
  });
  it("excluye sin email", () => {
    expect(findAbandonedCarts([row({ cartId: "c3", email: null })], now)).toEqual([]);
  });
  it("excluye carritos recientes (<24h)", () => {
    expect(findAbandonedCarts([row({ cartId: "c4", updatedAt: recent })], now)).toEqual([]);
  });
  it("excluye carritos vacíos", () => {
    expect(findAbandonedCarts([row({ cartId: "c5", itemCount: 0 })], now)).toEqual([]);
  });
  it("excluye si ya se envió el email", () => {
    expect(findAbandonedCarts([row({ cartId: "c6", abandonedEmailSentAt: recent })], now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/unit/cart/abandoned.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar la pura**

Create `src/lib/cart/abandoned.ts`:

```ts
export interface AbandonedCartRow {
  cartId: string;
  email: string | null;
  consent: boolean;
  updatedAt: Date;
  itemCount: number;
  abandonedEmailSentAt: Date | null;
}

/** Pura: ids de carritos elegibles para el email de recupero. */
export function findAbandonedCarts(rows: AbandonedCartRow[], now: Date, idleHours = 24): string[] {
  const cutoff = now.getTime() - idleHours * 3600_000;
  return rows
    .filter(
      (r) =>
        r.email != null &&
        r.consent &&
        r.itemCount > 0 &&
        r.abandonedEmailSentAt == null &&
        r.updatedAt.getTime() <= cutoff,
    )
    .map((r) => r.cartId);
}
```

- [ ] **Step 4: Run, verificar PASS**

Run: `pnpm test -- tests/unit/cart/abandoned.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cart/abandoned.ts tests/unit/cart/abandoned.test.ts
git commit -m "test(m4): findAbandonedCarts (idle 24h + consentimiento + idempotencia)"
```

---

## Task 22: Job de carrito abandonado (servicio)

**Files:**
- Create: `src/lib/cart/abandoned-job.ts`
- Test: `tests/integration/cart/abandoned-job.test.ts`

- [ ] **Step 1: Test integration del job**

Create `tests/integration/cart/abandoned-job.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runAbandonedCartJob, type AbandonedJobDb } from "@/lib/cart/abandoned-job";

const old = new Date("2026-06-05T11:00:00Z");

function makeDb() {
  const update = vi.fn(async () => ({}));
  const db = {
    cart: {
      findMany: vi.fn(async () => [
        {
          id: "c1", updatedAt: old, abandonedEmailSentAt: null, contactEmail: "guest@x.com", recoveryEmailConsent: true,
          customer: null,
          items: [{ qty: 2, unitPriceSnapshot: 4500, variant: { product: { name: "Labial" }, name: "Rojo" }, combo: null }],
        },
      ]),
      update,
    },
  } as unknown as AbandonedJobDb;
  return { db, update };
}

describe("runAbandonedCartJob", () => {
  it("envía el email y estampa abandonedEmailSentAt", async () => {
    const { db, update } = makeDb();
    const sendEmail = vi.fn(async () => ({ id: "e1", logged: false }));
    const res = await runAbandonedCartJob({ db, sendEmail, now: new Date("2026-06-06T12:00:00Z"), appUrl: "http://localhost:3000" });
    expect(res.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "guest@x.com" }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" } }));
  });

  it("no envía si no hay consentimiento", async () => {
    const { db } = makeDb();
    (db.cart.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "c2", updatedAt: old, abandonedEmailSentAt: null, contactEmail: "x@x.com", recoveryEmailConsent: false, customer: null, items: [{ qty: 1, unitPriceSnapshot: 1000, variant: { product: { name: "X" }, name: "U" }, combo: null }] },
    ]);
    const sendEmail = vi.fn(async () => ({ id: null, logged: true }));
    const res = await runAbandonedCartJob({ db, sendEmail, now: new Date("2026-06-06T12:00:00Z"), appUrl: "http://localhost:3000" });
    expect(res.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/integration/cart/abandoned-job.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar el job (sin `server-only`, apto para el worker)**

Create `src/lib/cart/abandoned-job.ts`:

```ts
import { findAbandonedCarts, type AbandonedCartRow } from "@/lib/cart/abandoned";
import { abandonedCartEmail } from "@/lib/email/templates";
import type { SendEmailInput, SendEmailResult } from "@/lib/email/resend";

interface JobCartItem {
  qty: number;
  unitPriceSnapshot: number | string;
  variant: { product: { name: string }; name: string } | null;
  combo: { name: string } | null;
}
interface JobCart {
  id: string;
  updatedAt: Date;
  abandonedEmailSentAt: Date | null;
  contactEmail: string | null;
  recoveryEmailConsent: boolean;
  customer: { email: string; name: string | null; marketingConsent: boolean } | null;
  items: JobCartItem[];
}

export interface AbandonedJobDb {
  cart: {
    findMany: (args: Record<string, unknown>) => Promise<JobCart[]>;
    update: (args: { where: { id: string }; data: { abandonedEmailSentAt: Date } }) => Promise<unknown>;
  };
}

export interface AbandonedJobDeps {
  db: AbandonedJobDb;
  sendEmail: (input: SendEmailInput) => Promise<SendEmailResult>;
  now: Date;
  appUrl: string;
  idleHours?: number;
  batch?: number;
}

function normalize(c: JobCart): { row: AbandonedCartRow; email: string | null; name: string | null } {
  const email = c.customer ? c.customer.email : c.contactEmail;
  const consent = c.customer ? c.customer.marketingConsent : c.recoveryEmailConsent;
  const name = c.customer ? c.customer.name : null;
  return {
    row: { cartId: c.id, email, consent, updatedAt: c.updatedAt, itemCount: c.items.length, abandonedEmailSentAt: c.abandonedEmailSentAt },
    email,
    name,
  };
}

export async function runAbandonedCartJob(deps: AbandonedJobDeps): Promise<{ sent: number }> {
  const idleHours = deps.idleHours ?? 24;
  const cutoff = new Date(deps.now.getTime() - idleHours * 3600_000);
  const carts = await deps.db.cart.findMany({
    where: { status: "active", abandonedEmailSentAt: null, updatedAt: { lte: cutoff } },
    include: { customer: true, items: { include: { variant: { include: { product: true } }, combo: true } } },
    take: deps.batch ?? 50,
  });

  const normalized = carts.map(normalize);
  const eligibleIds = new Set(findAbandonedCarts(normalized.map((n) => n.row), deps.now, idleHours));

  let sent = 0;
  for (const n of normalized) {
    if (!eligibleIds.has(n.row.cartId) || !n.email) continue;
    const cart = carts.find((c) => c.id === n.row.cartId)!;
    const items = cart.items.map((it) => ({
      name: it.combo ? it.combo.name : it.variant!.product.name,
      variantName: it.combo ? null : it.variant!.name,
      qty: it.qty,
      lineTotal: Number(it.unitPriceSnapshot) * it.qty,
    }));
    const email = abandonedCartEmail({ name: n.name, items, recoverUrl: `${deps.appUrl}/carrito` });
    await deps.sendEmail({ to: n.email, subject: email.subject, html: email.html, text: email.text });
    await deps.db.cart.update({ where: { id: n.row.cartId }, data: { abandonedEmailSentAt: deps.now } });
    sent += 1;
  }
  return { sent };
}
```

- [ ] **Step 4: Run, verificar PASS**

Run: `pnpm test -- tests/integration/cart/abandoned-job.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cart/abandoned-job.ts tests/integration/cart/abandoned-job.test.ts
git commit -m "feat(m4): job de carrito abandonado (envía + estampa, idempotente)"
```

---

## Task 23: Job de autocancelación de pedidos

**Files:**
- Create: `src/lib/orders/expiry-job.ts`
- Test: `tests/integration/orders/expiry-job.test.ts`

- [ ] **Step 1: Test integration**

Create `tests/integration/orders/expiry-job.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runOrderExpiryJob, type ExpiryJobDb } from "@/lib/orders/expiry-job";

const old = new Date("2026-06-05T10:00:00Z"); // >24h
const recent = new Date("2026-06-06T11:30:00Z");

describe("runOrderExpiryJob", () => {
  it("cancela pending_payment con más de 24h", async () => {
    const update = vi.fn(async () => ({}));
    const db = {
      order: {
        findMany: vi.fn(async () => [
          { id: "o1", status: "pending_payment", createdAt: old },
          { id: "o2", status: "pending_payment", createdAt: recent },
        ]),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ order: { update } })),
    } as unknown as ExpiryJobDb;

    const res = await runOrderExpiryJob({ db, now: new Date("2026-06-06T12:00:00Z") });
    expect(res.cancelled).toBe(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "o1" }, data: { status: "cancelled" } });
  });
});
```

- [ ] **Step 2: Run, verificar FAIL**

Run: `pnpm test -- tests/integration/orders/expiry-job.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar el job (reusa la pura `findExpiredOrderIds`)**

Create `src/lib/orders/expiry-job.ts`:

```ts
import { findExpiredOrderIds, type ExpirableOrder } from "@/lib/orders/expiry";
import type { PrismaTransactionClient } from "@/lib/prisma";

export interface ExpiryJobDb {
  order: { findMany: (args: Record<string, unknown>) => Promise<ExpirableOrder[]> };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}

export interface ExpiryJobDeps {
  db: ExpiryJobDb;
  now: Date;
  hours?: number;
}

/**
 * Autocancela pedidos pending_payment vencidos (>24h). NO repone stock:
 * los pending_payment nunca lo descontaron (el descuento ocurre al aprobarse el pago).
 */
export async function runOrderExpiryJob(deps: ExpiryJobDeps): Promise<{ cancelled: number }> {
  const orders = await deps.db.order.findMany({
    where: { status: "pending_payment" },
    select: { id: true, status: true, createdAt: true },
  });
  const expired = findExpiredOrderIds(orders, deps.now, deps.hours ?? 24);
  for (const id of expired) {
    await deps.db.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: "cancelled" } });
    });
  }
  return { cancelled: expired.length };
}
```

- [ ] **Step 4: Run, verificar PASS**

Run: `pnpm test -- tests/integration/orders/expiry-job.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/expiry-job.ts tests/integration/orders/expiry-job.test.ts
git commit -m "feat(m4): job de autocancelación de pedidos pending_payment vencidos"
```

---

## Task 24: Cron deps + worker entry + Cron Triggers

**Files:**
- Create: `src/lib/cron/deps.ts`
- Create: `worker.ts`
- Modify: `wrangler.jsonc`
- Modify: `tsconfig.json`

- [ ] **Step 1: `buildCronDeps(env)` — Prisma + sendEmail desde `env`**

Create `src/lib/cron/deps.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sendEmail as realSendEmail, type SendEmailInput } from "@/lib/email/resend";
import type { AbandonedJobDeps } from "@/lib/cart/abandoned-job";
import type { ExpiryJobDeps } from "@/lib/orders/expiry-job";

export interface CronEnv {
  DATABASE_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

/** Construye deps reales para los jobs del cron desde el `env` del Worker. */
export function buildCronDeps(env: CronEnv): { abandoned: AbandonedJobDeps; expiry: ExpiryJobDeps } {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL ?? process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });
  const now = new Date();
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://glamifymakeup.site";
  const sendEmail = (input: SendEmailInput) =>
    realSendEmail(input, { apiKey: env.RESEND_API_KEY, defaultFrom: env.RESEND_FROM });
  return {
    abandoned: { db: db as never, sendEmail, now, appUrl },
    expiry: { db: db as never, now },
  };
}
```

- [ ] **Step 2: Worker entry custom (`scheduled` + re-export del `fetch` de OpenNext)**

Create `worker.ts` (raíz del repo):

```ts
// Worker entry custom: re-exporta el handler de @opennextjs/cloudflare y agrega `scheduled`
// para los Cron Triggers (carrito abandonado + autocancelación). Ver spec M4 §9.
// El artefacto .open-next/worker.js se genera con `pnpm build:worker` (no existe en dev de Next).
// @ts-ignore - generado en build
import openNextHandler from "./.open-next/worker.js";
import { buildCronDeps, type CronEnv } from "./src/lib/cron/deps";
import { runAbandonedCartJob } from "./src/lib/cart/abandoned-job";
import { runOrderExpiryJob } from "./src/lib/orders/expiry-job";

export default {
  fetch: (openNextHandler as { fetch: ExportedHandlerFetchHandler }).fetch,
  async scheduled(_controller: ScheduledController, env: CronEnv, ctx: ExecutionContext) {
    const deps = buildCronDeps(env);
    ctx.waitUntil(
      Promise.allSettled([
        runAbandonedCartJob(deps.abandoned),
        runOrderExpiryJob(deps.expiry),
      ]).then((results) => {
        for (const r of results) if (r.status === "rejected") console.error("[cron]", r.reason);
      }),
    );
  },
} satisfies ExportedHandler<CronEnv>;
```

- [ ] **Step 3: Apuntar wrangler al entry custom + agregar el cron**

En `wrangler.jsonc`, cambiar `"main"` y agregar `"triggers"`:

```jsonc
  "main": "worker.ts",
  "triggers": { "crons": ["0 * * * *"] },
```

(Mantener el resto: `name`, `compatibility_date`, `compatibility_flags`, `assets`, `vars`, `observability`.)

- [ ] **Step 4: Excluir `worker.ts` del typecheck de la app**

En `tsconfig.json`, agregar `"worker.ts"` al array `"exclude"` (el entry se type-chequea laxo; importa un artefacto de build). Si no hay `exclude`, agregarlo:

```jsonc
  "exclude": ["node_modules", "worker.ts"]
```

- [ ] **Step 5: Verificar typecheck, tests y build del worker**

Run: `pnpm typecheck && pnpm test`
Expected: PASS (los jobs ya están cubiertos; `worker.ts` excluido del typecheck).

Run: `pnpm build:worker`
Expected: genera `.open-next/worker.js` y wrangler bundlea `worker.ts` sin error.

- [ ] **Step 6: Probar el cron localmente (opcional pero recomendado)**

Run: `pnpm dev:worker` (en otra terminal) y luego:
`curl "http://localhost:8771/__scheduled?cron=0+*+*+*+*"`
Expected: la respuesta es 200 y los logs muestran la corrida de los jobs (sin envíos reales si no hay `RESEND_API_KEY` → transporte de dev loguea).

> **Fallback (si `pnpm build:worker` falla por el import de `./.open-next/worker.js`):** Approach B del spec — crear Route Handlers internos `src/app/api/cron/abandoned-cart/route.ts` y `src/app/api/cron/expiry/route.ts` (cada uno valida `request.headers.get("x-cron-secret") === env CRON_SECRET`, construye deps con `buildCronDeps`, corre su job y devuelve `{ sent }`/`{ cancelled }`), y en `worker.ts` el `scheduled` invoca `openNextHandler.fetch(new Request("https://internal/api/cron/abandoned-cart", { headers: { "x-cron-secret": env.CRON_SECRET } }), env, ctx)` para cada job. Agregar `CRON_SECRET` a `.env.example` y a los secrets de Cloudflare.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cron/deps.ts worker.ts wrangler.jsonc tsconfig.json
git commit -m "feat(m4): worker custom con scheduled() + Cron Trigger horario (carrito abandonado + autocancelación)"
```

---

## Task 25: Script `create-customer` + seed e2e + Playwright env

**Files:**
- Create: `scripts/create-customer.ts`
- Modify: `prisma/seed.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Script de alta de clienta de prueba (mirror de create-admin)**

Create `scripts/create-customer.ts`:

```ts
/**
 * Crea (idempotente) una clienta de prueba para e2e:
 *  1) usuario en Supabase Auth (email_confirm: true)
 *  2) fila `Customer` (prisma), id = uid de Auth.
 * Requiere: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL,
 *           CUSTOMER_EMAIL, CUSTOMER_PASSWORD
 */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type AdminSupabaseClient = SupabaseClient<never, "public", "public">;

async function findAuthUserByEmail(supabase: AdminSupabaseClient, email: string): Promise<User | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  const email = process.env.CUSTOMER_EMAIL?.trim().toLowerCase();
  const password = process.env.CUSTOMER_PASSWORD;
  if (!url || !key || !dbUrl) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o DATABASE_URL."); process.exit(1); }
  if (!email || !password) { console.error("Faltan CUSTOMER_EMAIL o CUSTOMER_PASSWORD."); process.exit(1); }

  const supabase: AdminSupabaseClient = createClient<never, "public", "public">(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });
  try {
    let authUser = await findAuthUserByEmail(supabase, email);
    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      authUser = data.user;
    }
    await prisma.customer.upsert({
      where: { id: authUser.id },
      update: { email, name: "Clienta E2E" },
      create: { id: authUser.id, email, name: "Clienta E2E" },
    });
    console.log(`Clienta e2e lista para ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Vincular el pedido e2e a la clienta + script en package.json**

En `prisma/seed.ts`, dentro de `upsertE2eOrder()`, antes de crear/actualizar el pedido, resolver la clienta e2e por email y setear `customerId`. Agregar al inicio de la función:

```ts
  const e2eEmail = process.env.CUSTOMER_EMAIL?.trim().toLowerCase() ?? "clienta.e2e@example.com";
  const e2eCustomer = await prisma.customer.findUnique({ where: { email: e2eEmail } });
```

Y en los `data` de `prisma.order.update` y `prisma.order.create`, agregar:

```ts
          customerId: e2eCustomer?.id ?? null,
```

(El pedido `GLM-E2E001` usa la variante de `labial-mate-larga-duracion` → producto reseñable por la clienta e2e.)

En `package.json`, agregar el script:

```json
    "customer:create": "tsx --env-file=.env scripts/create-customer.ts",
```

- [ ] **Step 3: Pasar credenciales de clienta al webServer de Playwright**

En `playwright.config.ts`, en `webServer.env`, agregar:

```ts
      CUSTOMER_EMAIL: process.env.CUSTOMER_EMAIL ?? "",
      CUSTOMER_PASSWORD: process.env.CUSTOMER_PASSWORD ?? "",
```

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add scripts/create-customer.ts prisma/seed.ts playwright.config.ts package.json
git commit -m "chore(m4): script create-customer + pedido e2e vinculado a la clienta + env de Playwright"
```

---

## Task 26: E2E del DoD (`cuenta.spec.ts`)

**Files:**
- Create: `tests/e2e/cuenta.spec.ts`

**Prerequisito de corrida (documentar en el spec/SETUP):** exportar `CUSTOMER_EMAIL`/`CUSTOMER_PASSWORD` (+ `ADMIN_*`), correr `pnpm customer:create` y `pnpm db:seed` antes de `pnpm test:e2e`.

- [ ] **Step 1: Escribir el spec e2e**

Create `tests/e2e/cuenta.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL ?? "";
const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD ?? "";
const PRODUCT_SLUG = "labial-mate-larga-duracion"; // el pedido e2e (GLM-E2E001) compra este producto

test.describe("Cuenta de clienta (DoD M4)", () => {
  test("registro → pantalla de confirmación", async ({ page }) => {
    await page.goto("/ingresar");
    await page.getByRole("button", { name: /crear cuenta/i }).click();
    const unique = `nueva_${Date.now()}@example.com`;
    await page.getByLabel(/nombre/i).fill("Nueva Clienta");
    await page.getByLabel(/email/i).fill(unique);
    await page.getByLabel(/contraseña/i).fill("Password123!");
    await page.getByRole("button", { name: /crear cuenta/i }).click();
    await expect(page.getByText(/revisá tu correo/i)).toBeVisible({ timeout: 15000 });
  });

  test("login → favoritos → reseña sobre producto comprado", async ({ page }) => {
    test.skip(!CUSTOMER_EMAIL || !CUSTOMER_PASSWORD, "Falta CUSTOMER_EMAIL/PASSWORD seedeados");

    // Login
    await page.goto("/ingresar");
    await page.getByLabel(/email/i).fill(CUSTOMER_EMAIL);
    await page.getByLabel(/contraseña/i).fill(CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: /^ingresar$/i }).click();
    await expect(page).toHaveURL(/\/cuenta(\/)?$/, { timeout: 15000 });

    // Botón de Google presente en /ingresar (no se maneja OAuth en e2e)
    await page.goto("/ingresar");
    // ya logueada → redirige a /cuenta; volvemos a producto

    // Wishlist toggle
    await page.goto(`/producto/${PRODUCT_SLUG}`);
    const heart = page.getByRole("button", { name: /agregar a favoritos/i }).first();
    await heart.click();
    await expect(page.getByRole("button", { name: /quitar de favoritos/i }).first()).toBeVisible({ timeout: 10000 });
    await page.goto("/cuenta/favoritos");
    await expect(page.getByRole("link", { name: /labial mate/i }).first()).toBeVisible();

    // Reseña (compra verificada → auto-publicada)
    await page.goto(`/producto/${PRODUCT_SLUG}`);
    await page.getByRole("radio", { name: /5 estrellas/i }).click();
    await page.getByLabel(/tu experiencia/i).fill("Excelente labial, dura todo el día.");
    await page.getByRole("button", { name: /publicar reseña/i }).click();
    await expect(page.getByText(/excelente labial/i)).toBeVisible({ timeout: 15000 });
  });
});
```

> **Nota:** el botón de Google se valida implícitamente al estar `/ingresar` renderizado; si se quiere un assert explícito, agregar `await expect(page.getByRole("button", { name: /continuar con google/i })).toBeVisible()` en un bloque sin login previo.

- [ ] **Step 2: Correr el e2e (con prerequisitos)**

Run (PowerShell, con env seteado):
```
pnpm customer:create; pnpm db:seed; pnpm test:e2e -- tests/e2e/cuenta.spec.ts
```
Expected: los 2 tests PASS (registro confirma; login+favoritos+reseña verde).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/cuenta.spec.ts
git commit -m "test(m4): e2e DoD de cuenta (registro, login, favoritos, reseña post-compra)"
```

---

## Task 27: Documentación (TODO, SETUP, .env.example)

**Files:**
- Modify: `TODO.md`
- Modify: `SETUP.md`
- Modify: `.env.example`

- [ ] **Step 1: Actualizar `TODO.md`**

- Marcar como hecho/parcial: "Cron de autocancelación 24h" y "Cupones por cliente (`perCustomerLimit`)".
- Agregar bajo un encabezado "Diferidos de M4 (Cuentas + Clientas)" la lista de §1 DEFERRED del spec (conversión/crecimiento: order-bump, cross-sell, exit-intent, PostHog, SEO/OG, estética IA; moderación de reseñas en panel; fotos en reseñas; libreta de direcciones; magic link; carrito abandonado 2 etapas / WhatsApp; matching de pedidos de invitada por email).

- [ ] **Step 2: Actualizar `SETUP.md`**

Documentar: `pnpm customer:create` (vars `CUSTOMER_EMAIL`/`CUSTOMER_PASSWORD`); configurar **Google OAuth** en Supabase (Client ID/Secret de Google Cloud + redirect `${APP_URL}/auth/callback`); confirmación de email ON (o cómo desactivarla); el Cron Trigger horario (y `CRON_SECRET` si se usa el fallback Approach B).

- [ ] **Step 3: Actualizar `.env.example`**

Agregar (sin valores) los que falten: `CUSTOMER_EMAIL=`, `CUSTOMER_PASSWORD=`, y `CRON_SECRET=` (solo si se adoptó el fallback B). Verificar que `RESEND_FROM`/`RESEND_OWNER_EMAIL` ya estén.

- [ ] **Step 4: Verificación final completa**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: todo PASS.

- [ ] **Step 5: Commit**

```bash
git add TODO.md SETUP.md .env.example
git commit -m "docs(m4): TODO (diferidos), SETUP (create-customer, Google OAuth, cron) y .env.example"
```

---

## Self-Review (cobertura del spec)

- **§3 Migración** → Task 1. ✔
- **§4 Auth (helper, /ingresar, callback, middleware, merge)** → Tasks 2, 4, 5, 3. ✔
- **§5 Perfil (layout, dashboard, datos, pedidos, nav)** → Tasks 6, 7, 8, 9. ✔
- **§6 Reseñas (puras, servicio, display, alta)** → Tasks 12, 13, 14, 15. ✔
- **§7 Wishlist** → Tasks 10, 11. ✔
- **§8 Cupones perCustomerLimit (pura, checkout, webhook, advisory)** → Tasks 16, 17, 18, 19. ✔
- **§9 Crons (template, detección, jobs, worker)** → Tasks 20, 21, 22, 23, 24. ✔
- **§10 Tests (unit/integration/e2e, create-customer, seed, playwright env)** → distribuidos + Tasks 25, 26. ✔
- **§11 Housekeeping (TODO, SETUP, .env)** → Task 27. ✔

**Consistencia de tipos:** `ActionResult` (Task 1) reusado en Tasks 4/7/10/15/19. `CustomerUser`/`requireCustomer` (Task 2) reusados en Tasks 4/6/7/8/10/15. `validateCoupon` extendido (Task 16) consumido por Tasks 17/19. `findAbandonedCarts`/`AbandonedCartRow` (Task 21) consumidos por Task 22. `buildCronDeps` (Task 24) consume `AbandonedJobDeps` (Task 22) y `ExpiryJobDeps` (Task 23). Sin nombres divergentes detectados.

**Placeholders:** ninguno pendiente (la única nota de descubrimiento — `CATALOG_LIST_SELECT` en Task 11 — incluye instrucción concreta de exportar/reusar el shape existente).
