# M4b — Conversión + Crecimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las palancas de conversión/crecimiento del blueprint 06: order-bump + cross-sell (por tags), exit-intent (email + cupón), PostHog (opt-out), SEO + Open Graph, y moderación de reseñas (abrir + aprobar/rechazar).

**Architecture:** Sin migración de DB — reusa `Review.status`/`customerId`/`verifiedPurchase`, `Product.tags`, `Cart.contactEmail`/`recoveryEmailConsent`. Lógica pura en módulos sin `server-only` (unit), servicios con `deps.db` inyectable (integration), Server Actions devolviendo `ActionResult`, Server Components para lecturas. PostHog es client-only (no toca el worker).

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma, shadcn/Radix, Tailwind, `posthog-js`, Vitest, Playwright.

**Branch:** `m4b-conversion` (ya creada off `m4-cuentas`).

**Gate por tarea:** `pnpm typecheck` + `pnpm test` (vitest) verdes. `build:worker` y Playwright corren en CI (Windows local bloqueado por symlink — ver memoria del proyecto).

---

## File Structure (decomposición)

**Reseñas (Fase 1):**
- Create `src/lib/reviews/moderation.ts` — pura `classifyReview`.
- Modify `src/lib/reviews/validation.ts` — `validateReview` admite invitada (`authorName`).
- Modify `src/lib/reviews/service.ts` — `createReview` reescrito + `moderateReview`.
- Modify `src/lib/reviews/queries.ts` — `getModerationQueue`.
- Modify `src/app/(storefront)/producto/[slug]/review-actions.ts` — action abierta (guest).
- Modify `src/app/(storefront)/producto/[slug]/review-form.tsx` — form abierto + honeypot.
- Create `src/app/admin/(panel)/resenas/page.tsx` + `actions.ts` — panel moderación.
- Modify `src/components/admin/admin-sidebar.tsx` — ítem "Reseñas".

**Recomendaciones (Fase 2):**
- Create `src/lib/catalog/recommend.ts` — puras `selectOrderBump`, `rankRelated`, tipo `BumpOffer`.
- Create `src/lib/catalog/recommendations.ts` — queries server-only.
- Create `src/components/cart/order-bump.tsx` + `src/components/catalog/cross-sell.tsx`.
- Modify `src/components/cart/cart-contents.tsx`, `src/app/(storefront)/carrito/page.tsx`, `src/app/(storefront)/checkout/page.tsx`.

**Exit-intent (Fase 3):**
- Create `src/components/marketing/exit-intent.tsx` + `src/app/(storefront)/marketing-actions.ts`.

**Analytics (Fase 4):**
- Create `src/components/analytics/posthog-provider.tsx`, `cookie-consent.tsx`, `src/lib/analytics/track.ts`.

**SEO (Fase 5):**
- Create `src/lib/seo/url.ts` (absoluteUrl), `src/lib/seo/jsonld.ts` (puras).
- Create `src/app/sitemap.ts`, `src/app/robots.ts`.
- Modify `src/app/layout.tsx` (root metadata).

**Integración shared-files (Fase 6):** `producto/[slug]/page.tsx` (cross-sell + OG + JSON-LD), `(storefront)/layout.tsx` (exit-intent + PostHog + consent), event wiring, seed, env, docs, e2e.

> **Hotspots compartidos** (un solo dueño por archivo, integrados en Fase 6): `producto/[slug]/page.tsx`, `(storefront)/layout.tsx`, `prisma/seed.ts`, `.env.example`, `wrangler.jsonc`.

---

## Fase 0 — Dependencias y scaffolding

### Task 0.1: Instalar posthog-js

**Files:** Modify `package.json`

- [ ] **Step 1: Instalar**

Run: `pnpm add posthog-js`
Expected: `posthog-js` agregado a `dependencies`.

- [ ] **Step 2: Typecheck baseline**

Run: `pnpm typecheck`
Expected: PASS (sin cambios de código aún).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(m4b): add posthog-js"
```

---

## Fase 1 — Reseñas: abrir + moderación

### Task 1.1: Pura `classifyReview`

**Files:**
- Create `src/lib/reviews/moderation.ts`
- Test `tests/unit/reviews/moderation.test.ts`

- [ ] **Step 1: Test (falla)**

```typescript
// tests/unit/reviews/moderation.test.ts
import { describe, it, expect } from "vitest";
import { classifyReview } from "@/lib/reviews/moderation";

describe("classifyReview", () => {
  it("compra verificada → approved + verifiedPurchase", () => {
    expect(classifyReview(true)).toEqual({ status: "approved", verifiedPurchase: true });
  });
  it("sin compra → pending + no verificada", () => {
    expect(classifyReview(false)).toEqual({ status: "pending", verifiedPurchase: false });
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `pnpm test -- moderation`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```typescript
// src/lib/reviews/moderation.ts
import type { ReviewStatus } from "@prisma/client";

/** Decide visibilidad de una reseña: la compra verificada se auto-publica; el resto entra a moderación. */
export function classifyReview(hasPurchased: boolean): { status: ReviewStatus; verifiedPurchase: boolean } {
  return hasPurchased
    ? { status: "approved", verifiedPurchase: true }
    : { status: "pending", verifiedPurchase: false };
}
```

- [ ] **Step 4: Pasar**

Run: `pnpm test -- moderation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reviews/moderation.ts tests/unit/reviews/moderation.test.ts
git commit -m "feat(m4b): classifyReview (auto-aprobar verificada / moderar resto)"
```

### Task 1.2: `validateReview` admite invitada (authorName)

**Files:**
- Modify `src/lib/reviews/validation.ts`
- Test `tests/unit/reviews/validation.test.ts` (extender)

- [ ] **Step 1: Leer** `src/lib/reviews/validation.ts` y `tests/unit/reviews/validation.test.ts` para conocer la firma actual de `validateReview`.

- [ ] **Step 2: Test (falla)** — agregar al describe existente:

```typescript
it("invitada sin authorName → inválido", () => {
  const r = validateReview({ rating: 5, body: "Buenísimo", authorName: "" });
  expect(r.ok).toBe(false);
});
it("invitada con authorName válido → ok", () => {
  const r = validateReview({ rating: 5, body: "Buenísimo", authorName: "Caro" });
  expect(r.ok).toBe(true);
});
it("authorName no provisto (logueada) → ok", () => {
  const r = validateReview({ rating: 5, body: "Buenísimo" });
  expect(r.ok).toBe(true);
});
```

- [ ] **Step 3: Correr y ver fallar**

Run: `pnpm test -- reviews/validation`
Expected: FAIL.

- [ ] **Step 4: Implementar** — extender el input opcional `authorName?: string | null`. Regla: si `authorName` viene definido (no `undefined`), exigir trim 2–60 chars. (Logueada no lo pasa → no se valida; la action setea el nombre del customer aparte.) Mantener reglas de rating/body/title existentes y los mensajes en español.

- [ ] **Step 5: Pasar**

Run: `pnpm test -- reviews/validation`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reviews/validation.ts tests/unit/reviews/validation.test.ts
git commit -m "feat(m4b): validateReview admite authorName de invitada"
```

### Task 1.3: `createReview` reescrito + `moderateReview`

**Files:**
- Modify `src/lib/reviews/service.ts`
- Test `tests/integration/reviews/service.test.ts` (extender)

- [ ] **Step 1: Leer** el test existente para reusar el patrón de mock `deps.db` (`vi.fn`).

- [ ] **Step 2: Tests (fallan)** — cubrir:
  - logueada que compró → `create` llamado con `status:"approved"`, `verifiedPurchase:true`, `authorName` = nombre/email.
  - logueada que NO compró → `status:"pending"`, `verifiedPurchase:false` (ya **no** lanza error).
  - invitada (`customerId:null`, `authorName:"Caro"`) → `status:"pending"`, `verifiedPurchase:false`, sin chequeo de unique.
  - logueada con reseña existente → throw "Ya dejaste tu reseña…".
  - `moderateReview(id,"approve")` → update `status:"approved"`; `"reject"` → `status:"rejected"`.

```typescript
// patrón de mock (resumen)
const db = {
  review: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "r1" }), update: vi.fn().mockResolvedValue({ id: "r1" }) },
  orderItem: { findMany: vi.fn().mockResolvedValue([]) },
};
```

- [ ] **Step 3: Correr y ver fallar**

Run: `pnpm test -- reviews/service`
Expected: FAIL.

- [ ] **Step 4: Implementar** `createReview` reescrito:

```typescript
import "server-only";
import { hasPurchased } from "@/lib/reviews/purchase";
import { validateReview } from "@/lib/reviews/validation";
import { classifyReview } from "@/lib/reviews/moderation";

const PURCHASED_STATUSES = ["paid", "preparing", "shipped", "delivered"] as const;

export interface CreateReviewDb {
  orderItem: { findMany: (args: { where: Record<string, unknown>; select: { variant: { select: { productId: true } } } }) => Promise<Array<{ variant: { productId: string } | null }>> };
  review: {
    findUnique: (args: { where: { customerId_productId: { customerId: string; productId: string } } }) => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

export interface CreateReviewInput {
  customerId: string | null;
  authorName: string;        // logueada: name ?? email; invitada: nombre del form
  productId: string;
  rating: number;
  title?: string | null;
  body: string;
}

export async function createReview(input: CreateReviewInput, deps: { db: CreateReviewDb }): Promise<{ id: string; status: string }> {
  const valid = validateReview({
    rating: input.rating, title: input.title, body: input.body,
    authorName: input.customerId == null ? input.authorName : undefined,
  });
  if (!valid.ok) throw new Error(valid.reason);

  let purchased = false;
  if (input.customerId != null) {
    const existing = await deps.db.review.findUnique({ where: { customerId_productId: { customerId: input.customerId, productId: input.productId } } });
    if (existing) throw new Error("Ya dejaste tu reseña para este producto.");
    const rows = await deps.db.orderItem.findMany({
      where: { order: { customerId: input.customerId, status: { in: [...PURCHASED_STATUSES] } }, variant: { productId: input.productId } },
      select: { variant: { select: { productId: true } } },
    });
    purchased = hasPurchased(rows.map((r) => ({ productId: r.variant?.productId ?? "" })), input.productId);
  }

  const { status, verifiedPurchase } = classifyReview(purchased);
  const created = await deps.db.review.create({
    data: {
      productId: input.productId, customerId: input.customerId, authorName: input.authorName,
      rating: input.rating, title: input.title?.trim() || null, body: input.body.trim(),
      verifiedPurchase, status,
    },
  });
  return { id: created.id, status };
}

export type ModerationAction = "approve" | "reject";
export async function moderateReview(id: string, action: ModerationAction, deps: { db: Pick<CreateReviewDb, "review"> }): Promise<{ id: string }> {
  return deps.db.review.update({ where: { id }, data: { status: action === "approve" ? "approved" : "rejected" } });
}
```

- [ ] **Step 5: Pasar**

Run: `pnpm test -- reviews/service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reviews/service.ts tests/integration/reviews/service.test.ts
git commit -m "feat(m4b): createReview abierto (invitada→pending) + moderateReview"
```

### Task 1.4: `getModerationQueue`

**Files:** Modify `src/lib/reviews/queries.ts`

- [ ] **Step 1: Implementar** (no requiere test unit; es query Prisma directa, se cubre en e2e):

```typescript
export interface ModerationItem {
  id: string; productName: string; productSlug: string;
  authorName: string; rating: number; title: string | null; body: string;
  verifiedPurchase: boolean; createdAt: Date;
}

export async function getModerationQueue(): Promise<ModerationItem[]> {
  const rows = await prisma.review.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    select: { id: true, authorName: true, rating: true, title: true, body: true, verifiedPurchase: true, createdAt: true, product: { select: { name: true, slug: true } } },
  });
  return rows.map((r) => ({
    id: r.id, productName: r.product.name, productSlug: r.product.slug,
    authorName: r.authorName, rating: r.rating, title: r.title, body: r.body,
    verifiedPurchase: r.verifiedPurchase, createdAt: r.createdAt,
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reviews/queries.ts
git commit -m "feat(m4b): getModerationQueue (reseñas pending)"
```

### Task 1.5: Storefront review action abierta + form

**Files:**
- Modify `src/app/(storefront)/producto/[slug]/review-actions.ts`
- Modify `src/app/(storefront)/producto/[slug]/review-form.tsx`

- [ ] **Step 1: Reescribir action** — usar `getCustomer()` (no `requireCustomer`); honeypot:

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { getCustomer } from "@/lib/customer/auth";
import { createReview } from "@/lib/reviews/service";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/forms/action-result";

export interface ReviewActionResult extends ActionResult { status?: string }

export async function createReviewAction(input: {
  productId: string; slug: string; rating: number; title: string; body: string;
  authorName?: string; website?: string; // website = honeypot
}): Promise<ReviewActionResult> {
  if (input.website && input.website.trim() !== "") return { ok: true }; // bot: fingir éxito, no crear
  const customer = await getCustomer();
  try {
    const res = await createReview(
      {
        customerId: customer?.id ?? null,
        authorName: customer ? (customer.name ?? customer.email) : (input.authorName ?? "").trim(),
        productId: input.productId, rating: Number(input.rating), title: input.title, body: input.body,
      },
      { db: prisma as never },
    );
    revalidatePath(`/producto/${input.slug}`);
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo enviar la reseña." };
  }
}
```

- [ ] **Step 2: Form abierto** — `review-form.tsx`: agregar prop `isLoggedIn: boolean`; si `!isLoggedIn` mostrar campo `authorName` (requerido) + nota; honeypot oculto `name="website"`; mensaje de éxito según `res.status` (`pending` → "se publicará tras revisión"; `approved` → "ya está publicada"). Emitir `track("review_submitted", { status })` (de Fase 4; dejar el call y stub `track` ya disponible).

Contrato del componente:
```typescript
export function ReviewForm({ productId, slug, isLoggedIn }: { productId: string; slug: string; isLoggedIn: boolean }) { /* ... */ }
```
Honeypot:
```tsx
<input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
```

- [ ] **Step 3: Typecheck** (la página se actualiza en Fase 6; si el typecheck rompe por la prop nueva, pasar `isLoggedIn` provisional en Fase 6).

Run: `pnpm typecheck`
Expected: PASS tras ajustar el call en page (Fase 6) — si se ejecuta aislado, marcar y resolver en 6.1.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(storefront)/producto/[slug]/review-actions.ts" "src/app/(storefront)/producto/[slug]/review-form.tsx"
git commit -m "feat(m4b): reseñas abiertas (invitada con nombre + honeypot)"
```

### Task 1.6: Panel de moderación

**Files:**
- Create `src/app/admin/(panel)/resenas/actions.ts`
- Create `src/app/admin/(panel)/resenas/page.tsx`
- Modify `src/components/admin/admin-sidebar.tsx`

- [ ] **Step 1: Leer** `src/app/admin/(panel)/cupones/actions.ts` + `page.tsx` para copiar el patrón (`requireAdmin`, `PageHeader`, `Table`, `ConfirmDialog`).

- [ ] **Step 2: Actions admin:**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { moderateReview } from "@/lib/reviews/service";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/forms/action-result";

async function moderate(id: string, action: "approve" | "reject", slug: string): Promise<ActionResult> {
  await requireAdmin();
  await moderateReview(id, action, { db: prisma as never });
  revalidatePath("/admin/resenas");
  revalidatePath(`/producto/${slug}`);
  return { ok: true };
}
export const approveReviewAction = (id: string, slug: string) => moderate(id, "approve", slug);
export const rejectReviewAction = (id: string, slug: string) => moderate(id, "reject", slug);
```

- [ ] **Step 3: Page** — server component: `requireAdmin()` → `getModerationQueue()` → tabla con producto (link a `/producto/[slug]`), `RatingStars`, autor + badge "Compra verificada" si aplica, extracto del body, fecha (formato ART), y dos acciones (Aprobar/Rechazar) vía un client component que llama las actions con `ConfirmDialog`. Empty state "No hay reseñas pendientes."

- [ ] **Step 4: Sidebar** — agregar a `ITEMS`:
```typescript
import { Star } from "lucide-react";
{ href: "/admin/resenas", label: "Reseñas", icon: Star },
```
Cambiar la grilla mobile de `grid-cols-6` a `grid-cols-7` (verificar que los 7 ítems no rompan ≥44px; si aprieta en 375px, reducir padding/horizontal scroll del nav mobile).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(panel)/resenas" src/components/admin/admin-sidebar.tsx
git commit -m "feat(m4b): panel admin de moderación de reseñas (aprobar/rechazar)"
```

---

## Fase 2 — Recomendaciones: order-bump + cross-sell

### Task 2.1: Puras `selectOrderBump` + `rankRelated`

**Files:**
- Create `src/lib/catalog/recommend.ts`
- Test `tests/unit/catalog/recommend.test.ts`

- [ ] **Step 1: Test (falla)**

```typescript
import { describe, it, expect } from "vitest";
import { selectOrderBump, rankRelated, type BumpOffer } from "@/lib/catalog/recommend";

const o = (id: string, price: number, variantId = id + "v"): BumpOffer => ({ productId: id, variantId, name: id, image: null, price });

describe("selectOrderBump", () => {
  it("elige el más barato no presente en el carrito", () => {
    expect(selectOrderBump([o("a", 500), o("b", 300), o("c", 800)], [])?.productId).toBe("b");
  });
  it("excluye los que ya están en el carrito (por variantId)", () => {
    expect(selectOrderBump([o("a", 500, "av"), o("b", 300, "bv")], ["bv"])?.productId).toBe("a");
  });
  it("null si no quedan candidatos", () => {
    expect(selectOrderBump([o("a", 300, "av")], ["av"])).toBeNull();
    expect(selectOrderBump([], [])).toBeNull();
  });
});

describe("rankRelated", () => {
  const p = (id: string, featured: boolean) => ({ id, isFeatured: featured }) as never;
  it("featured primero y corta a limit", () => {
    const r = rankRelated([p("a", false), p("b", true), p("c", true), p("d", false)], 2) as Array<{ id: string }>;
    expect(r.map((x) => x.id)).toEqual(["b", "c"]);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `pnpm test -- catalog/recommend`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/catalog/recommend.ts
import type { CatalogProduct } from "@/lib/catalog/types";

export interface BumpOffer { productId: string; variantId: string; name: string; image: string | null; price: number }

/** Elige el bump más barato cuya variante por defecto no esté ya en el carrito. */
export function selectOrderBump(candidates: BumpOffer[], cartVariantIds: string[]): BumpOffer | null {
  const inCart = new Set(cartVariantIds);
  const eligible = candidates.filter((c) => !inCart.has(c.variantId));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) => (c.price < best.price ? c : best));
}

/** Ordena relacionados con destacados primero (orden estable) y corta a `limit`. */
export function rankRelated(products: CatalogProduct[], limit: number): CatalogProduct[] {
  return [...products].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)).slice(0, limit);
}
```

- [ ] **Step 4: Pasar**

Run: `pnpm test -- catalog/recommend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/recommend.ts tests/unit/catalog/recommend.test.ts
git commit -m "feat(m4b): puras selectOrderBump + rankRelated"
```

### Task 2.2: Queries de recomendación

**Files:** Create `src/lib/catalog/recommendations.ts`

- [ ] **Step 1: Implementar** (server-only; usa `PRODUCT_INCLUDE` + helpers de pricing/stock existentes):

```typescript
import "server-only";
import { prisma } from "@/lib/prisma";
import { PRODUCT_INCLUDE } from "@/lib/catalog/queries";
import { getEffectivePrice, toNumber } from "@/lib/catalog/pricing";
import { rankRelated, type BumpOffer } from "@/lib/catalog/recommend";
import type { CatalogProduct } from "@/lib/catalog/types";

/** Candidatos a order-bump (tag "order-bump", activos, con stock), proyectados a BumpOffer. */
export async function getOrderBumpOffers(): Promise<BumpOffer[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, deletedAt: null, tags: { has: "order-bump" }, variants: { some: { active: true, stock: { gt: 0 } } } },
    include: PRODUCT_INCLUDE,
  });
  return (rows as CatalogProduct[])
    .map((p) => {
      const variant = p.variants.find((v) => v.active && v.stock > 0);
      if (!variant) return null;
      return { productId: p.id, variantId: variant.id, name: p.name, image: variant.image ?? p.images[0] ?? null, price: getEffectivePrice(p) } satisfies BumpOffer;
    })
    .filter((x): x is BumpOffer => x !== null);
}

/** "Te puede gustar": misma categoría, excluye el actual; destacados primero. */
export async function getRelatedProducts(productId: string, categoryId: string, limit = 4): Promise<CatalogProduct[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, deletedAt: null, categoryId, id: { not: productId } },
    include: PRODUCT_INCLUDE,
    take: limit * 3,
  });
  return rankRelated(rows as CatalogProduct[], limit);
}

/** Cross-sell del carrito: productos de las categorías del carrito, excluyendo los que ya están. */
export async function getCartCrossSell(categoryIds: string[], excludeProductIds: string[], limit = 4): Promise<CatalogProduct[]> {
  if (categoryIds.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { active: true, deletedAt: null, categoryId: { in: categoryIds }, id: { notIn: excludeProductIds.length ? excludeProductIds : ["00000000-0000-0000-0000-000000000000"] } },
    include: PRODUCT_INCLUDE,
    take: limit * 3,
  });
  return rankRelated(rows as CatalogProduct[], limit);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/catalog/recommendations.ts
git commit -m "feat(m4b): queries de order-bump y cross-sell (por tags / categoría)"
```

### Task 2.3: Componente order-bump

**Files:** Create `src/components/cart/order-bump.tsx`

- [ ] **Step 1: Leer** `src/components/cart/add-to-cart.tsx` para reusar el patrón de botón optimista + `addToCartAction`.

- [ ] **Step 2: Implementar** — server component que recibe `offer: BumpOffer | null` (lo resuelve el caller con `getOrderBumpOffers` + `selectOrderBump`) + client child para el botón:

```tsx
// Contrato: el caller (cart-contents / carrito / checkout) hace:
//   const offers = await getOrderBumpOffers();
//   const offer = selectOrderBump(offers, cart.items.map(i => i.variantId).filter(Boolean));
//   {offer && <OrderBump offer={offer} />}
```
UI compacta (1 línea, fondo `bg-secondary/30`, radii del DS): "✨ Sumá **{name}** a {formatARS(price)}" + botón **Agregar** (44px) → `addToCartAction({ variantId })` → `router.refresh()`. En el click, `track("order_bump_added", { productId })` (Fase 4). Usar `lucide-react` (Plus/Sparkles), nada de emojis como ícono (el ✨ textual está OK por marca; preferir `Sparkles` icon). Reusar `formatARS`/`money` helpers existentes.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/cart/order-bump.tsx
git commit -m "feat(m4b): componente order-bump"
```

### Task 2.4: Componente cross-sell

**Files:** Create `src/components/catalog/cross-sell.tsx`

- [ ] **Step 1: Implementar** — recibe `products: CatalogProduct[]` + `title?` (default "Te puede gustar"); si vacío, no renderiza. Reusa `ProductGrid`:

```tsx
import { ProductGrid } from "@/components/catalog/product-grid";
import type { CatalogProduct } from "@/lib/catalog/types";

export function CrossSell({ products, title = "Te puede gustar" }: { products: CatalogProduct[]; title?: string }) {
  if (products.length === 0) return null;
  return (
    <section className="border-t border-border pt-6">
      <h2 className="mb-4 font-display text-lg">{title}</h2>
      <ProductGrid products={products} />
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + Commit**

Run: `pnpm typecheck` → PASS
```bash
git add src/components/catalog/cross-sell.tsx
git commit -m "feat(m4b): componente cross-sell 'Te puede gustar'"
```

### Task 2.5: Order-bump en carrito y checkout

**Files:**
- Modify `src/components/cart/cart-contents.tsx`
- Modify `src/app/(storefront)/carrito/page.tsx`
- Modify `src/app/(storefront)/checkout/page.tsx`

- [ ] **Step 1: Leer** `carrito/page.tsx` y `checkout/page.tsx` para ubicar el punto de inserción (encima del resumen).

- [ ] **Step 2: Insertar** en los tres: resolver `getOrderBumpOffers()` + `selectOrderBump(offers, variantIdsDelCarrito)` y renderizar `<OrderBump offer={offer} />`. En `cart-contents.tsx` (drawer) ubicarlo entre la lista de items y el `Separator`/resumen. En `/carrito` y `/checkout`, encima del `CartSummary`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/components/cart/cart-contents.tsx" "src/app/(storefront)/carrito/page.tsx" "src/app/(storefront)/checkout/page.tsx"
git commit -m "feat(m4b): order-bump en drawer, carrito y checkout"
```

> Cross-sell en ficha y `/carrito` se integra en Fase 6 (la ficha es hotspot compartido). En `/carrito` se puede agregar acá si no choca con la ficha; preferible centralizar en 6.

---

## Fase 3 — Exit-intent

### Task 3.1: Server action de captura

**Files:** Create `src/app/(storefront)/marketing-actions.ts`

- [ ] **Step 1: Implementar** — reusa `ensureCartId` (extraer/duplicar el helper de `actions.ts` o exportarlo). Setea email + consent en el cart; devuelve el código del cupón:

```typescript
"use server";
import { prisma } from "@/lib/prisma";
import { getCartIdFromCookie, setCartIdCookie } from "@/lib/cart/cart-cookie";
import { createCart } from "@/lib/cart/cart-service";
import type { ActionResult } from "@/lib/forms/action-result";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ExitIntentResult extends ActionResult { couponCode?: string | null }

export async function captureExitIntentAction(input: { email: string }): Promise<ExitIntentResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Email inválido." };
  let cartId = await getCartIdFromCookie();
  const existing = cartId ? await prisma.cart.findUnique({ where: { id: cartId }, select: { id: true, status: true } }) : null;
  if (!existing || existing.status !== "active") { cartId = await createCart(); await setCartIdCookie(cartId); }
  await prisma.cart.update({ where: { id: cartId! }, data: { contactEmail: email, recoveryEmailConsent: true } });
  const couponCode = process.env.NEXT_PUBLIC_WELCOME_COUPON_CODE?.trim() || null;
  return { ok: true, couponCode };
}
```

- [ ] **Step 2: Typecheck + Commit**

Run: `pnpm typecheck` → PASS
```bash
git add "src/app/(storefront)/marketing-actions.ts"
git commit -m "feat(m4b): captureExitIntentAction (email→recovery + cupón)"
```

### Task 3.2: Modal exit-intent (client)

**Files:** Create `src/components/marketing/exit-intent.tsx`

- [ ] **Step 1: Implementar** (client) — usa `Dialog` de Radix (ya instalado vía `@radix-ui/react-dialog`; ver `cart-drawer.tsx`/`sheet.tsx` por patrón). Lógica:
  - `useEffect`: si `localStorage.getItem("glamify_exit_seen")` → no montar listeners.
  - Desktop: `document.addEventListener("mouseleave", e => { if (e.clientY <= 0) open() })`.
  - Mobile (sin hover): timeout de inactividad 25s o `popstate`/scroll-up rápido → open().
  - Al abrir: set `glamify_exit_seen`, `track("exit_intent_shown")`.
  - No abrir si `localStorage.getItem("glamify_analytics")` aún no está seteado (banner de consentimiento visible) — re-chequear en el handler.
  - `prefers-reduced-motion`: si activo, sin animación de entrada (clase condicional).
  - Form: input email → `captureExitIntentAction` → en éxito, si `couponCode` mostrar código + botón "Copiar" (`navigator.clipboard`), `track("exit_intent_submitted")`; si `couponCode` null, mensaje "¡Listo! Te avisamos novedades." Cerrar con botón.

- [ ] **Step 2: Typecheck + Commit** (el montaje en el layout va en Fase 6)

Run: `pnpm typecheck` → PASS
```bash
git add src/components/marketing/exit-intent.tsx
git commit -m "feat(m4b): modal exit-intent (una vez, reduced-motion)"
```

---

## Fase 4 — PostHog + consentimiento

### Task 4.1: Wrapper `track`

**Files:** Create `src/lib/analytics/track.ts`

- [ ] **Step 1: Implementar** — tipado, no-op si PostHog no init (SSR o sin key):

```typescript
import posthog from "posthog-js";

export type AnalyticsEvent =
  | "product_viewed" | "add_to_cart" | "begin_checkout" | "purchase"
  | "order_bump_added" | "exit_intent_shown" | "exit_intent_submitted" | "review_submitted";

export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.capture(event, props);
}
```

- [ ] **Step 2: Typecheck + Commit**

Run: `pnpm typecheck` → PASS
```bash
git add src/lib/analytics/track.ts
git commit -m "feat(m4b): wrapper tipado track() para PostHog"
```

### Task 4.2: Provider + consent banner

**Files:**
- Create `src/components/analytics/posthog-provider.tsx`
- Create `src/components/analytics/cookie-consent.tsx`

- [ ] **Step 1: Provider** (client) — init en `useEffect` solo si `process.env.NEXT_PUBLIC_POSTHOG_KEY`; host de `NEXT_PUBLIC_POSTHOG_HOST` (default `https://us.i.posthog.com`); `person_profiles: "identified_only"`, `capture_pageview: true`. Tras init, si cookie `glamify_analytics === "no"` → `posthog.opt_out_capturing()`. Devuelve `{children}` (no envuelve en PHProvider de react para mantenerlo liviano; el `track()` usa el singleton).

```tsx
"use client";
import { useEffect } from "react";
import posthog from "posthog-js";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
    });
    if (readCookie("glamify_analytics") === "no") posthog.opt_out_capturing();
  }, []);
  return <>{children}</>;
}
```

- [ ] **Step 2: Consent banner** (client) — muestra si cookie `glamify_analytics` no seteada. Aceptar → cookie `yes` (1 año), oculta. Rechazar → cookie `no` + `posthog.opt_out_capturing()`, oculta. Banner inferior sutil, tokens del DS, ≥44px, link "Más info" placeholder. Setea también `localStorage.glamify_analytics` (lo lee exit-intent para no solaparse).

- [ ] **Step 3: Typecheck + Commit**

Run: `pnpm typecheck` → PASS
```bash
git add src/components/analytics/posthog-provider.tsx src/components/analytics/cookie-consent.tsx
git commit -m "feat(m4b): PostHog provider + banner de consentimiento opt-out"
```

### Task 4.3: Wiring de eventos

**Files:** Modify `src/components/cart/add-to-cart.tsx`, `src/app/(storefront)/checkout/checkout-form.tsx`, `src/app/(storefront)/checkout/gracias/page.tsx`

- [ ] **Step 1:** `add-to-cart.tsx` → `track("add_to_cart", { ... })` tras éxito. `checkout-form.tsx` → `track("begin_checkout")` al montar o al enviar. `gracias/page.tsx` → es server component; agregar un pequeño client child `<PurchaseTracker orderNumber total />` que dispare `track("purchase", { orderNumber, total })` una vez. (product_viewed y review_submitted se cablean en Fase 6 / Task 1.5.)

- [ ] **Step 2: Typecheck + Commit**

Run: `pnpm typecheck` → PASS
```bash
git add "src/components/cart/add-to-cart.tsx" "src/app/(storefront)/checkout/checkout-form.tsx" "src/app/(storefront)/checkout/gracias/page.tsx"
git commit -m "feat(m4b): eventos PostHog (add_to_cart, begin_checkout, purchase)"
```

---

## Fase 5 — SEO + Open Graph

### Task 5.1: Helper `absoluteUrl` + JSON-LD puro

**Files:**
- Create `src/lib/seo/url.ts`
- Create `src/lib/seo/jsonld.ts`
- Test `tests/unit/seo/jsonld.test.ts`

- [ ] **Step 1: Test (falla)**

```typescript
import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "@/lib/seo/jsonld";

describe("buildProductJsonLd", () => {
  const base = { name: "Labial Rojo", description: "Mate", images: ["https://x/1.jpg"], sku: "LAB-0001", price: 5000, inStock: true, url: "https://glamify/producto/labial-rojo" };
  it("incluye Offer con precio ARS y availability InStock", () => {
    const ld = buildProductJsonLd(base, { average: 0, count: 0 });
    expect(ld["@type"]).toBe("Product");
    expect(ld.offers.priceCurrency).toBe("ARS");
    expect(ld.offers.availability).toContain("InStock");
    expect(ld.aggregateRating).toBeUndefined();
  });
  it("agrega aggregateRating sólo si hay reseñas", () => {
    const ld = buildProductJsonLd(base, { average: 4.5, count: 3 });
    expect(ld.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 3 });
  });
  it("OutOfStock cuando inStock=false", () => {
    const ld = buildProductJsonLd({ ...base, inStock: false }, { average: 0, count: 0 });
    expect(ld.offers.availability).toContain("OutOfStock");
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `pnpm test -- seo/jsonld`
Expected: FAIL.

- [ ] **Step 3: Implementar** `url.ts`:

```typescript
export function appBaseUrl(): string { return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"; }
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, appBaseUrl()).toString();
}
```

`jsonld.ts`:

```typescript
export interface ProductLdInput { name: string; description: string | null; images: string[]; sku?: string | null; price: number; inStock: boolean; url: string; brand?: string }
export function buildProductJsonLd(p: ProductLdInput, rating: { average: number; count: number }) {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "Product",
    name: p.name, description: p.description ?? undefined, image: p.images, sku: p.sku ?? undefined,
    brand: { "@type": "Brand", name: p.brand ?? "Glamify Makeup" },
    offers: { "@type": "Offer", price: p.price.toFixed(2), priceCurrency: "ARS", availability: `https://schema.org/${p.inStock ? "InStock" : "OutOfStock"}`, url: p.url },
  };
  if (rating.count > 0) ld.aggregateRating = { "@type": "AggregateRating", ratingValue: Math.round(rating.average * 10) / 10, reviewCount: rating.count };
  return ld as { "@type": string; offers: { priceCurrency: string; availability: string }; aggregateRating?: { "@type": string; ratingValue: number; reviewCount: number } };
}
export function buildWebSiteJsonLd(url: string) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: "Glamify Makeup", url };
}
export function buildOrganizationJsonLd(url: string) {
  return { "@context": "https://schema.org", "@type": "Organization", name: "Glamify Makeup", url };
}
```

- [ ] **Step 4: Pasar**

Run: `pnpm test -- seo/jsonld`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/url.ts src/lib/seo/jsonld.ts tests/unit/seo/jsonld.test.ts
git commit -m "feat(m4b): helpers SEO (absoluteUrl + JSON-LD product/site/org)"
```

### Task 5.2: sitemap + robots

**Files:**
- Create `src/app/sitemap.ts`
- Create `src/app/robots.ts`

- [ ] **Step 1: sitemap.ts**

```typescript
import type { MetadataRoute } from "next";
import { getActiveProductSlugs, getCategoryTree } from "@/lib/catalog/queries";
import { absoluteUrl } from "@/lib/seo/url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, tree] = await Promise.all([getActiveProductSlugs(), getCategoryTree()]);
  const now = new Date();
  const cats = tree.flatMap((c) => [
    { url: absoluteUrl(`/tienda/${c.slug}`), lastModified: now },
    ...c.children.map((s) => ({ url: absoluteUrl(`/tienda/${c.slug}/${s.slug}`), lastModified: now })),
  ]);
  return [
    { url: absoluteUrl("/"), lastModified: now },
    { url: absoluteUrl("/tienda"), lastModified: now },
    ...cats,
    ...slugs.map((s) => ({ url: absoluteUrl(`/producto/${s}`), lastModified: now })),
  ];
}
```

- [ ] **Step 2: robots.ts**

```typescript
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/cuenta", "/checkout", "/api", "/ingresar"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
```

- [ ] **Step 3: Typecheck + Commit**

Run: `pnpm typecheck` → PASS
```bash
git add src/app/sitemap.ts src/app/robots.ts
git commit -m "feat(m4b): sitemap.xml + robots.txt"
```

### Task 5.3: Metadata raíz (OG/Twitter/robots)

**Files:** Modify `src/app/layout.tsx`

- [ ] **Step 1: Implementar** — extender `metadata`:

```typescript
import { appBaseUrl } from "@/lib/seo/url";
export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl()),
  title: { default: "Glamify Makeup — Maquillaje y accesorios", template: "%s — Glamify Makeup" },
  description: "Glam accesible: maquillaje y accesorios lindos, en tendencia y a buen precio. Envíos a todo el país.",
  applicationName: "Glamify Makeup",
  openGraph: { type: "website", siteName: "Glamify Makeup", locale: "es_AR", title: "Glamify Makeup — Maquillaje y accesorios", description: "Glam accesible, a precio real. Envíos a todo el país." },
  twitter: { card: "summary_large_image", title: "Glamify Makeup", description: "Glam accesible, a precio real." },
  robots: { index: true, follow: true },
};
```
> Nota: la ficha ya tiene `generateMetadata` con título/desc; al usar `template`, ajustar la ficha para no duplicar " — Glamify Makeup" (Fase 6).

- [ ] **Step 2: Typecheck + Commit**

Run: `pnpm typecheck` → PASS
```bash
git add src/app/layout.tsx
git commit -m "feat(m4b): metadata raíz (OG, Twitter, robots, metadataBase)"
```

---

## Fase 6 — Integración (hotspots compartidos) + datos + docs + e2e

### Task 6.1: Ficha de producto — form abierto + cross-sell + OG + JSON-LD

**Files:** Modify `src/app/(storefront)/producto/[slug]/page.tsx`

- [ ] **Step 1: Form abierto** — pasar `isLoggedIn={Boolean(customer)}` a `<ReviewForm>` y mostrarlo **siempre** (eliminar el gate "solo quienes compraron"). Mantener "Ya dejaste tu reseña" si `alreadyReviewed` (logueada).
- [ ] **Step 2: Cross-sell** — `const related = await getRelatedProducts(product.id, product.categoryId, 4);` → `<CrossSell products={related} />` al final del `<article>`.
- [ ] **Step 3: SEO/OG** — en `generateMetadata`, sumar `openGraph.images` con `absoluteUrl(product.images[0])` (si hay), `openGraph.title` = `product.name`, `alternates.canonical = absoluteUrl('/producto/' + slug)`. Ajustar título para el `template` raíz (devolver solo `product.name` como title, o `seoTitle`).
- [ ] **Step 4: JSON-LD** — calcular `inStock` (alguna variante con stock>0), construir `buildProductJsonLd({...}, { average, count })` y renderizar `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />`.
- [ ] **Step 5: product_viewed** — client child `<ProductViewTracker productId slug />` que dispare `track("product_viewed", {...})`.

- [ ] **Step 6: Typecheck + test**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(storefront)/producto/[slug]/page.tsx"
git commit -m "feat(m4b): ficha — reseñas abiertas + cross-sell + OG + JSON-LD"
```

### Task 6.2: Cross-sell en carrito

**Files:** Modify `src/app/(storefront)/carrito/page.tsx`

- [ ] **Step 1:** resolver categorías del carrito + `getCartCrossSell(catIds, productIdsEnCarrito, 4)` → `<CrossSell products={...} />` debajo del contenido. Typecheck → PASS.

- [ ] **Step 2: Commit**

```bash
git add "src/app/(storefront)/carrito/page.tsx"
git commit -m "feat(m4b): cross-sell en /carrito"
```

### Task 6.3: Layout storefront — PostHog + consent + exit-intent

**Files:** Modify `src/app/(storefront)/layout.tsx`

- [ ] **Step 1:** envolver el árbol en `<PostHogProvider>`; montar `<CookieConsent />` y `<ExitIntent />` dentro del layout (después del `</main>`/footer). Orden: consent banner primero, exit-intent coordina por `localStorage`.

- [ ] **Step 2: Typecheck + Commit**

Run: `pnpm typecheck` → PASS
```bash
git add "src/app/(storefront)/layout.tsx"
git commit -m "feat(m4b): montar PostHog, consent y exit-intent en storefront"
```

### Task 6.4: Home — OG image + JSON-LD de sitio

**Files:** Modify `src/app/(storefront)/page.tsx`

- [ ] **Step 1:** agregar `<script>` JSON-LD `buildWebSiteJsonLd` + `buildOrganizationJsonLd`. Opcional: `export const metadata`/`generateMetadata` con `openGraph.images` = foto del primer destacado. Typecheck → PASS.

- [ ] **Step 2: Commit**

```bash
git add "src/app/(storefront)/page.tsx"
git commit -m "feat(m4b): home — JSON-LD de sitio + OG"
```

### Task 6.5: Seed — cupón de bienvenida + tag order-bump

**Files:** Modify `prisma/seed.ts`

- [ ] **Step 1: Leer** `prisma/seed.ts` para reusar el patrón de upsert.
- [ ] **Step 2:** `upsert` de `Coupon` `BIENVENIDA10` (type `percentage`, value 10, scope `all`, `perCustomerLimit: 1`, `active: true`, idempotente por `code`). Agregar `"order-bump"` a `tags` de un producto accesorio/brocha conocido del seed (push si no está).
- [ ] **Step 3: Verificar** (worktree: `.env` además de `.env.local`):

Run: `pnpm db:seed`
Expected: corre sin error; cupón + tag presentes.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(m4b): seed cupón BIENVENIDA10 + tag order-bump"
```

### Task 6.6: Env + wrangler

**Files:** Modify `.env.example`, `wrangler.jsonc`

- [ ] **Step 1:** `.env.example` — activar `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`; agregar `NEXT_PUBLIC_WELCOME_COUPON_CODE=BIENVENIDA10`. `wrangler.jsonc [vars]` — agregar `NEXT_PUBLIC_POSTHOG_HOST` y `NEXT_PUBLIC_WELCOME_COUPON_CODE` (públicas).
- [ ] **Step 2: Commit**

```bash
git add .env.example wrangler.jsonc
git commit -m "chore(m4b): env vars PostHog + welcome coupon"
```

### Task 6.7: E2E

**Files:** Create `tests/e2e/conversion.spec.ts`

- [ ] **Step 1: Leer** `tests/e2e/cuenta.spec.ts` + `catalog.spec.ts` para reusar fixtures/login.
- [ ] **Step 2: Escribir** specs:
  - Invitada deja reseña en una ficha → ve mensaje "se publicará tras revisión" y la reseña **no** aparece en la lista (sigue `pending`).
  - Order-bump visible en `/carrito` con un producto tag `order-bump` y carrito no vacío; click "Agregar" suma el item.
  - Banner de consentimiento presente; "Rechazar" lo oculta.
- [ ] **Step 3:** (Local Windows: no correr Playwright — symlink EPERM. Verificar sintaxis con `pnpm typecheck`; corre en CI.)

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/conversion.spec.ts
git commit -m "test(m4b): e2e conversión (reseña invitada pending, order-bump, consent)"
```

### Task 6.8: Docs — SETUP + TODO

**Files:** Modify `SETUP.md`, `TODO.md`

- [ ] **Step 1: SETUP.md** — sección PostHog (crear proyecto free, copiar `NEXT_PUBLIC_POSTHOG_KEY`/`HOST`), cupón de bienvenida (seedeado; cambiar código vía `NEXT_PUBLIC_WELCOME_COUPON_CODE`), nota "OG image de marca pendiente (estética IA)".
- [ ] **Step 2: TODO.md** — mover a hecho: order-bump, cross-sell, exit-intent, PostHog, SEO/OG, moderación de reseñas. Dejar diferidos: estética IA (assets/OG de marca), fotos en reseñas, captcha.
- [ ] **Step 3: Commit**

```bash
git add SETUP.md TODO.md
git commit -m "docs(m4b): SETUP PostHog/cupón + TODO actualizado"
```

### Task 6.9: Verificación final

- [ ] **Step 1:** `pnpm typecheck` → PASS.
- [ ] **Step 2:** `pnpm test` → todos verdes.
- [ ] **Step 3:** `pnpm lint` → sin errores nuevos.
- [ ] **Step 4:** Revisar `git log --oneline` de la rama: commits por área, mensajes claros.
- [ ] **Step 5:** Resumen de DoD cumplido + nota de que `build:worker`/e2e corren en CI (Windows local bloqueado).

---

## Notas de ejecución (paralelización con subagentes)

- **Paralelizables sin conflicto** (archivos nuevos / disjuntos): Fase 1 (Tasks 1.1–1.4), Fase 2 (2.1–2.4), Fase 3, Fase 4 (4.1–4.2), Fase 5 (5.1–5.3). Pueden correr en paralelo.
- **Secuenciales / dueño único** (hotspots): Fase 6 — `producto/[slug]/page.tsx`, `(storefront)/layout.tsx`, seed, env. Integrar tras las fases paralelas. Tasks 1.5/1.6 y 2.5 tocan archivos propios y pueden ir en paralelo con sus fases.
- **Regla de oro:** ningún subagente edita un hotspot compartido en paralelo con otro. La integración de hotspots la hace un solo paso (o el main loop).
