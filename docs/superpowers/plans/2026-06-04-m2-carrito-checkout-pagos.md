# M2 — Carrito + Checkout + Pagos (Glamify Makeup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir comprar de punta a punta — agregar al carrito → checkout invitado de un paso → pagar con Mercado Pago Checkout Pro (sandbox) → el webhook confirma el pago, descuenta stock y manda emails — sobre los cimientos de M0/M1.

**Architecture:** Carrito server-persistido identificado por cookie httpOnly (`glamify_cart` → `Cart.sessionId`). **Server Actions** para todas las mutaciones de UI (carrito, cupón, envío, checkout); **Route Handler** SOLO para el webhook de MP. Lógica de negocio en **libs puras** (TDD unit) + **servicios IO** con *seam de inyección de dependencias* (`{ db, mp, email }`) para test sin red ni DB. Dinero: `number` + `round2`, persistido `Decimal(12,2)`. MP y Resend por `fetch` (runtime Workers); firma del webhook con **Web Crypto HMAC-SHA256**. Idempotencia por `Payment.mpPaymentId @unique` + guarda por `Order.status`. Total **siempre recalculado en server**.

**Tech Stack:** Next.js 15 (App Router, RSC + Server Actions) · React 19 · TypeScript strict · Prisma 6 + `@prisma/adapter-pg` (Supabase Postgres) · Mercado Pago Checkout Pro (REST vía `fetch`) · Resend (REST vía `fetch`) · Web Crypto · shadcn/ui (Sheet, RadioGroup) · Vitest (unit + integration) · Playwright (e2e) · pnpm.

**Rama:** `m2-checkout` (worktree aislado en `C:/Users/Lazar/Documents/glamify-m2`, off `main` que ya tiene M0+M1). `.env.local` ya copiado.

---

## Convenciones (CLAUDE.md + blueprints 01/04/05/07 + design spec aprobado)

- TypeScript strict, **nunca `any`**. `pnpm typecheck` después de cada cambio.
- **Dinero:** ARS, DB `Decimal(12,2)`; cálculo con `number` + `round2(n)` en cada total. NO centavos-enteros, NO float sin redondear. Reusar `toNumber` (pricing.ts), `round2`/`formatARS`/`parseDecimal` (money.ts).
- **Server Actions** para mutaciones (carrito/cupón/envío/checkout). **Route Handler** solo para el webhook MP.
- Queries a DB solo desde Server Components / Server Actions / servicios `server-only`.
- Enums británicos (`cancelled`). UUID PK. Timestamps UTC.
- **Total recalculado en server**; nunca confiar en montos del cliente (blueprint 04 §7).
- Secrets solo de env; nunca en cliente ni git.
- **DRY:** reusar libs de catálogo de M1 (`getEffectivePrice`, `getStockState`, types `CatalogProduct`/`CatalogVariant`, `Sheet`, `VariantSwatchSelector`, `QuantityStepper`, `prisma`).
- Commits frecuentes (uno por task). Mensaje `feat(m2): …` / `test(m2): …` / `chore(m2): …`, con trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Excluido (diferido, del design spec §2)

Login de clientas / Google OAuth; API real de MiCorreo (M5; el seam env-gated queda listo y devuelve `null` → fallback a zonas); cron Cloudflare de autocancelación 24h (la lógica `lib/orders/expiry.ts` + script quedan listos, el trigger es M4); `perCustomerLimit` de cupones (requiere cuentas); reembolsos por API (manual por WhatsApp); UI de "agregar combo al carrito" (no hay página `/combos` en M1 — el soporte de combos vive en las libs + seed + tests, sin UI de alta).

---

## File Structure

```
src/lib/
  money.ts                         # (MOD) + round2()
  cart/
    types.ts                       # (NEW) CartLine — shape puro para cálculos
    totals.ts                      # (NEW) lineTotal, cartSubtotal, cartItemCount
    cart-service.ts                # (NEW, server-only) cookie + CRUD carrito + map a CartLine
  coupons/
    apply.ts                       # (NEW) validateCoupon, applyCoupon
  shipping/
    quote.ts                       # (NEW) orderWeightGr, matchZone, isFreeShipping, methodFactor
    correo.ts                      # (NEW) provider MiCorreo env-gated (→ null si no configurado)
    index.ts                       # (NEW, server-only) quoteShipping orquestador
  orders/
    state-machine.ts               # (NEW) canTransition, orderStatusForPayment
    stock.ts                       # (NEW) computeStockDecrements, checkAvailability
    order-number.ts                # (NEW) formatOrderNumber
    expiry.ts                      # (NEW) findExpiredOrderIds (lógica autocancel 24h; trigger M4)
    checkout-service.ts            # (NEW, server-only) createCheckout (tx + preference)
    webhook-service.ts             # (NEW, server-only) processWebhook (verify+getPayment+tx idempotente)
  payments/
    signature.ts                   # (NEW) verifyMpSignature (Web Crypto HMAC-SHA256)
    mercadopago.ts                 # (NEW) createPreference, getPayment, mpStatusToPaymentStatus
    webhook-effects.ts             # (NEW) decideWebhookEffects (decisión pura idempotente)
  email/
    templates.ts                   # (NEW) orderConfirmationEmail, newOrderAlertEmail
    resend.ts                      # (NEW) sendEmail (real si hay key, si no log)
  cart/cart-cookie.ts              # (NEW, server-only) helpers de cookie carrito + cupón
src/app/(storefront)/
  actions.ts                       # (NEW) Server Actions: add/update/remove/coupon/quote/checkout
  carrito/page.tsx                 # (NEW) /carrito
  checkout/page.tsx                # (NEW) /checkout
  checkout/checkout-form.tsx       # (NEW, client) form un paso
  checkout/gracias/page.tsx        # (NEW) /checkout/gracias
  layout.tsx                       # (MOD) envolver con CartProvider + montar CartDrawer
  producto/[slug]/page.tsx         # (MOD) reemplazar botón disabled por <AddToCart/>
src/app/api/webhooks/mercadopago/route.ts   # (NEW) POST webhook MP
src/components/cart/
  cart-provider.tsx                # (NEW, client) contexto open/close del drawer
  cart-button.tsx                  # (NEW, client) ícono carrito + badge (abre drawer)
  cart-drawer.tsx                  # (NEW, client) Sheet con contenido del carrito (server children)
  cart-contents.tsx                # (NEW, server) líneas + resumen para drawer
  cart-line-item.tsx               # (NEW, client) línea con stepper + remove
  free-shipping-bar.tsx            # (NEW) barra de progreso envío gratis
  coupon-input.tsx                 # (NEW, client) input cupón → action
  cart-summary.tsx                 # (NEW) subtotal/descuento/envío/total
  add-to-cart.tsx                  # (NEW, client) selector variante + qty + agregar (ficha)
  empty-cart.tsx                   # (NEW) estado vacío
src/components/ui/radio-group.tsx  # (NEW) shadcn RadioGroup
src/components/layout/site-header.tsx  # (MOD) montar <CartButton/>
src/components/layout/bottom-nav.tsx   # (MOD) habilitar Carrito → abre drawer
prisma/
  schema.prisma                    # (MOD) Coupon.scopeId
  migrations/<ts>_m2_coupon_scope_and_order_seq/migration.sql  # (NEW) scopeId + order_number_seq
  seed.ts                          # (MOD) + coupons, shipping zones, setting, 1 combo
scripts/simulate-mp-webhook.ts     # (NEW) ejercita path approved real contra dev DB (idempotente 2×)
tests/unit/...                     # (NEW) cada lib pura
tests/integration/...              # (NEW) checkout-service, webhook-service con deps fake
tests/e2e/checkout.spec.ts         # (NEW) catálogo→agregar→drawer→checkout→init_point
vitest.config.ts                   # (MOD) include unit + integration
.env.example                       # (MOD) MP_WEBHOOK_SECRET, RESEND_API_KEY, NEXT_PUBLIC_APP_URL, MICORREO_*
wrangler.jsonc                     # (MOD) [vars] NEXT_PUBLIC_APP_URL (secrets por wrangler secret)
```

**Responsabilidad por archivo:** libs puras = una función-familia por archivo, sin DB ni red (unit). Servicios `server-only` = orquestan DB + libs + IO con `deps` inyectables (integration con fakes). UI = componentes chicos y enfocados; client solo donde hay interacción. Cookie helpers aislados.

---

## Orden de ejecución (fases)

- **Fase 0 — Setup:** deps, env, vitest include, migración (scopeId + secuencia), seed extendido. (Tasks 0–4)
- **Fase 1 — Libs puras (unit TDD):** money.round2, cart/totals, coupons, shipping/quote, orders (state-machine, stock, order-number, expiry), payments (signature, webhook-effects), email/templates. (Tasks 5–14)
- **Fase 2 — Libs IO:** mercadopago, resend, shipping/correo+index. (Tasks 15–17)
- **Fase 3 — Servicios + actions + webhook route:** cart-service, checkout-service, webhook-service, actions, route. (Tasks 18–22)
- **Fase 4 — UI:** radio-group, cart provider/drawer/badge/contents, add-to-cart (ficha), /carrito, /checkout, /checkout/gracias, wiring header/bottom-nav. (Tasks 23–31)
- **Fase 5 — Integración, simulación, e2e, verificación:** integration tests, simulate-mp-webhook, e2e, env/wrangler/docs, verificación DoD + commit final. (Tasks 32–37)

Cada lib pura puede ejecutarse en paralelo (sin dependencias entre sí salvo `cart/types.ts`, que va primero). Servicios dependen de las libs. UI depende de actions. Integración/e2e al final.

## FASE 0 — Setup

### Task 0: Dependencia RadioGroup (shadcn)

**Files:** Modify: `package.json` (vía pnpm).

- [ ] **Step 1: Instalar el primitivo Radix del RadioGroup** (el componente shadcn se agrega en Task 23).

Run: `pnpm add @radix-ui/react-radio-group@^1.2.3`
Expected: agrega la dep, actualiza `pnpm-lock.yaml`, sin errores.

- [ ] **Step 2: Verificar typecheck sigue verde**

Run: `pnpm typecheck`
Expected: sin errores (no se usó la dep todavía).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(m2): add @radix-ui/react-radio-group for shipping selector"
```

---

### Task 1: vitest incluye unit + integration

**Files:** Modify: `vitest.config.ts`.

- [ ] **Step 1: Ampliar `include`**

Reemplazar la línea `include: ["tests/unit/**/*.test.ts"],` por:
```ts
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
```

- [ ] **Step 2: Verificar que la suite actual sigue corriendo**

Run: `pnpm test`
Expected: PASS — los tests de M1 (`money`, `sku`, `catalog/*`) siguen verdes (aún no hay integration).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore(m2): vitest include integration tests dir"
```

---

### Task 2: Variables de entorno (example + wrangler)

**Files:** Modify: `.env.example`, `wrangler.jsonc`. (`.env.local` real lo completa el usuario; ya tiene MP_ACCESS_TOKEN + NEXT_PUBLIC_MP_PUBLIC_KEY.)

- [ ] **Step 1: Agregar a `.env.example` (debajo del bloque Mercado Pago)**

```bash
# Mercado Pago (M2)
MP_ACCESS_TOKEN=
NEXT_PUBLIC_MP_PUBLIC_KEY=
# Secret del webhook (dashboard MP → Webhooks → clave secreta). Verifica x-signature.
MP_WEBHOOK_SECRET=

# URL pública de la app (para back_urls y notification_url de MP).
# Local: http://localhost:3000 (el webhook real necesita túnel/preview; ver scripts/simulate-mp-webhook.ts).
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Resend (M2/M5) — sin key, los emails se loguean a consola en dev.
RESEND_API_KEY=
RESEND_FROM="Glamify Makeup <pedidos@glamifymakeup.site>"
RESEND_OWNER_EMAIL=

# MiCorreo / Correo Argentino (diferido a M5; sin estas vars → fallback a zonas)
MICORREO_USER=
MICORREO_PASSWORD=
MICORREO_AGREEMENT=
```

- [ ] **Step 2: Agregar `NEXT_PUBLIC_APP_URL` a `wrangler.jsonc`** (var pública; los secrets van por `wrangler secret put`). Insertar antes de `"observability"`:

```jsonc
  "vars": {
    "NEXT_PUBLIC_APP_URL": "http://localhost:3000",
  },
```

- [ ] **Step 3: Asegurar que `.env.local` local tenga las nuevas keys** (sin valores reales salvo MP). Editar `.env.local` agregando las líneas faltantes (`MP_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `RESEND_*`, `MICORREO_*`) con vacío donde no haya credencial. **MP_WEBHOOK_SECRET:** para la simulación local sirve cualquier valor (ej. `dev_webhook_secret`); para el sandbox real, el del dashboard MP.

> No se commitea `.env.local` (gitignored). `.env.example` y `wrangler.jsonc` sí.

- [ ] **Step 4: Commit**

```bash
git add .env.example wrangler.jsonc
git commit -m "chore(m2): env vars for MP webhook, Resend, app URL, MiCorreo"
```

---

### Task 3: Migración — `Coupon.scopeId` + secuencia `order_number_seq`

**Files:** Modify: `prisma/schema.prisma`. Create: `prisma/migrations/<ts>_m2_coupon_scope_and_order_seq/migration.sql`.

> **Por qué `scopeId`:** el modelo `Coupon` (blueprint 01) tiene `scope (all|category|product)` pero **sin id de destino** → un cupón scope=category/product no sabe a qué apunta. Se agrega `scopeId` (nullable) para que `applyCoupon` pueda limitar el descuento. Cambio aditivo, no rompe datos.

- [ ] **Step 1: Agregar campo a `model Coupon`** en `schema.prisma` (después de `scope`):

```prisma
  scope            CouponScope @default(all)
  scopeId          String?     @db.Uuid // categoryId o productId según `scope` (null si scope=all)
```

- [ ] **Step 2: Generar la migración SIN aplicar (solo el diff de `scopeId`)**

Run: `pnpm prisma migrate dev --name m2_coupon_scope_and_order_seq --create-only`
Expected: crea `prisma/migrations/<ts>_m2_coupon_scope_and_order_seq/migration.sql` con `ALTER TABLE "Coupon" ADD COLUMN "scopeId" UUID;` (no aplica todavía).

- [ ] **Step 3: Agregar la secuencia al final de ese `migration.sql`**

Append al archivo generado:
```sql

-- Secuencia para orderNumber humano (GLM-000123). Se consume con nextval() dentro de la tx de checkout.
CREATE SEQUENCE IF NOT EXISTS order_number_seq AS bigint START WITH 1 INCREMENT BY 1;
```

- [ ] **Step 4: Aplicar la migración contra Supabase**

Run: `pnpm prisma migrate dev`
Expected: aplica la migración pendiente; imprime `Your database is now in sync with your schema.` y crea la secuencia. (Escribe en la DB real de Supabase — autorizado, igual que M0/M1.)

- [ ] **Step 5: Regenerar el cliente y typecheck**

Run: `pnpm prisma generate && pnpm typecheck`
Expected: cliente regenerado con `Coupon.scopeId`; typecheck verde.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(m2): migration — Coupon.scopeId + order_number_seq sequence"
```

---

### Task 4: Extender el seed (cupones, zonas, ajustes, 1 combo)

**Files:** Modify: `prisma/seed.ts`.

El seed de M1 solo carga categorías + productos + variantes. M2 necesita: cupones (para probar `applyCoupon`), `ShippingZone`s (fallback de envío), `Setting` (umbral envío gratis + CP origen), y un `Combo` (para ejercitar el path de combos en libs/tests).

- [ ] **Step 1: Agregar al final de `seed.ts`, antes de `async function main`, las funciones de seed M2:**

```ts
// ---- M2: cupones, zonas de envío, ajustes, combo ----

async function upsertSettings(): Promise<void> {
  await prisma.setting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      storeName: "Glamify Makeup",
      freeShippingThreshold: 47500,
      originPostalCode: "6700",
      whatsappNumber: "5491100000000",
      instagramUrl: "https://instagram.com/glamifymakeup",
    },
  });
}

interface SeedZone {
  name: string;
  matchType: "province" | "cpRange";
  provinces?: string[];
  cpFrom?: string;
  cpTo?: string;
  price: number;
  order: number;
}
const ZONES: SeedZone[] = [
  { name: "AMBA (CABA + GBA)", matchType: "cpRange", cpFrom: "1000", cpTo: "1900", price: 2500, order: 0 },
  { name: "Buenos Aires interior", matchType: "province", provinces: ["Buenos Aires"], price: 3800, order: 1 },
  { name: "Centro (Córdoba, Santa Fe, Entre Ríos)", matchType: "province", provinces: ["Córdoba", "Santa Fe", "Entre Ríos"], price: 4500, order: 2 },
  { name: "Resto del país", matchType: "cpRange", cpFrom: "0", cpTo: "9999", price: 6200, order: 3 },
];

async function upsertZones(): Promise<void> {
  // ShippingZone no tiene unique natural; limpiamos y recreamos (idempotente para dev).
  await prisma.shippingZone.deleteMany({});
  for (const z of ZONES) {
    await prisma.shippingZone.create({
      data: {
        name: z.name, matchType: z.matchType, provinces: z.provinces ?? [],
        cpFrom: z.cpFrom ?? null, cpTo: z.cpTo ?? null, price: z.price, order: z.order, active: true,
      },
    });
  }
}

interface SeedCoupon {
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: number;
  scope?: "all" | "category" | "product";
  minSubtotal?: number;
  maxUses?: number;
}
const COUPONS: SeedCoupon[] = [
  { code: "GLAM10", type: "percentage", value: 10, scope: "all" },
  { code: "BIENVENIDA", type: "fixed", value: 1000, scope: "all", minSubtotal: 5000 },
  { code: "ENVIOGRATIS", type: "free_shipping", value: 0, scope: "all" },
];

async function upsertCoupons(): Promise<void> {
  for (const c of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { type: c.type, value: c.value, scope: c.scope ?? "all", minSubtotal: c.minSubtotal ?? null, maxUses: c.maxUses ?? null, active: true },
      create: { code: c.code, type: c.type, value: c.value, scope: c.scope ?? "all", minSubtotal: c.minSubtotal ?? null, maxUses: c.maxUses ?? null },
    });
  }
}

async function upsertCombo(): Promise<void> {
  // Combo "Dúo Labios Glam": 1 labial mate + 1 gloss. Descuenta stock de sus componentes al pagarse.
  const labial = await prisma.productVariant.findFirst({ where: { product: { slug: "labial-mate-larga-duracion" }, stock: { gt: 0 } }, orderBy: { order: "asc" } });
  const gloss = await prisma.productVariant.findFirst({ where: { product: { slug: "gloss-brillo-humedo" }, stock: { gt: 0 } }, orderBy: { order: "asc" } });
  if (!labial || !gloss) { console.warn("⚠️  Combo no creado: faltan variantes con stock."); return; }
  const combo = await prisma.combo.upsert({
    where: { slug: "duo-labios-glam" },
    update: { name: "Dúo Labios Glam", description: "Labial mate + gloss a precio especial.", comboPrice: 4990, active: true },
    create: { slug: "duo-labios-glam", name: "Dúo Labios Glam", description: "Labial mate + gloss a precio especial.", comboPrice: 4990, images: [] },
  });
  await prisma.comboItem.deleteMany({ where: { comboId: combo.id } });
  await prisma.comboItem.createMany({ data: [{ comboId: combo.id, variantId: labial.id, qty: 1 }, { comboId: combo.id, variantId: gloss.id, qty: 1 }] });
}
```

- [ ] **Step 2: Llamar las nuevas funciones en `main()`** (después de `await upsertProducts(idBySlug);`):

```ts
  await upsertProducts(idBySlug);
  await upsertSettings();
  await upsertZones();
  await upsertCoupons();
  await upsertCombo();
  const [cats, prods, vars, coups, zones] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.coupon.count(),
    prisma.shippingZone.count(),
  ]);
  console.log(`✅ Seed listo: ${cats} categorías, ${prods} productos, ${vars} variantes, ${coups} cupones, ${zones} zonas.`);
```

(Reemplaza el bloque `const [cats, prods, vars] = …` y su `console.log` por lo de arriba.)

- [ ] **Step 3: Correr el seed contra la DB**

Run: `pnpm db:seed`
Expected: imprime el conteo con cupones y zonas > 0; sin errores.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(m2): seed coupons, shipping zones, settings, demo combo"
```

## FASE 1 — Libs puras (unit TDD)

### Task 5: `money.round2`

**Files:** Modify: `src/lib/money.ts`. Test: `tests/unit/money.test.ts` (extender).

- [ ] **Step 1: Agregar tests al final de `tests/unit/money.test.ts`**

```ts
import { round2 } from "@/lib/money";

describe("round2", () => {
  it("redondea a 2 decimales (half-up)", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(2500)).toBe(2500);
  });
  it("acepta strings", () => {
    expect(round2("3.999")).toBe(4);
  });
  it("evita drift de punto flotante", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(3200 * 1.1)).toBe(3520);
  });
  it("rechaza no-finitos", () => {
    expect(() => round2("abc")).toThrow();
  });
});
```

Y agregar el import de `round2` al import existente de `@/lib/money` (mergear: `import { formatARS, parseDecimal, round2 } from "@/lib/money";`).

- [ ] **Step 2: Run → FALLA**

Run: `pnpm vitest run tests/unit/money.test.ts`
Expected: FAIL — `round2 is not a function` / export no existe.

- [ ] **Step 3: Implementar en `src/lib/money.ts`** (agregar export):

```ts
/** Redondea a 2 decimales (half-up), corrigiendo el drift de float. Acepta string/number. */
export function round2(value: number | string): number {
  const n = parseDecimal(value);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
```

- [ ] **Step 4: Run → PASA**

Run: `pnpm vitest run tests/unit/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts tests/unit/money.test.ts
git commit -m "feat(m2): money.round2 with float-drift correction (TDD)"
```

---

### Task 6: `cart/types.ts` + `cart/totals.ts`

**Files:** Create: `src/lib/cart/types.ts`, `src/lib/cart/totals.ts`. Test: `tests/unit/cart/totals.test.ts`.

`CartLine` es el shape PURO (números resueltos) que alimenta totales, cupones, envío (peso) y stock. Definir primero — varias libs lo importan.

- [ ] **Step 1: Crear `src/lib/cart/types.ts`** (sin lógica, no necesita test propio):

```ts
/**
 * Línea de carrito "resuelta" a números para cálculos puros (sin DB ni red).
 * - variante: `refId` = variantId; `components` undefined.
 * - combo: `refId` = comboId; `components` = variantes a descontar (qty por unidad de combo).
 */
export interface CartLine {
  /** id de la línea (cartItemId en runtime; arbitrario en tests). */
  id: string;
  kind: "variant" | "combo";
  refId: string;
  /** Precio unitario efectivo en ARS (variante: priceOverride??basePrice; combo: comboPrice). */
  unitPrice: number;
  qty: number;
  /** Peso unitario en gramos (para cotizar envío). */
  weightGr: number;
  /** Metadata para cupones scope product/category (solo variantes; null en combos). */
  productId?: string | null;
  categoryId?: string | null;
  /** Solo combos: componentes para descuento de stock. */
  components?: Array<{ variantId: string; qty: number }>;
}
```

- [ ] **Step 2: Escribir `tests/unit/cart/totals.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { lineTotal, cartSubtotal, cartItemCount } from "@/lib/cart/totals";
import type { CartLine } from "@/lib/cart/types";

const variant = (over: Partial<CartLine> = {}): CartLine => ({
  id: "l1", kind: "variant", refId: "v1", unitPrice: 3200, qty: 1, weightGr: 25, ...over,
});

describe("lineTotal", () => {
  it("multiplica precio × cantidad redondeado a 2", () => {
    expect(lineTotal(variant({ unitPrice: 3200, qty: 3 }))).toBe(9600);
    expect(lineTotal(variant({ unitPrice: 2990, qty: 2 }))).toBe(5980);
  });
});

describe("cartSubtotal", () => {
  it("suma los totales de línea", () => {
    const lines = [variant({ unitPrice: 3200, qty: 2 }), variant({ id: "l2", unitPrice: 2500, qty: 1 })];
    expect(cartSubtotal(lines)).toBe(8900);
  });
  it("carrito vacío = 0", () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe("cartItemCount", () => {
  it("suma las cantidades", () => {
    expect(cartItemCount([variant({ qty: 2 }), variant({ id: "l2", qty: 3 })])).toBe(5);
  });
});
```

- [ ] **Step 3: Run → FALLA**

Run: `pnpm vitest run tests/unit/cart/totals.test.ts`
Expected: FAIL — import no resuelve.

- [ ] **Step 4: Implementar `src/lib/cart/totals.ts`**

```ts
import { round2 } from "@/lib/money";
import type { CartLine } from "@/lib/cart/types";

/** Total de una línea: precio unitario × cantidad, redondeado a 2 decimales. */
export function lineTotal(line: CartLine): number {
  return round2(line.unitPrice * line.qty);
}

/** Subtotal del carrito: suma de los totales de línea. */
export function cartSubtotal(lines: CartLine[]): number {
  return round2(lines.reduce((acc, l) => acc + lineTotal(l), 0));
}

/** Cantidad total de ítems (para el badge del carrito). */
export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((acc, l) => acc + l.qty, 0);
}
```

- [ ] **Step 5: Run → PASA**

Run: `pnpm vitest run tests/unit/cart/totals.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cart/types.ts src/lib/cart/totals.ts tests/unit/cart/totals.test.ts
git commit -m "feat(m2): CartLine type + cart totals (TDD)"
```

---

### Task 7: `coupons/apply.ts`

**Files:** Create: `src/lib/coupons/apply.ts`. Test: `tests/unit/coupons/apply.test.ts`.

Reglas (blueprint 04 §5 + 01): `validateCoupon` chequea `active`, ventana `validFrom/validTo`, `minSubtotal`, `maxUses` vs `usedCount`. `applyCoupon` calcula descuento según `type` × `scope`: `percentage`/`fixed` sobre el subtotal de las líneas que matchean el scope; `free_shipping` → `freeShipping:true`, descuento 0. Descuento nunca mayor al subtotal aplicable.

- [ ] **Step 1: Escribir `tests/unit/coupons/apply.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateCoupon, applyCoupon, type ValidatableCoupon, type ApplicableCoupon } from "@/lib/coupons/apply";
import type { CartLine } from "@/lib/cart/types";

const baseCoupon = (over: Partial<ValidatableCoupon> = {}): ValidatableCoupon => ({
  active: true, minSubtotal: null, validFrom: null, validTo: null, maxUses: null, usedCount: 0, ...over,
});
const NOW = new Date("2026-06-04T12:00:00Z");

const line = (over: Partial<CartLine> = {}): CartLine => ({
  id: "l1", kind: "variant", refId: "v1", unitPrice: 1000, qty: 1, weightGr: 25, productId: "p1", categoryId: "c1", ...over,
});

describe("validateCoupon", () => {
  it("acepta un cupón activo sin restricciones", () => {
    expect(validateCoupon(baseCoupon(), { subtotal: 5000, now: NOW })).toEqual({ ok: true });
  });
  it("rechaza inactivo", () => {
    expect(validateCoupon(baseCoupon({ active: false }), { subtotal: 5000, now: NOW }).ok).toBe(false);
  });
  it("rechaza fuera de ventana de validez", () => {
    expect(validateCoupon(baseCoupon({ validFrom: new Date("2026-07-01T00:00:00Z") }), { subtotal: 5000, now: NOW }).ok).toBe(false);
    expect(validateCoupon(baseCoupon({ validTo: new Date("2026-05-01T00:00:00Z") }), { subtotal: 5000, now: NOW }).ok).toBe(false);
  });
  it("rechaza si subtotal < minSubtotal", () => {
    expect(validateCoupon(baseCoupon({ minSubtotal: 5000 }), { subtotal: 4999, now: NOW }).ok).toBe(false);
    expect(validateCoupon(baseCoupon({ minSubtotal: 5000 }), { subtotal: 5000, now: NOW }).ok).toBe(true);
  });
  it("rechaza si se agotaron los usos", () => {
    expect(validateCoupon(baseCoupon({ maxUses: 10, usedCount: 10 }), { subtotal: 5000, now: NOW }).ok).toBe(false);
  });
});

describe("applyCoupon", () => {
  const pct = (over: Partial<ApplicableCoupon> = {}): ApplicableCoupon => ({ type: "percentage", value: 10, scope: "all", scopeId: null, ...over });

  it("percentage scope=all sobre todo el subtotal", () => {
    const lines = [line({ unitPrice: 1000, qty: 2 }), line({ id: "l2", unitPrice: 3000, qty: 1 })]; // subtotal 5000
    expect(applyCoupon(pct({ value: 10 }), lines)).toEqual({ discount: 500, freeShipping: false });
  });
  it("fixed scope=all, capeado al subtotal", () => {
    const lines = [line({ unitPrice: 1000, qty: 1 })]; // 1000
    expect(applyCoupon(pct({ type: "fixed", value: 1500 }), lines)).toEqual({ discount: 1000, freeShipping: false });
  });
  it("free_shipping → freeShipping true, sin descuento", () => {
    const lines = [line({ unitPrice: 1000, qty: 1 })];
    expect(applyCoupon(pct({ type: "free_shipping", value: 0 }), lines)).toEqual({ discount: 0, freeShipping: true });
  });
  it("scope=category solo descuenta líneas de esa categoría", () => {
    const lines = [line({ categoryId: "c1", unitPrice: 2000, qty: 1 }), line({ id: "l2", categoryId: "c2", unitPrice: 2000, qty: 1 })];
    expect(applyCoupon(pct({ value: 10, scope: "category", scopeId: "c1" }), lines)).toEqual({ discount: 200, freeShipping: false });
  });
  it("scope=product solo descuenta ese producto", () => {
    const lines = [line({ productId: "p1", unitPrice: 2000, qty: 1 }), line({ id: "l2", productId: "p2", unitPrice: 2000, qty: 1 })];
    expect(applyCoupon(pct({ value: 50, scope: "product", scopeId: "p1" }), lines)).toEqual({ discount: 1000, freeShipping: false });
  });
  it("combos solo matchean scope=all (sin product/category)", () => {
    const lines = [line({ kind: "combo", refId: "combo1", productId: null, categoryId: null, unitPrice: 4990, qty: 1 })];
    expect(applyCoupon(pct({ value: 10, scope: "category", scopeId: "c1" }), lines)).toEqual({ discount: 0, freeShipping: false });
    expect(applyCoupon(pct({ value: 10, scope: "all" }), lines)).toEqual({ discount: 499, freeShipping: false });
  });
});
```

- [ ] **Step 2: Run → FALLA**

Run: `pnpm vitest run tests/unit/coupons/apply.test.ts`
Expected: FAIL — import no resuelve.

- [ ] **Step 3: Implementar `src/lib/coupons/apply.ts`**

```ts
import { round2 } from "@/lib/money";
import { lineTotal } from "@/lib/cart/totals";
import type { CartLine } from "@/lib/cart/types";

/** Subconjunto de Coupon necesario para validar (compatible con el modelo Prisma). */
export interface ValidatableCoupon {
  active: boolean;
  minSubtotal: number | string | null;
  validFrom: Date | null;
  validTo: Date | null;
  maxUses: number | null;
  usedCount: number;
}
export interface CouponContext {
  subtotal: number;
  now: Date;
}
export type CouponValidation = { ok: true } | { ok: false; reason: string };

export function validateCoupon(coupon: ValidatableCoupon, ctx: CouponContext): CouponValidation {
  if (!coupon.active) return { ok: false, reason: "El cupón no está activo." };
  if (coupon.validFrom && ctx.now < coupon.validFrom) return { ok: false, reason: "El cupón todavía no es válido." };
  if (coupon.validTo && ctx.now > coupon.validTo) return { ok: false, reason: "El cupón está vencido." };
  if (coupon.minSubtotal != null && ctx.subtotal < Number(coupon.minSubtotal)) {
    return { ok: false, reason: "No alcanzás el mínimo para este cupón." };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: "El cupón alcanzó su límite de usos." };
  }
  return { ok: true };
}

/** Subconjunto de Coupon necesario para aplicar el descuento. */
export interface ApplicableCoupon {
  type: "percentage" | "fixed" | "free_shipping";
  value: number | string;
  scope: "all" | "category" | "product";
  scopeId: string | null;
}
export interface CouponResult {
  discount: number;
  freeShipping: boolean;
}

function matchesScope(line: CartLine, scope: ApplicableCoupon["scope"], scopeId: string | null): boolean {
  if (scope === "all") return true;
  if (line.kind === "combo") return false; // combos solo aplican a scope=all
  if (scope === "category") return line.categoryId === scopeId;
  if (scope === "product") return line.productId === scopeId;
  return false;
}

export function applyCoupon(coupon: ApplicableCoupon, lines: CartLine[]): CouponResult {
  if (coupon.type === "free_shipping") return { discount: 0, freeShipping: true };

  const applicable = lines.filter((l) => matchesScope(l, coupon.scope, coupon.scopeId));
  const base = round2(applicable.reduce((acc, l) => acc + lineTotal(l), 0));
  if (base <= 0) return { discount: 0, freeShipping: false };

  const value = Number(coupon.value);
  const raw = coupon.type === "percentage" ? base * (value / 100) : value;
  const discount = round2(Math.min(Math.max(raw, 0), base));
  return { discount, freeShipping: false };
}
```

- [ ] **Step 4: Run → PASA**

Run: `pnpm vitest run tests/unit/coupons/apply.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/coupons/apply.ts tests/unit/coupons/apply.test.ts
git commit -m "feat(m2): coupon validate + apply (percentage/fixed/free_shipping × scope) (TDD)"
```

---

### Task 8: `shipping/quote.ts`

**Files:** Create: `src/lib/shipping/quote.ts`. Test: `tests/unit/shipping/quote.test.ts`.

`orderWeightGr` (con default si falta peso), `matchZone` (province / cpRange, primer match por `order`), `isFreeShipping(subtotal, threshold)`, `methodFactor` (sucursal más barata).

- [ ] **Step 1: Escribir `tests/unit/shipping/quote.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { orderWeightGr, matchZone, isFreeShipping, methodFactor, type Zone } from "@/lib/shipping/quote";
import type { CartLine } from "@/lib/cart/types";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  id: "l1", kind: "variant", refId: "v1", unitPrice: 1000, qty: 1, weightGr: 50, ...over,
});

describe("orderWeightGr", () => {
  it("suma peso × cantidad", () => {
    expect(orderWeightGr([line({ weightGr: 25, qty: 2 }), line({ id: "l2", weightGr: 120, qty: 1 })])).toBe(170);
  });
  it("usa default 50g si la línea no tiene peso", () => {
    expect(orderWeightGr([line({ weightGr: 0, qty: 1 })])).toBe(50);
  });
  it("carrito vacío → default 50g (nunca 0)", () => {
    expect(orderWeightGr([])).toBe(50);
  });
});

const zones: Zone[] = [
  { id: "z-amba", matchType: "cpRange", provinces: [], cpFrom: "1000", cpTo: "1900", price: 2500, active: true, order: 0 },
  { id: "z-ba", matchType: "province", provinces: ["Buenos Aires"], cpFrom: null, cpTo: null, price: 3800, active: true, order: 1 },
  { id: "z-resto", matchType: "cpRange", provinces: [], cpFrom: "0", cpTo: "9999", price: 6200, active: true, order: 3 },
];

describe("matchZone", () => {
  it("matchea por rango de CP (primer match por order)", () => {
    expect(matchZone(zones, { cp: "1414", province: "CABA" })?.id).toBe("z-amba");
  });
  it("matchea por provincia si el CP no entra en un rango anterior", () => {
    expect(matchZone(zones, { cp: "7000", province: "Buenos Aires" })?.id).toBe("z-ba");
  });
  it("cae al rango catch-all", () => {
    expect(matchZone(zones, { cp: "5000", province: "Córdoba" })?.id).toBe("z-resto");
  });
  it("ignora zonas inactivas", () => {
    const inactive: Zone[] = [{ ...zones[0], active: false }];
    expect(matchZone(inactive, { cp: "1414", province: "CABA" })).toBeNull();
  });
  it("null si nada matchea", () => {
    expect(matchZone([zones[1]], { cp: "1414", province: "CABA" })).toBeNull();
  });
});

describe("isFreeShipping", () => {
  it("true si subtotal ≥ umbral", () => {
    expect(isFreeShipping(47500, 47500)).toBe(true);
    expect(isFreeShipping(50000, 47500)).toBe(true);
    expect(isFreeShipping(47499, 47500)).toBe(false);
  });
  it("umbral 0 → nunca gratis por umbral", () => {
    expect(isFreeShipping(100, 0)).toBe(false);
  });
});

describe("methodFactor", () => {
  it("sucursal es más barata que domicilio", () => {
    expect(methodFactor("domicilio")).toBe(1);
    expect(methodFactor("sucursal")).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run → FALLA**

Run: `pnpm vitest run tests/unit/shipping/quote.test.ts`
Expected: FAIL — import no resuelve.

- [ ] **Step 3: Implementar `src/lib/shipping/quote.ts`**

```ts
import type { CartLine } from "@/lib/cart/types";

export const DEFAULT_WEIGHT_GR = 50;

/** Peso total del pedido en gramos (default sensato si falta; maquillaje liviano). Nunca 0. */
export function orderWeightGr(lines: CartLine[]): number {
  const total = lines.reduce((acc, l) => acc + (l.weightGr > 0 ? l.weightGr : DEFAULT_WEIGHT_GR) * l.qty, 0);
  return total > 0 ? total : DEFAULT_WEIGHT_GR;
}

/** Forma mínima de ShippingZone necesaria para el match (compatible con Prisma). */
export interface Zone {
  id: string;
  matchType: "province" | "cpRange";
  provinces: string[];
  cpFrom: string | null;
  cpTo: string | null;
  price: number | string;
  active: boolean;
  order: number;
}
export interface ZoneMatchInput {
  cp: string;
  province?: string | null;
}

function cpInRange(cp: string, from: string | null, to: string | null): boolean {
  const n = parseInt(cp, 10);
  if (Number.isNaN(n) || from == null || to == null) return false;
  return n >= parseInt(from, 10) && n <= parseInt(to, 10);
}

/** Primera zona activa (por `order`) que matchea el CP (cpRange) o la provincia (province). */
export function matchZone(zones: Zone[], input: ZoneMatchInput): Zone | null {
  const candidates = zones.filter((z) => z.active).sort((a, b) => a.order - b.order);
  for (const z of candidates) {
    if (z.matchType === "cpRange" && cpInRange(input.cp, z.cpFrom, z.cpTo)) return z;
    if (z.matchType === "province" && input.province && z.provinces.includes(input.province)) return z;
  }
  return null;
}

/** Envío gratis si el subtotal alcanza el umbral configurable (>0). */
export function isFreeShipping(subtotal: number, threshold: number): boolean {
  return threshold > 0 && subtotal >= threshold;
}

/** Factor de costo por método: sucursal de Correo suele ser más barata que domicilio (blueprint 05 §3). */
export function methodFactor(method: "domicilio" | "sucursal"): number {
  return method === "sucursal" ? 0.85 : 1;
}
```

- [ ] **Step 4: Run → PASA**

Run: `pnpm vitest run tests/unit/shipping/quote.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shipping/quote.ts tests/unit/shipping/quote.test.ts
git commit -m "feat(m2): shipping quote primitives — weight, zone match, free-shipping, method factor (TDD)"
```

### Task 9: `orders/state-machine.ts`

**Files:** Create: `src/lib/orders/state-machine.ts`. Test: `tests/unit/orders/state-machine.test.ts`.

Transiciones (blueprint 04 §3). `orderStatusForPayment`: approved→paid; refunded→refunded; cancelled→cancelled; **rejected → null** (permitir reintento, NO cancelar); pending/in_process → null.

- [ ] **Step 1: Escribir `tests/unit/orders/state-machine.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { canTransition, orderStatusForPayment } from "@/lib/orders/state-machine";

describe("canTransition", () => {
  it("permite el camino feliz", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("paid", "preparing")).toBe(true);
    expect(canTransition("preparing", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });
  it("permite cancelar/reembolsar según el estado", () => {
    expect(canTransition("pending_payment", "cancelled")).toBe(true);
    expect(canTransition("paid", "refunded")).toBe(true);
  });
  it("rechaza saltos inválidos", () => {
    expect(canTransition("pending_payment", "shipped")).toBe(false);
    expect(canTransition("delivered", "paid")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
  });
});

describe("orderStatusForPayment", () => {
  it("mapea el estado de MP al estado de pedido", () => {
    expect(orderStatusForPayment("approved")).toBe("paid");
    expect(orderStatusForPayment("refunded")).toBe("refunded");
    expect(orderStatusForPayment("cancelled")).toBe("cancelled");
  });
  it("rejected/pending/in_process no cambian el pedido (null)", () => {
    expect(orderStatusForPayment("rejected")).toBeNull();
    expect(orderStatusForPayment("pending")).toBeNull();
    expect(orderStatusForPayment("in_process")).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/unit/orders/state-machine.test.ts`

- [ ] **Step 3: Implementar `src/lib/orders/state-machine.ts`**

```ts
import type { OrderStatus, PaymentStatus } from "@prisma/client";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["preparing", "refunded", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

/** ¿Es válida la transición de estado de pedido? (blueprint 04 §3) */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Estado de pedido derivado del estado de pago de MP. `null` = no cambiar el pedido.
 * rejected NO cancela (se permite reintento); el autocancel a 24h lo maneja expiry.ts.
 */
export function orderStatusForPayment(mp: PaymentStatus): OrderStatus | null {
  switch (mp) {
    case "approved": return "paid";
    case "refunded": return "refunded";
    case "cancelled": return "cancelled";
    default: return null; // pending, in_process, rejected
  }
}
```

- [ ] **Step 4: Run → PASA.** Run: `pnpm vitest run tests/unit/orders/state-machine.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/state-machine.ts tests/unit/orders/state-machine.test.ts
git commit -m "feat(m2): order state machine + payment→order status mapping (TDD)"
```

---

### Task 10: `orders/stock.ts`

**Files:** Create: `src/lib/orders/stock.ts`. Test: `tests/unit/orders/stock.test.ts`.

`computeStockDecrements(lines)` → `Map<variantId, qty>` (variantes directas + combos expandidos a componentes). `checkAvailability(decrements, currentStock)` → ok + faltantes.

- [ ] **Step 1: Escribir `tests/unit/orders/stock.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computeStockDecrements, checkAvailability } from "@/lib/orders/stock";
import type { CartLine } from "@/lib/cart/types";

const v = (refId: string, qty: number): CartLine => ({ id: refId, kind: "variant", refId, unitPrice: 1000, qty, weightGr: 25 });
const combo = (qty: number, components: Array<{ variantId: string; qty: number }>): CartLine => ({ id: "combo1", kind: "combo", refId: "combo1", unitPrice: 4990, qty, weightGr: 47, components });

describe("computeStockDecrements", () => {
  it("acumula variantes directas", () => {
    const m = computeStockDecrements([v("a", 2), v("b", 1), v("a", 3)]);
    expect(m.get("a")).toBe(5);
    expect(m.get("b")).toBe(1);
  });
  it("expande combos a componentes (qty de combo × qty de componente)", () => {
    const m = computeStockDecrements([combo(2, [{ variantId: "a", qty: 1 }, { variantId: "b", qty: 3 }])]);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBe(6);
  });
  it("suma variantes directas + las de combos", () => {
    const m = computeStockDecrements([v("a", 1), combo(1, [{ variantId: "a", qty: 2 }])]);
    expect(m.get("a")).toBe(3);
  });
});

describe("checkAvailability", () => {
  it("ok cuando hay stock suficiente", () => {
    const decr = new Map([["a", 2], ["b", 1]]);
    const cur = new Map([["a", 5], ["b", 1]]);
    expect(checkAvailability(decr, cur)).toEqual({ ok: true, shortages: [] });
  });
  it("reporta faltantes", () => {
    const decr = new Map([["a", 3], ["b", 2]]);
    const cur = new Map([["a", 1], ["b", 2]]);
    const r = checkAvailability(decr, cur);
    expect(r.ok).toBe(false);
    expect(r.shortages).toEqual([{ variantId: "a", needed: 3, available: 1 }]);
  });
  it("variante ausente del stock actual = 0 disponible", () => {
    const r = checkAvailability(new Map([["x", 1]]), new Map());
    expect(r.ok).toBe(false);
    expect(r.shortages[0]).toEqual({ variantId: "x", needed: 1, available: 0 });
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/unit/orders/stock.test.ts`

- [ ] **Step 3: Implementar `src/lib/orders/stock.ts`**

```ts
import type { CartLine } from "@/lib/cart/types";

/** Cantidad a descontar por variante (combos expandidos a sus componentes). */
export function computeStockDecrements(lines: CartLine[]): Map<string, number> {
  const m = new Map<string, number>();
  const add = (variantId: string, qty: number) => m.set(variantId, (m.get(variantId) ?? 0) + qty);
  for (const l of lines) {
    if (l.kind === "variant") add(l.refId, l.qty);
    else for (const c of l.components ?? []) add(c.variantId, c.qty * l.qty);
  }
  return m;
}

export interface Shortage {
  variantId: string;
  needed: number;
  available: number;
}
export interface AvailabilityResult {
  ok: boolean;
  shortages: Shortage[];
}

/** ¿Alcanza el stock actual para los decrementos pedidos? Reporta faltantes (oversell). */
export function checkAvailability(decrements: Map<string, number>, currentStock: Map<string, number>): AvailabilityResult {
  const shortages: Shortage[] = [];
  for (const [variantId, needed] of decrements) {
    const available = currentStock.get(variantId) ?? 0;
    if (available < needed) shortages.push({ variantId, needed, available });
  }
  return { ok: shortages.length === 0, shortages };
}
```

- [ ] **Step 4: Run → PASA.** Run: `pnpm vitest run tests/unit/orders/stock.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/stock.ts tests/unit/orders/stock.test.ts
git commit -m "feat(m2): stock decrements (combo expansion) + availability check (TDD)"
```

---

### Task 11: `orders/order-number.ts` + `orders/expiry.ts`

**Files:** Create: `src/lib/orders/order-number.ts`, `src/lib/orders/expiry.ts`. Test: `tests/unit/orders/order-number.test.ts`, `tests/unit/orders/expiry.test.ts`.

`formatOrderNumber(seq)` → `GLM-000123` (padding 6). `findExpiredOrderIds(orders, now, hours=24)` (lógica de autocancel; el trigger Cloudflare es M4).

- [ ] **Step 1: Escribir `tests/unit/orders/order-number.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { formatOrderNumber } from "@/lib/orders/order-number";

describe("formatOrderNumber", () => {
  it("formatea con prefijo GLM y padding a 6", () => {
    expect(formatOrderNumber(1)).toBe("GLM-000001");
    expect(formatOrderNumber(123)).toBe("GLM-000123");
    expect(formatOrderNumber(1234567)).toBe("GLM-1234567");
  });
  it("rechaza secuencias inválidas", () => {
    expect(() => formatOrderNumber(0)).toThrow();
    expect(() => formatOrderNumber(-1)).toThrow();
    expect(() => formatOrderNumber(1.5)).toThrow();
  });
});
```

- [ ] **Step 2: Escribir `tests/unit/orders/expiry.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { findExpiredOrderIds, type ExpirableOrder } from "@/lib/orders/expiry";

const NOW = new Date("2026-06-04T12:00:00Z");
const order = (id: string, status: ExpirableOrder["status"], hoursAgo: number): ExpirableOrder => ({
  id, status, createdAt: new Date(NOW.getTime() - hoursAgo * 3600_000),
});

describe("findExpiredOrderIds", () => {
  it("solo pending_payment con > 24h", () => {
    const orders = [
      order("a", "pending_payment", 25),
      order("b", "pending_payment", 23),
      order("c", "paid", 48),
    ];
    expect(findExpiredOrderIds(orders, NOW)).toEqual(["a"]);
  });
  it("respeta un umbral configurable", () => {
    expect(findExpiredOrderIds([order("a", "pending_payment", 2)], NOW, 1)).toEqual(["a"]);
  });
});
```

- [ ] **Step 3: Run → FALLAN.** Run: `pnpm vitest run tests/unit/orders/order-number.test.ts tests/unit/orders/expiry.test.ts`

- [ ] **Step 4: Implementar `src/lib/orders/order-number.ts`**

```ts
/** Número de pedido humano (blueprint 01 §2): GLM-000123 (padding mínimo 6). */
export function formatOrderNumber(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Secuencia de pedido inválida: ${seq}`);
  return `GLM-${String(seq).padStart(6, "0")}`;
}
```

- [ ] **Step 5: Implementar `src/lib/orders/expiry.ts`**

```ts
import type { OrderStatus } from "@prisma/client";

export interface ExpirableOrder {
  id: string;
  status: OrderStatus;
  createdAt: Date;
}

/**
 * IDs de pedidos a autocancelar: pending_payment con más de `hours` horas (blueprint 04 §5, D04-2).
 * El trigger (Cloudflare Cron) se cablea en M4; esta lógica + el script quedan listos.
 */
export function findExpiredOrderIds(orders: ExpirableOrder[], now: Date, hours = 24): string[] {
  const cutoff = now.getTime() - hours * 3600_000;
  return orders.filter((o) => o.status === "pending_payment" && o.createdAt.getTime() < cutoff).map((o) => o.id);
}
```

- [ ] **Step 6: Run → PASAN.** Run: `pnpm vitest run tests/unit/orders/order-number.test.ts tests/unit/orders/expiry.test.ts`

- [ ] **Step 7: Commit**

```bash
git add src/lib/orders/order-number.ts src/lib/orders/expiry.ts tests/unit/orders/order-number.test.ts tests/unit/orders/expiry.test.ts
git commit -m "feat(m2): order-number formatting + 24h expiry logic (TDD)"
```

---

### Task 12: `payments/signature.ts` (Web Crypto HMAC-SHA256)

**Files:** Create: `src/lib/payments/signature.ts`. Test: `tests/unit/payments/signature.test.ts`.

Verifica el header `x-signature` de MP (`ts=...,v1=...`). Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. HMAC-SHA256 con `MP_WEBHOOK_SECRET`, comparación constant-time. **Web Crypto** (`crypto.subtle`) → Workers-safe + async. El test calcula el HMAC de referencia con `node:crypto` (implementación independiente → cross-check).

- [ ] **Step 1: Escribir `tests/unit/payments/signature.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMpSignature } from "@/lib/payments/signature";

const SECRET = "test_webhook_secret";
const dataId = "123456789";
const requestId = "req-abc";
const ts = "1717500000";

function validV1(): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", SECRET).update(manifest).digest("hex");
}

describe("verifyMpSignature", () => {
  it("acepta una firma válida", async () => {
    const xSignature = `ts=${ts},v1=${validV1()}`;
    await expect(verifyMpSignature({ xSignature, xRequestId: requestId, dataId, secret: SECRET })).resolves.toBe(true);
  });
  it("rechaza una firma alterada", async () => {
    const xSignature = `ts=${ts},v1=${"0".repeat(64)}`;
    await expect(verifyMpSignature({ xSignature, xRequestId: requestId, dataId, secret: SECRET })).resolves.toBe(false);
  });
  it("rechaza si cambia el dataId (manifest distinto)", async () => {
    const xSignature = `ts=${ts},v1=${validV1()}`;
    await expect(verifyMpSignature({ xSignature, xRequestId: requestId, dataId: "999", secret: SECRET })).resolves.toBe(false);
  });
  it("rechaza header ausente o malformado", async () => {
    await expect(verifyMpSignature({ xSignature: null, xRequestId: requestId, dataId, secret: SECRET })).resolves.toBe(false);
    await expect(verifyMpSignature({ xSignature: "garbage", xRequestId: requestId, dataId, secret: SECRET })).resolves.toBe(false);
  });
  it("rechaza si falta el secret", async () => {
    const xSignature = `ts=${ts},v1=${validV1()}`;
    await expect(verifyMpSignature({ xSignature, xRequestId: requestId, dataId, secret: "" })).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/unit/payments/signature.test.ts`

- [ ] **Step 3: Implementar `src/lib/payments/signature.ts`**

```ts
export interface MpSignatureInput {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}

/** Parsea "ts=...,v1=..." → { ts, v1 }. */
function parseSignatureHeader(header: string): { ts: string; v1: string } | null {
  const parts = header.split(",").reduce<Record<string, string>>((acc, kv) => {
    const [k, val] = kv.split("=");
    if (k && val) acc[k.trim()] = val.trim();
    return acc;
  }, {});
  if (!parts.ts || !parts.v1) return null;
  return { ts: parts.ts, v1: parts.v1 };
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación constant-time de dos hex del mismo largo. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifica la firma x-signature de Mercado Pago (HMAC-SHA256). Web Crypto → Workers-safe.
 * Manifest (doc MP): `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
 */
export async function verifyMpSignature(input: MpSignatureInput): Promise<boolean> {
  const { xSignature, xRequestId, dataId, secret } = input;
  if (!xSignature || !secret) return false;
  const parsed = parseSignatureHeader(xSignature);
  if (!parsed) return false;

  const manifest = `id:${dataId};request-id:${xRequestId ?? ""};ts:${parsed.ts};`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  return timingSafeEqualHex(toHex(sig), parsed.v1);
}
```

- [ ] **Step 4: Run → PASA.** Run: `pnpm vitest run tests/unit/payments/signature.test.ts`

> Nota: `crypto.subtle` es global en Node 20 (Web Crypto) y en Workers. No importar `node:crypto` en la implementación (solo el test lo usa como referencia).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payments/signature.ts tests/unit/payments/signature.test.ts
git commit -m "feat(m2): MP webhook signature verification (Web Crypto HMAC-SHA256) (TDD)"
```

---

### Task 13: `payments/webhook-effects.ts` (decisión pura idempotente)

**Files:** Create: `src/lib/payments/webhook-effects.ts`. Test: `tests/unit/payments/webhook-effects.test.ts`.

Dado el estado actual del pedido/pago + el estado real de MP, decide los efectos. **Idempotente por diseño:** descuento de stock + emails + `usedCount++` SOLO al transicionar `pending_payment → paid` (primera vez). Un webhook repetido sobre un pedido ya `paid` no repite efectos.

- [ ] **Step 1: Escribir `tests/unit/payments/webhook-effects.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { decideWebhookEffects } from "@/lib/payments/webhook-effects";

describe("decideWebhookEffects", () => {
  it("approved sobre pending_payment → paga, descuenta, cupón, emails", () => {
    const e = decideWebhookEffects({ currentOrderStatus: "pending_payment", mpStatus: "approved", hasCoupon: true });
    expect(e).toEqual({
      updatePaymentTo: "approved",
      setOrderStatusTo: "paid",
      decrementStock: true,
      incrementCouponUse: true,
      sendCustomerEmail: true,
      sendOwnerEmail: true,
    });
  });
  it("approved sin cupón → no incrementa cupón", () => {
    expect(decideWebhookEffects({ currentOrderStatus: "pending_payment", mpStatus: "approved", hasCoupon: false }).incrementCouponUse).toBe(false);
  });
  it("approved repetido sobre pedido ya paid → idempotente (sin efectos secundarios)", () => {
    const e = decideWebhookEffects({ currentOrderStatus: "paid", mpStatus: "approved", hasCoupon: true });
    expect(e).toEqual({
      updatePaymentTo: "approved",
      setOrderStatusTo: null,
      decrementStock: false,
      incrementCouponUse: false,
      sendCustomerEmail: false,
      sendOwnerEmail: false,
    });
  });
  it("rejected sobre pending_payment → actualiza pago, no cambia pedido (reintento)", () => {
    const e = decideWebhookEffects({ currentOrderStatus: "pending_payment", mpStatus: "rejected", hasCoupon: false });
    expect(e.updatePaymentTo).toBe("rejected");
    expect(e.setOrderStatusTo).toBeNull();
    expect(e.decrementStock).toBe(false);
  });
  it("refunded sobre pedido paid → refunded, sin re-descuento", () => {
    const e = decideWebhookEffects({ currentOrderStatus: "paid", mpStatus: "refunded", hasCoupon: false });
    expect(e.setOrderStatusTo).toBe("refunded");
    expect(e.decrementStock).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/unit/payments/webhook-effects.test.ts`

- [ ] **Step 3: Implementar `src/lib/payments/webhook-effects.ts`**

```ts
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { canTransition, orderStatusForPayment } from "@/lib/orders/state-machine";

export interface WebhookDecisionInput {
  currentOrderStatus: OrderStatus;
  mpStatus: PaymentStatus;
  hasCoupon: boolean;
}
export interface WebhookEffects {
  updatePaymentTo: PaymentStatus;
  setOrderStatusTo: OrderStatus | null;
  decrementStock: boolean;
  incrementCouponUse: boolean;
  sendCustomerEmail: boolean;
  sendOwnerEmail: boolean;
}

/**
 * Decide los efectos de un webhook de pago. Idempotente: los efectos "una vez"
 * (stock, cupón, emails) solo ocurren al transicionar realmente pending_payment → paid.
 */
export function decideWebhookEffects(input: WebhookDecisionInput): WebhookEffects {
  const { currentOrderStatus, mpStatus, hasCoupon } = input;
  const target = orderStatusForPayment(mpStatus);
  const willTransition = target !== null && canTransition(currentOrderStatus, target);
  const becomingPaid = willTransition && target === "paid";

  return {
    updatePaymentTo: mpStatus,
    setOrderStatusTo: willTransition ? target : null,
    decrementStock: becomingPaid,
    incrementCouponUse: becomingPaid && hasCoupon,
    sendCustomerEmail: becomingPaid,
    sendOwnerEmail: becomingPaid,
  };
}
```

- [ ] **Step 4: Run → PASA.** Run: `pnpm vitest run tests/unit/payments/webhook-effects.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/payments/webhook-effects.ts tests/unit/payments/webhook-effects.test.ts
git commit -m "feat(m2): idempotent webhook effect decision (TDD)"
```

---

### Task 14: `email/templates.ts`

**Files:** Create: `src/lib/email/templates.ts`. Test: `tests/unit/email/templates.test.ts`.

`orderConfirmationEmail(data)` (a la clienta) + `newOrderAlertEmail(data)` (a la dueña, con alerta de oversell si hay). Devuelven `{ subject, html, text }` con datos reales formateados (`formatARS`).

- [ ] **Step 1: Escribir `tests/unit/email/templates.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { orderConfirmationEmail, newOrderAlertEmail, type OrderEmailData } from "@/lib/email/templates";

const data: OrderEmailData = {
  orderNumber: "GLM-000123",
  contactName: "Ana",
  contactEmail: "ana@example.com",
  items: [
    { name: "Labial Mate", variantName: "Rojo Pasión", qty: 2, lineTotal: 6400 },
    { name: "Gloss Brillo", variantName: null, qty: 1, lineTotal: 2500 },
  ],
  subtotal: 8900, shippingCost: 2500, discountTotal: 500, total: 10900,
  shippingMethod: "domicilio",
};

describe("orderConfirmationEmail", () => {
  it("incluye nº de pedido, ítems y total formateado", () => {
    const m = orderConfirmationEmail(data);
    expect(m.subject).toContain("GLM-000123");
    expect(m.html).toContain("Labial Mate");
    expect(m.html).toContain("Rojo Pasión");
    expect(m.html).toContain("$ 10.900,00");
    expect(m.text).toContain("GLM-000123");
  });
});

describe("newOrderAlertEmail", () => {
  it("avisa a la dueña con el total y el contacto", () => {
    const m = newOrderAlertEmail(data);
    expect(m.subject).toContain("GLM-000123");
    expect(m.html).toContain("ana@example.com");
    expect(m.html).toContain("$ 10.900,00");
  });
  it("destaca oversell cuando hay líneas sin stock", () => {
    const m = newOrderAlertEmail({ ...data, oversoldLines: [{ name: "Labial Mate (Rojo Pasión)" }] });
    expect(m.subject.toLowerCase()).toContain("stock");
    expect(m.html).toContain("Labial Mate (Rojo Pasión)");
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/unit/email/templates.test.ts`

- [ ] **Step 3: Implementar `src/lib/email/templates.ts`**

```ts
import { formatARS } from "@/lib/money";

export interface OrderEmailItem {
  name: string;
  variantName?: string | null;
  qty: number;
  lineTotal: number;
}
export interface OrderEmailData {
  orderNumber: string;
  contactName: string;
  contactEmail: string;
  items: OrderEmailItem[];
  subtotal: number;
  shippingCost: number;
  discountTotal: number;
  total: number;
  shippingMethod: string;
  oversoldLines?: Array<{ name: string }>;
}
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function itemLabel(it: OrderEmailItem): string {
  return it.variantName ? `${it.name} — ${it.variantName}` : it.name;
}
function itemsHtml(items: OrderEmailItem[]): string {
  return items
    .map((it) => `<tr><td>${itemLabel(it)} × ${it.qty}</td><td style="text-align:right">${formatARS(it.lineTotal)}</td></tr>`)
    .join("");
}
function itemsText(items: OrderEmailItem[]): string {
  return items.map((it) => `- ${itemLabel(it)} × ${it.qty}: ${formatARS(it.lineTotal)}`).join("\n");
}
function totalsBlock(d: OrderEmailData): string {
  const rows = [
    ["Subtotal", d.subtotal],
    ...(d.discountTotal > 0 ? [["Descuento", -d.discountTotal] as const] : []),
    ["Envío", d.shippingCost],
    ["Total", d.total],
  ] as Array<readonly [string, number]>;
  return rows.map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right">${formatARS(v)}</td></tr>`).join("");
}

/** Email de confirmación a la clienta. */
export function orderConfirmationEmail(d: OrderEmailData): EmailContent {
  const subject = `¡Gracias por tu compra! Pedido ${d.orderNumber} — Glamify Makeup`;
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1 style="color:#FF2E93">¡Gracias, ${d.contactName}! 💄</h1>
    <p>Recibimos tu pedido <strong>${d.orderNumber}</strong>. Te avisamos cuando lo despachemos.</p>
    <table style="width:100%;border-collapse:collapse">${itemsHtml(d.items)}</table>
    <hr/>
    <table style="width:100%;border-collapse:collapse">${totalsBlock(d)}</table>
    <p>Envío: ${d.shippingMethod}.</p>
    <p>Cualquier duda, escribinos por WhatsApp.</p>
  </div>`;
  const text = `¡Gracias, ${d.contactName}!\nPedido ${d.orderNumber}\n\n${itemsText(d.items)}\n\nSubtotal: ${formatARS(d.subtotal)}\nDescuento: ${formatARS(d.discountTotal)}\nEnvío: ${formatARS(d.shippingCost)}\nTotal: ${formatARS(d.total)}\nEnvío: ${d.shippingMethod}`;
  return { subject, html, text };
}

/** Email de alerta a la dueña (nuevo pedido pagado), con alerta de oversell si corresponde. */
export function newOrderAlertEmail(d: OrderEmailData): EmailContent {
  const oversell = d.oversoldLines && d.oversoldLines.length > 0;
  const subject = oversell
    ? `⚠️ Nuevo pedido ${d.orderNumber} — REVISAR STOCK`
    : `🛍️ Nuevo pedido pagado ${d.orderNumber} (${formatARS(d.total)})`;
  const oversellHtml = oversell
    ? `<div style="background:#FEE;padding:8px;border-radius:8px">
        <strong>Oversell:</strong> sin stock suficiente para:
        <ul>${d.oversoldLines!.map((l) => `<li>${l.name}</li>`).join("")}</ul>
        Coordinar con la clienta por WhatsApp.
      </div>`
    : "";
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1>Nuevo pedido ${d.orderNumber}</h1>
    ${oversellHtml}
    <p>Cliente: ${d.contactName} — ${d.contactEmail}</p>
    <table style="width:100%;border-collapse:collapse">${itemsHtml(d.items)}</table>
    <table style="width:100%;border-collapse:collapse">${totalsBlock(d)}</table>
    <p>Envío: ${d.shippingMethod}.</p>
  </div>`;
  const text = `Nuevo pedido ${d.orderNumber}\nCliente: ${d.contactName} (${d.contactEmail})\nTotal: ${formatARS(d.total)}${oversell ? `\n⚠️ OVERSELL: ${d.oversoldLines!.map((l) => l.name).join(", ")}` : ""}`;
  return { subject, html, text };
}
```

- [ ] **Step 4: Run → PASA.** Run: `pnpm vitest run tests/unit/email/templates.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates.ts tests/unit/email/templates.test.ts
git commit -m "feat(m2): order/owner email templates with oversell alert (TDD)"
```

## FASE 2 — Libs IO (integration con `fetch`/env mockeados)

### Task 15: `payments/mercadopago.ts`

**Files:** Create: `src/lib/payments/mercadopago.ts`. Test: `tests/integration/mercadopago.test.ts`.

`createPreference(input, deps?)` y `getPayment(id, deps?)` por `fetch` (Bearer `MP_ACCESS_TOKEN`). `fetch` y `accessToken` inyectables. `mpStatusToPaymentStatus` mapea strings de MP → enum `PaymentStatus`.

- [ ] **Step 1: Escribir `tests/integration/mercadopago.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { createPreference, getPayment, mpStatusToPaymentStatus } from "@/lib/payments/mercadopago";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("createPreference", () => {
  it("postea a /checkout/preferences con Bearer y excluye efectivo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "pref-1", init_point: "https://mp/ip", sandbox_init_point: "https://mp/sbx" }));
    const pref = await createPreference(
      {
        orderId: "ord-1", orderNumber: "GLM-000001",
        items: [{ title: "Labial", quantity: 2, unit_price: 3200 }],
        payerEmail: "ana@example.com", appUrl: "https://app.test", notificationUrl: "https://app.test/api/webhooks/mercadopago",
      },
      { fetch: fetchMock, accessToken: "TEST-token" },
    );
    expect(pref.id).toBe("pref-1");
    expect(pref.sandbox_init_point).toBe("https://mp/sbx");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/checkout/preferences");
    expect((opts as RequestInit).headers).toMatchObject({ Authorization: "Bearer TEST-token" });
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.external_reference).toBe("ord-1");
    expect(body.payment_methods.excluded_payment_types).toEqual([{ id: "ticket" }, { id: "atm" }]);
    expect(body.notification_url).toContain("/api/webhooks/mercadopago");
    expect(body.auto_return).toBe("approved");
  });
  it("lanza si MP responde error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "bad" }, false, 400));
    await expect(
      createPreference(
        { orderId: "o", orderNumber: "n", items: [], payerEmail: "e", appUrl: "u", notificationUrl: "w" },
        { fetch: fetchMock, accessToken: "t" },
      ),
    ).rejects.toThrow();
  });
});

describe("getPayment", () => {
  it("GET /v1/payments/:id con Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 123, status: "approved", external_reference: "ord-1", transaction_amount: 10900 }));
    const p = await getPayment("123", { fetch: fetchMock, accessToken: "t" });
    expect(p.status).toBe("approved");
    expect(p.external_reference).toBe("ord-1");
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/payments/123");
  });
});

describe("mpStatusToPaymentStatus", () => {
  it("mapea los estados de MP al enum", () => {
    expect(mpStatusToPaymentStatus("approved")).toBe("approved");
    expect(mpStatusToPaymentStatus("rejected")).toBe("rejected");
    expect(mpStatusToPaymentStatus("in_process")).toBe("in_process");
    expect(mpStatusToPaymentStatus("pending")).toBe("pending");
    expect(mpStatusToPaymentStatus("refunded")).toBe("refunded");
    expect(mpStatusToPaymentStatus("cancelled")).toBe("cancelled");
    expect(mpStatusToPaymentStatus("charged_back")).toBe("refunded");
    expect(mpStatusToPaymentStatus("in_mediation")).toBe("in_process");
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/integration/mercadopago.test.ts`

- [ ] **Step 3: Implementar `src/lib/payments/mercadopago.ts`**

```ts
import type { PaymentStatus } from "@prisma/client";

const MP_API = "https://api.mercadopago.com";

export interface MpDeps {
  fetch?: typeof fetch;
  accessToken?: string;
}
function resolveDeps(deps: MpDeps): { fetchFn: typeof fetch; token: string } {
  const fetchFn = deps.fetch ?? fetch;
  const token = deps.accessToken ?? process.env.MP_ACCESS_TOKEN ?? "";
  if (!token) throw new Error("MP_ACCESS_TOKEN no configurado.");
  return { fetchFn, token };
}

export interface PreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
}
export interface CreatePreferenceInput {
  orderId: string;
  orderNumber: string;
  items: PreferenceItem[];
  payerEmail: string;
  appUrl: string;
  notificationUrl: string;
}
export interface MpPreference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

/** Crea una preference de Checkout Pro (efectivo excluido, auto_return approved). */
export async function createPreference(input: CreatePreferenceInput, deps: MpDeps = {}): Promise<MpPreference> {
  const { fetchFn, token } = resolveDeps(deps);
  const body = {
    items: input.items.map((it, i) => ({ id: String(i), currency_id: "ARS", ...it })),
    payer: { email: input.payerEmail },
    external_reference: input.orderId,
    notification_url: input.notificationUrl,
    back_urls: {
      success: `${input.appUrl}/checkout/gracias`,
      failure: `${input.appUrl}/checkout/gracias`,
      pending: `${input.appUrl}/checkout/gracias`,
    },
    auto_return: "approved",
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 12 },
    statement_descriptor: "GLAMIFY",
    metadata: { order_number: input.orderNumber },
  };
  const res = await fetchFn(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`MP createPreference falló: ${res.status} ${await res.text()}`);
  return (await res.json()) as MpPreference;
}

export interface MpPayment {
  id: string;
  status: string;
  external_reference?: string;
  transaction_amount?: number;
}

/** Consulta un pago por id (fuente de verdad del webhook). */
export async function getPayment(id: string, deps: MpDeps = {}): Promise<MpPayment> {
  const { fetchFn, token } = resolveDeps(deps);
  const res = await fetchFn(`${MP_API}/v1/payments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`MP getPayment falló: ${res.status} ${await res.text()}`);
  const raw = (await res.json()) as { id: number | string; status: string; external_reference?: string; transaction_amount?: number };
  return { id: String(raw.id), status: raw.status, external_reference: raw.external_reference, transaction_amount: raw.transaction_amount };
}

/** Mapea el status de un pago de MP al enum PaymentStatus. */
export function mpStatusToPaymentStatus(status: string): PaymentStatus {
  switch (status) {
    case "approved": return "approved";
    case "rejected": return "rejected";
    case "in_process":
    case "in_mediation": return "in_process";
    case "refunded":
    case "charged_back": return "refunded";
    case "cancelled": return "cancelled";
    default: return "pending";
  }
}
```

- [ ] **Step 4: Run → PASA.** Run: `pnpm vitest run tests/integration/mercadopago.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/payments/mercadopago.ts tests/integration/mercadopago.test.ts
git commit -m "feat(m2): MercadoPago createPreference + getPayment + status mapping (TDD)"
```

---

### Task 16: `email/resend.ts`

**Files:** Create: `src/lib/email/resend.ts`. Test: `tests/integration/resend.test.ts`.

`sendEmail(input, deps?)`: si hay `RESEND_API_KEY` → POST `https://api.resend.com/emails`; si no → log a consola (dev transport) y devuelve `{ id:null, logged:true }`.

- [ ] **Step 1: Escribir `tests/integration/resend.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { sendEmail } from "@/lib/email/resend";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("sendEmail", () => {
  it("postea a Resend cuando hay API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "email-1" }));
    const r = await sendEmail(
      { to: "ana@example.com", subject: "Hola", html: "<p>hi</p>", from: "Glamify <p@glamify.site>" },
      { fetch: fetchMock, apiKey: "re_test" },
    );
    expect(r).toEqual({ id: "email-1", logged: false });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("api.resend.com/emails");
    expect((opts as RequestInit).headers).toMatchObject({ Authorization: "Bearer re_test" });
  });
  it("sin API key → loguea y no postea", async () => {
    const fetchMock = vi.fn();
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const r = await sendEmail({ to: "ana@example.com", subject: "Hola", html: "<p>hi</p>" }, { fetch: fetchMock, apiKey: "" });
    expect(r).toEqual({ id: null, logged: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/integration/resend.test.ts`

- [ ] **Step 3: Implementar `src/lib/email/resend.ts`**

```ts
export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}
export interface SendEmailDeps {
  fetch?: typeof fetch;
  apiKey?: string;
  defaultFrom?: string;
}
export interface SendEmailResult {
  id: string | null;
  logged: boolean;
}

const RESEND_API = "https://api.resend.com/emails";

/** Envía un email por Resend; si no hay API key, lo loguea (transport de dev). */
export async function sendEmail(input: SendEmailInput, deps: SendEmailDeps = {}): Promise<SendEmailResult> {
  const apiKey = deps.apiKey ?? process.env.RESEND_API_KEY ?? "";
  const from = input.from ?? deps.defaultFrom ?? process.env.RESEND_FROM ?? "Glamify Makeup <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(`📧 [dev email] → ${input.to} | ${input.subject}\n${input.text ?? input.html}`);
    return { id: null, logged: true };
  }
  const fetchFn = deps.fetch ?? fetch;
  const res = await fetchFn(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
  });
  if (!res.ok) throw new Error(`Resend falló: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { id: string };
  return { id: body.id, logged: false };
}
```

- [ ] **Step 4: Run → PASA.** Run: `pnpm vitest run tests/integration/resend.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/resend.ts tests/integration/resend.test.ts
git commit -m "feat(m2): Resend email transport with dev console fallback (TDD)"
```

---

### Task 17: `shipping/correo.ts` + `shipping/index.ts`

**Files:** Create: `src/lib/shipping/correo.ts`, `src/lib/shipping/index.ts`. Test: `tests/integration/shipping.test.ts`.

`correo.ts`: `isCorreoConfigured(env)` + `quoteCorreo(...)` → **null si no configurado** (diferido a M5). `index.ts`: `quoteShipping(input, deps)` orquesta gratis → Correo → zonas, aplicando `methodFactor`.

- [ ] **Step 1: Escribir `tests/integration/shipping.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { isCorreoConfigured } from "@/lib/shipping/correo";
import { quoteShipping } from "@/lib/shipping/index";
import type { Zone } from "@/lib/shipping/quote";
import type { CartLine } from "@/lib/cart/types";

const line = (over: Partial<CartLine> = {}): CartLine => ({ id: "l1", kind: "variant", refId: "v1", unitPrice: 1000, qty: 1, weightGr: 50, ...over });
const zones: Zone[] = [
  { id: "z-amba", matchType: "cpRange", provinces: [], cpFrom: "1000", cpTo: "1900", price: 2500, active: true, order: 0 },
  { id: "z-resto", matchType: "cpRange", provinces: [], cpFrom: "0", cpTo: "9999", price: 6200, active: true, order: 3 },
];

describe("isCorreoConfigured", () => {
  it("false si faltan credenciales", () => {
    expect(isCorreoConfigured({})).toBe(false);
    expect(isCorreoConfigured({ MICORREO_USER: "u", MICORREO_PASSWORD: "p", MICORREO_AGREEMENT: "a" })).toBe(true);
  });
});

describe("quoteShipping", () => {
  const deps = { getZones: async () => zones, getThreshold: async () => 47500, correoQuote: async () => null };

  it("envío gratis si supera el umbral", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "domicilio", lines: [line({ unitPrice: 50000 })], subtotal: 50000 }, deps);
    expect(q).toMatchObject({ cost: 0, free: true, source: "free" });
  });
  it("usa la zona cuando Correo no está configurado", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "domicilio", lines: [line()], subtotal: 3000 }, deps);
    expect(q).toMatchObject({ cost: 2500, free: false, source: "zone", zoneId: "z-amba" });
  });
  it("sucursal es más barata (methodFactor 0.85)", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "sucursal", lines: [line()], subtotal: 3000 }, deps);
    expect(q.cost).toBe(2125); // 2500 * 0.85
  });
  it("prefiere Correo cuando devuelve una cotización", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "domicilio", lines: [line()], subtotal: 3000 }, { ...deps, correoQuote: async () => 1999 });
    expect(q).toMatchObject({ cost: 1999, source: "correo" });
  });
  it("sin zona ni Correo → source none, cost 0", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "domicilio", lines: [line()], subtotal: 3000 }, { ...deps, getZones: async () => [] });
    expect(q).toMatchObject({ source: "none", cost: 0 });
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/integration/shipping.test.ts`

- [ ] **Step 3: Implementar `src/lib/shipping/correo.ts`**

```ts
export type CorreoEnv = {
  MICORREO_USER?: string;
  MICORREO_PASSWORD?: string;
  MICORREO_AGREEMENT?: string;
};

/** ¿Hay credenciales de MiCorreo? (API real diferida a M5; sin esto → fallback a zonas). */
export function isCorreoConfigured(env: CorreoEnv = process.env): boolean {
  return Boolean(env.MICORREO_USER && env.MICORREO_PASSWORD && env.MICORREO_AGREEMENT);
}

export interface CorreoQuoteInput {
  cpDestino: string;
  pesoGr: number;
  metodo: "domicilio" | "sucursal";
}

/**
 * Cotización en vivo de MiCorreo. Diferido a M5: sin credenciales devuelve null → el
 * orquestador cae a la tabla de zonas. (El seam queda listo para enchufar la API real.)
 */
export async function quoteCorreo(_input: CorreoQuoteInput, env: CorreoEnv = process.env): Promise<number | null> {
  if (!isCorreoConfigured(env)) return null;
  // TODO(M5): llamar a la API REST de MiCorreo (JWT) con CP origen 6700 + peso. Por ahora null.
  return null;
}
```

- [ ] **Step 4: Implementar `src/lib/shipping/index.ts`**

```ts
// NOTA: sin `import "server-only"` — este módulo lo importa también scripts/simulate-mp-webhook.ts (node).
// Es server por importar prisma indirectamente; ningún client component lo importa.
import { round2 } from "@/lib/money";
import { matchZone, isFreeShipping, methodFactor, orderWeightGr, type Zone } from "@/lib/shipping/quote";
import { quoteCorreo } from "@/lib/shipping/correo";
import type { CartLine } from "@/lib/cart/types";

export interface QuoteShippingInput {
  cp: string;
  province?: string | null;
  method: "domicilio" | "sucursal";
  lines: CartLine[];
  subtotal: number;
}
export interface ShippingQuote {
  cost: number;
  free: boolean;
  zoneId: string | null;
  source: "free" | "correo" | "zone" | "none";
}
export interface QuoteShippingDeps {
  getZones?: () => Promise<Zone[]>;
  getThreshold?: () => Promise<number>;
  correoQuote?: (input: { cpDestino: string; pesoGr: number; metodo: "domicilio" | "sucursal" }) => Promise<number | null>;
}

/** Orquesta el costo de envío: gratis por umbral → Correo (si configurado) → tabla de zonas. */
export async function quoteShipping(input: QuoteShippingInput, deps: QuoteShippingDeps = {}): Promise<ShippingQuote> {
  const getZones = deps.getZones ?? (async () => []);
  const getThreshold = deps.getThreshold ?? (async () => 0);
  const correoQuote = deps.correoQuote ?? quoteCorreo;

  const threshold = await getThreshold();
  if (isFreeShipping(input.subtotal, threshold)) {
    return { cost: 0, free: true, zoneId: null, source: "free" };
  }

  const pesoGr = orderWeightGr(input.lines);
  const factor = methodFactor(input.method);

  const correo = await correoQuote({ cpDestino: input.cp, pesoGr, metodo: input.method });
  if (correo != null) return { cost: round2(correo * factor), free: false, zoneId: null, source: "correo" };

  const zones = await getZones();
  const zone = matchZone(zones, { cp: input.cp, province: input.province });
  if (zone) return { cost: round2(Number(zone.price) * factor), free: false, zoneId: zone.id, source: "zone" };

  return { cost: 0, free: false, zoneId: null, source: "none" };
}
```

- [ ] **Step 5: Run → PASA.** Run: `pnpm vitest run tests/integration/shipping.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shipping/correo.ts src/lib/shipping/index.ts tests/integration/shipping.test.ts
git commit -m "feat(m2): shipping orchestrator (free→correo→zones) + env-gated Correo seam (TDD)"
```

## FASE 3 — Servicios server-only + Server Actions + webhook route

### Task 18: `cart/cart-cookie.ts` + `cart/cart-service.ts`

**Files:** Create: `src/lib/cart/cart-cookie.ts`, `src/lib/cart/cart-service.ts`. Test: `tests/unit/cart/map.test.ts` (mapping puro).

`cart-cookie.ts`: helpers de cookie (`glamify_cart` UUID, `glamify_coupon` código). `cart-service.ts`: include estándar + `cartItemToCartLine` (puro, testeado) + ops DB (`getOrCreateCart`, `addItem`, `updateItem`, `removeItem`, `loadCart`). Las ops DB se ejercitan en e2e + simulate; el mapping se testea en unit.

- [ ] **Step 1: Escribir `tests/unit/cart/map.test.ts`** (mapping puro variante + combo):

```ts
import { describe, it, expect } from "vitest";
import { cartItemToCartLine, type CartItemWithRefs } from "@/lib/cart/cart-service";

const variantItem: CartItemWithRefs = {
  id: "ci1", qty: 2, unitPriceSnapshot: "3200", comboId: null, variantId: "v1",
  variant: {
    id: "v1", name: "Rojo Pasión", priceOverride: null, stock: 18, weightGrOverride: null,
    product: { id: "p1", name: "Labial Mate", basePrice: "3200", weightGr: 25, categoryId: "c1", slug: "labial-mate", images: [] },
  },
  combo: null,
} as unknown as CartItemWithRefs;

const comboItem: CartItemWithRefs = {
  id: "ci2", qty: 1, unitPriceSnapshot: "4990", comboId: "combo1", variantId: null,
  variant: null,
  combo: {
    id: "combo1", name: "Dúo Labios Glam", comboPrice: "4990", slug: "duo-labios-glam", images: [],
    items: [
      { variantId: "v1", qty: 1, variant: { weightGrOverride: null, product: { weightGr: 25 } } },
      { variantId: "v2", qty: 1, variant: { weightGrOverride: 22, product: { weightGr: 30 } } },
    ],
  },
} as unknown as CartItemWithRefs;

describe("cartItemToCartLine", () => {
  it("mapea una línea de variante (precio efectivo, peso, ids)", () => {
    const l = cartItemToCartLine(variantItem);
    expect(l).toMatchObject({ id: "ci1", kind: "variant", refId: "v1", unitPrice: 3200, qty: 2, weightGr: 25, productId: "p1", categoryId: "c1" });
    expect(l.components).toBeUndefined();
  });
  it("usa priceOverride y weightGrOverride de la variante si existen", () => {
    const item = { ...variantItem, variant: { ...variantItem.variant!, priceOverride: "2990", weightGrOverride: 40 } } as CartItemWithRefs;
    const l = cartItemToCartLine(item);
    expect(l.unitPrice).toBe(2990);
    expect(l.weightGr).toBe(40);
  });
  it("mapea un combo con sus componentes y peso sumado", () => {
    const l = cartItemToCartLine(comboItem);
    expect(l).toMatchObject({ id: "ci2", kind: "combo", refId: "combo1", unitPrice: 4990, qty: 1, productId: null, categoryId: null });
    expect(l.components).toEqual([{ variantId: "v1", qty: 1 }, { variantId: "v2", qty: 1 }]);
    expect(l.weightGr).toBe(47); // 25 + 22(override)
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/unit/cart/map.test.ts`

- [ ] **Step 3: Implementar `src/lib/cart/cart-cookie.ts`**

```ts
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
```

- [ ] **Step 4: Implementar `src/lib/cart/cart-service.ts`**

```ts
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectivePrice, toNumber } from "@/lib/catalog/pricing";
import type { CartLine } from "@/lib/cart/types";

/** Include estándar para cargar un carrito con todo lo necesario para calcular líneas. */
export const CART_INCLUDE = {
  items: {
    include: {
      variant: { include: { product: { include: { category: true } } } },
      combo: { include: { items: { include: { variant: { include: { product: true } } } } } },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;
export type CartItemWithRefs = CartWithItems["items"][number];

/** Mapea un CartItem (con includes) a una CartLine pura para cálculos. */
export function cartItemToCartLine(item: CartItemWithRefs): CartLine {
  if (item.combo) {
    const components = item.combo.items.map((ci) => ({ variantId: ci.variantId, qty: ci.qty }));
    const weightGr = item.combo.items.reduce(
      (acc, ci) => acc + (ci.variant.weightGrOverride ?? ci.variant.product.weightGr) * ci.qty,
      0,
    );
    return {
      id: item.id, kind: "combo", refId: item.combo.id,
      unitPrice: toNumber(item.combo.comboPrice), qty: item.qty,
      weightGr, productId: null, categoryId: null, components,
    };
  }
  const v = item.variant!;
  return {
    id: item.id, kind: "variant", refId: v.id,
    unitPrice: getEffectivePrice(v.product, v), qty: item.qty,
    weightGr: v.weightGrOverride ?? v.product.weightGr,
    productId: v.product.id, categoryId: v.product.categoryId,
  };
}

export interface LoadedCart {
  cart: CartWithItems | null;
  lines: CartLine[];
}

/** Carga un carrito por id con sus líneas mapeadas. */
export async function loadCart(cartId: string | null): Promise<LoadedCart> {
  if (!cartId) return { cart: null, lines: [] };
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: CART_INCLUDE });
  if (!cart || cart.status !== "active") return { cart: null, lines: [] };
  return { cart, lines: cart.items.map(cartItemToCartLine) };
}

/** Crea un carrito activo y devuelve su id. */
export async function createCart(): Promise<string> {
  const cart = await prisma.cart.create({ data: { sessionId: crypto.randomUUID(), status: "active" } });
  return cart.id;
}

export interface AddItemInput {
  cartId: string;
  variantId?: string;
  comboId?: string;
  qty: number;
}

/** Agrega (o incrementa) una línea. Calcula el snapshot de precio en el server. */
export async function addItem(input: AddItemInput): Promise<void> {
  const qty = Math.max(1, Math.floor(input.qty));
  if (input.variantId) {
    const variant = await prisma.productVariant.findUnique({ where: { id: input.variantId }, include: { product: true } });
    if (!variant || !variant.active) throw new Error("Variante no disponible.");
    const unit = getEffectivePrice(variant.product, variant);
    const existing = await prisma.cartItem.findFirst({ where: { cartId: input.cartId, variantId: input.variantId } });
    if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: existing.qty + qty } });
    else await prisma.cartItem.create({ data: { cartId: input.cartId, variantId: input.variantId, qty, unitPriceSnapshot: unit } });
    return;
  }
  if (input.comboId) {
    const combo = await prisma.combo.findUnique({ where: { id: input.comboId } });
    if (!combo || !combo.active) throw new Error("Combo no disponible.");
    const existing = await prisma.cartItem.findFirst({ where: { cartId: input.cartId, comboId: input.comboId } });
    if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: existing.qty + qty } });
    else await prisma.cartItem.create({ data: { cartId: input.cartId, comboId: input.comboId, qty, unitPriceSnapshot: combo.comboPrice } });
    return;
  }
  throw new Error("addItem requiere variantId o comboId.");
}

/** Actualiza la cantidad de una línea (0 o menos → elimina). */
export async function updateItem(itemId: string, qty: number): Promise<void> {
  if (qty <= 0) { await removeItem(itemId); return; }
  await prisma.cartItem.update({ where: { id: itemId }, data: { qty: Math.floor(qty) } });
}

/** Elimina una línea. */
export async function removeItem(itemId: string): Promise<void> {
  await prisma.cartItem.delete({ where: { id: itemId } });
}
```

- [ ] **Step 5: Run → PASA (mapping) + typecheck.** Run: `pnpm vitest run tests/unit/cart/map.test.ts && pnpm typecheck`
Expected: el test del mapping pasa; typecheck verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cart/cart-cookie.ts src/lib/cart/cart-service.ts tests/unit/cart/map.test.ts
git commit -m "feat(m2): cart cookie helpers + cart service (CRUD + pure line mapping) (TDD)"
```

### Task 19: `orders/checkout-service.ts`

**Files:** Create: `src/lib/orders/checkout-service.ts`. Test: `tests/integration/checkout-service.test.ts`.

`createCheckout(input, deps)`: recalcula subtotal en server, valida+aplica cupón, cotiza envío, calcula total; en una tx crea `Order(pending_payment)` + `OrderItem`s (snapshots) + `Payment(pending)` con `orderNumber` de la secuencia; crea la preference MP; guarda `mpPreferenceId`; marca el carrito `ordered`. Deps inyectables (`db`, `createPreference`, `quoteShipping`, `nextOrderSeq`, `appUrl`, `now`) → testeable sin DB ni red.

- [ ] **Step 1: Escribir `tests/integration/checkout-service.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { createCheckout, type CreateCheckoutDeps, type CheckoutLineInput } from "@/lib/orders/checkout-service";
import type { CartLine } from "@/lib/cart/types";

const cartLine = (over: Partial<CartLine> = {}): CartLine => ({
  id: "ci1", kind: "variant", refId: "v1", unitPrice: 3200, qty: 2, weightGr: 25, productId: "p1", categoryId: "c1", ...over,
});
const checkoutLine = (over: Partial<CheckoutLineInput> = {}): CheckoutLineInput => ({
  line: cartLine(), productNameSnapshot: "Labial Mate", variantNameSnapshot: "Rojo Pasión", skuSnapshot: "LAB-0001", title: "Labial Mate — Rojo Pasión", ...over,
});

function makeDeps(over: Partial<CreateCheckoutDeps> = {}): { deps: CreateCheckoutDeps; created: any } {
  const created: any = {};
  const tx = {
    order: { create: vi.fn(async ({ data }: any) => { created.order = { id: "ord-1", ...data, payments: [{ id: "pay-1" }] }; return created.order; }) },
    payment: { update: vi.fn(async () => ({})) },
    cart: { update: vi.fn(async () => ({})) },
  };
  const deps: CreateCheckoutDeps = {
    db: {
      coupon: { findUnique: vi.fn(async ({ where }: any) => (where.code === "GLAM10" ? { id: "co-1", code: "GLAM10", type: "percentage", value: 10, scope: "all", scopeId: null, active: true, minSubtotal: null, validFrom: null, validTo: null, maxUses: null, usedCount: 0 } : null)) },
      $transaction: vi.fn(async (fn: any) => fn(tx)),
    } as any,
    nextOrderSeq: vi.fn(async () => 1),
    createPreference: vi.fn(async () => ({ id: "pref-1", init_point: "https://mp/ip", sandbox_init_point: "https://mp/sbx" })),
    quoteShipping: vi.fn(async () => ({ cost: 2500, free: false, zoneId: "z-amba", source: "zone" as const })),
    appUrl: "https://app.test",
    now: new Date("2026-06-04T12:00:00Z"),
    ...over,
  };
  (deps as any)._tx = tx;
  return { deps, created };
}

const baseInput = {
  contactName: "Ana", contactEmail: "ana@example.com", contactPhone: "1122334455",
  shippingMethod: "domicilio" as const,
  address: { cp: "1414", province: "CABA", street: "Calle", number: "123", city: "CABA" },
  lines: [checkoutLine()],
  couponCode: null as string | null,
};

describe("createCheckout", () => {
  it("crea pedido con total recalculado en server e init_point de MP", async () => {
    const { deps } = makeDeps();
    const r = await createCheckout(baseInput, deps);
    expect(r.orderNumber).toBe("GLM-000001");
    expect(r.initPoint).toBe("https://mp/sbx"); // sandbox preferido
    const tx = (deps as any)._tx;
    const orderData = tx.order.create.mock.calls[0][0].data;
    expect(orderData.subtotal).toBe(6400);   // 3200×2
    expect(orderData.shippingCost).toBe(2500);
    expect(orderData.total).toBe(8900);       // 6400 + 2500
    expect(orderData.status).toBe("pending_payment");
    expect(orderData.items.create).toHaveLength(1);
    expect(orderData.items.create[0]).toMatchObject({ skuSnapshot: "LAB-0001", qty: 2, lineTotal: 6400 });
  });

  it("aplica el cupón y descuenta del total", async () => {
    const { deps } = makeDeps();
    const r = await createCheckout({ ...baseInput, couponCode: "GLAM10" }, deps);
    const orderData = (deps as any)._tx.order.create.mock.calls[0][0].data;
    expect(orderData.discountTotal).toBe(640);    // 10% de 6400
    expect(orderData.total).toBe(8260);           // 6400 - 640 + 2500
    expect(orderData.couponId).toBe("co-1");
    expect(r.orderId).toBe("ord-1");
  });

  it("cupón free_shipping → envío 0 en el total", async () => {
    const { deps } = makeDeps({ db: { coupon: { findUnique: vi.fn(async () => ({ id: "co-2", code: "ENVIOGRATIS", type: "free_shipping", value: 0, scope: "all", scopeId: null, active: true, minSubtotal: null, validFrom: null, validTo: null, maxUses: null, usedCount: 0 })) }, $transaction: vi.fn(async (fn: any) => fn((makeDeps().deps as any)._tx)) } as any });
    const tx = { order: { create: vi.fn(async ({ data }: any) => ({ id: "ord-x", ...data, payments: [{ id: "p" }] })) }, payment: { update: vi.fn() }, cart: { update: vi.fn() } };
    (deps.db.$transaction as any) = vi.fn(async (fn: any) => fn(tx));
    await createCheckout({ ...baseInput, couponCode: "ENVIOGRATIS" }, deps);
    const orderData = tx.order.create.mock.calls[0][0].data;
    expect(orderData.total).toBe(6400); // envío gratis: 6400 + 0
  });

  it("rechaza carrito vacío", async () => {
    const { deps } = makeDeps();
    await expect(createCheckout({ ...baseInput, lines: [] }, deps)).rejects.toThrow();
  });

  it("ignora cupón inválido (no aplica descuento) sin romper", async () => {
    const { deps } = makeDeps();
    const r = await createCheckout({ ...baseInput, couponCode: "NOEXISTE" }, deps);
    const orderData = (deps as any)._tx.order.create.mock.calls[0][0].data;
    expect(orderData.discountTotal).toBe(0);
    expect(orderData.couponId).toBeNull();
    expect(r.orderNumber).toBe("GLM-000001");
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/integration/checkout-service.test.ts`

- [ ] **Step 3: Implementar `src/lib/orders/checkout-service.ts`**

```ts
// NOTA: sin `import "server-only"` — lo importa scripts/simulate-mp-webhook.ts (node). Server por importar prisma.
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/money";
import { cartSubtotal } from "@/lib/cart/totals";
import { lineTotal } from "@/lib/cart/totals";
import { validateCoupon, applyCoupon } from "@/lib/coupons/apply";
import { formatOrderNumber } from "@/lib/orders/order-number";
import { createPreference as realCreatePreference } from "@/lib/payments/mercadopago";
import { quoteShipping as realQuoteShipping, type ShippingQuote } from "@/lib/shipping/index";
import { getShippingZonesForQuote, getFreeShippingThreshold } from "@/lib/orders/checkout-data";
import type { CartLine } from "@/lib/cart/types";

export interface CheckoutLineInput {
  line: CartLine;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string | null;
  title: string;
}
export interface CheckoutAddress {
  cp: string;
  province?: string | null;
  street?: string;
  number?: string;
  floorApt?: string | null;
  city?: string;
  notes?: string | null;
}
export interface CreateCheckoutInput {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  shippingMethod: "domicilio" | "sucursal";
  address: CheckoutAddress;
  lines: CheckoutLineInput[];
  couponCode?: string | null;
  customerId?: string | null;
  cartId?: string | null;
}

/** Superficie mínima de DB que necesita el servicio (para inyectar fakes en tests). */
export interface CheckoutDb {
  coupon: { findUnique: (args: { where: { code: string } }) => Promise<any> };
  $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
}
export interface CreateCheckoutDeps {
  db: CheckoutDb;
  nextOrderSeq: (tx: any) => Promise<number>;
  createPreference: typeof realCreatePreference;
  quoteShipping: (input: Parameters<typeof realQuoteShipping>[0]) => Promise<ShippingQuote>;
  appUrl: string;
  now?: Date;
}
export interface CreateCheckoutResult {
  orderId: string;
  orderNumber: string;
  initPoint: string;
}

/** Lee la secuencia order_number_seq dentro de la tx (default real). */
async function defaultNextOrderSeq(tx: any): Promise<number> {
  const rows = (await tx.$queryRawUnsafe("SELECT nextval('order_number_seq') AS seq")) as Array<{ seq: bigint | number }>;
  return Number(rows[0].seq);
}

export function defaultCheckoutDeps(appUrl: string): CreateCheckoutDeps {
  return {
    db: prisma as unknown as CheckoutDb,
    nextOrderSeq: defaultNextOrderSeq,
    createPreference: realCreatePreference,
    quoteShipping: (input) => realQuoteShipping(input, { getZones: getShippingZonesForQuote, getThreshold: getFreeShippingThreshold }),
    appUrl,
  };
}

export async function createCheckout(input: CreateCheckoutInput, deps: CreateCheckoutDeps): Promise<CreateCheckoutResult> {
  if (input.lines.length === 0) throw new Error("El carrito está vacío.");
  const now = deps.now ?? new Date();
  const cartLines = input.lines.map((l) => l.line);
  const subtotal = cartSubtotal(cartLines);

  // --- Cupón (revalidado en server) ---
  let discount = 0;
  let freeShippingByCoupon = false;
  let couponId: string | null = null;
  if (input.couponCode) {
    const coupon = await deps.db.coupon.findUnique({ where: { code: input.couponCode } });
    if (coupon) {
      const v = validateCoupon(coupon, { subtotal, now });
      if (v.ok) {
        const res = applyCoupon(coupon, cartLines);
        discount = res.discount;
        freeShippingByCoupon = res.freeShipping;
        couponId = coupon.id;
      }
    }
  }

  // --- Envío ---
  const quote = await deps.quoteShipping({
    cp: input.address.cp, province: input.address.province ?? null,
    method: input.shippingMethod, lines: cartLines, subtotal,
  });
  const shippingCost = freeShippingByCoupon ? 0 : quote.cost;
  const total = round2(subtotal - discount + shippingCost);

  // --- Persistencia (tx) ---
  const order = await deps.db.$transaction(async (tx) => {
    const seq = await deps.nextOrderSeq(tx);
    const orderNumber = formatOrderNumber(seq);
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId: input.customerId ?? null,
        contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone,
        shippingAddress: input.address as unknown as object,
        shippingMethod: input.shippingMethod,
        shippingZoneId: quote.zoneId,
        subtotal, shippingCost, discountTotal: discount, total,
        couponId,
        status: "pending_payment",
        items: {
          create: input.lines.map((l) => ({
            variantId: l.line.kind === "variant" ? l.line.refId : null,
            comboId: l.line.kind === "combo" ? l.line.refId : null,
            productNameSnapshot: l.productNameSnapshot,
            variantNameSnapshot: l.variantNameSnapshot,
            skuSnapshot: l.skuSnapshot,
            unitPriceSnapshot: l.line.unitPrice,
            qty: l.line.qty,
            lineTotal: lineTotal(l.line),
          })),
        },
        payments: { create: { provider: "mercadopago", status: "pending", amount: total } },
      },
      include: { payments: true },
    });
    if (input.cartId) await tx.cart.update({ where: { id: input.cartId }, data: { status: "ordered" } });
    return created;
  });

  // --- Preference MP ---
  const preference = await deps.createPreference({
    orderId: order.id, orderNumber: order.orderNumber,
    items: input.lines.map((l) => ({ title: l.title, quantity: l.line.qty, unit_price: l.line.unitPrice })),
    payerEmail: input.contactEmail,
    appUrl: deps.appUrl,
    notificationUrl: `${deps.appUrl}/api/webhooks/mercadopago`,
  });

  await deps.db.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: order.payments[0].id }, data: { mpPreferenceId: preference.id } });
  });

  return { orderId: order.id, orderNumber: order.orderNumber, initPoint: preference.sandbox_init_point ?? preference.init_point };
}
```

> **Nota:** `checkout-data.ts` (Task 19b inline) provee `getShippingZonesForQuote` y `getFreeShippingThreshold` desde la DB. Crearlo junto a este archivo.

- [ ] **Step 4: Crear `src/lib/orders/checkout-data.ts`** (helpers DB para el orquestador de envío):

```ts
// NOTA: sin `import "server-only"` — lo importa scripts/simulate-mp-webhook.ts (node). Server por importar prisma.
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import type { Zone } from "@/lib/shipping/quote";

export async function getShippingZonesForQuote(): Promise<Zone[]> {
  const zones = await prisma.shippingZone.findMany({ where: { active: true }, orderBy: { order: "asc" } });
  return zones.map((z) => ({
    id: z.id, matchType: z.matchType, provinces: z.provinces,
    cpFrom: z.cpFrom, cpTo: z.cpTo, price: toNumber(z.price), active: z.active, order: z.order,
  }));
}

export async function getFreeShippingThreshold(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { id: "default" } });
  return setting ? toNumber(setting.freeShippingThreshold) : 47500;
}
```

- [ ] **Step 5: Run → PASA + typecheck.** Run: `pnpm vitest run tests/integration/checkout-service.test.ts && pnpm typecheck`

- [ ] **Step 6: Commit**

```bash
git add src/lib/orders/checkout-service.ts src/lib/orders/checkout-data.ts tests/integration/checkout-service.test.ts
git commit -m "feat(m2): checkout service — order+items+payment tx, coupon, shipping, MP preference (TDD)"
```

---

### Task 20: `orders/webhook-service.ts`

**Files:** Create: `src/lib/orders/webhook-service.ts`. Test: `tests/integration/webhook-service.test.ts`.

`processWebhook(input, deps)`: verifica firma → consulta el pago a MP (fuente de verdad) → carga el pedido por `external_reference` → `decideWebhookEffects` → tx idempotente (upsert Payment por `mpPaymentId`, actualiza Order, descuenta stock con `checkAvailability`, `usedCount++`, crea Shipment) → emails. Firma inválida → 401. **Idempotente:** correrlo 2× sobre el mismo pago = 1 solo descuento de stock.

- [ ] **Step 1: Escribir `tests/integration/webhook-service.test.ts`** (fake db con estado en memoria):

```ts
import { describe, it, expect, vi } from "vitest";
import { processWebhook, type ProcessWebhookDeps } from "@/lib/orders/webhook-service";

/** Fake db con estado: 1 pedido pending_payment + variante con stock 5. */
function makeFakeDb() {
  const state = {
    order: {
      id: "ord-1", status: "pending_payment", couponId: "co-1", contactName: "Ana", contactEmail: "ana@example.com",
      shippingMethod: "domicilio", subtotal: 6400, shippingCost: 2500, discountTotal: 640, total: 8260,
      items: [{ variantId: "v1", comboId: null, productNameSnapshot: "Labial", variantNameSnapshot: "Rojo", qty: 2, lineTotal: 6400, combo: null }],
    } as any,
    variants: new Map<string, number>([["v1", 5]]),
    payments: [] as any[],
    couponUsed: 0,
    shipments: [] as any[],
  };
  const db: any = {
    order: {
      findFirst: vi.fn(async () => structuredCloneSafe(state.order)),
      update: vi.fn(async ({ data }: any) => { state.order.status = data.status ?? state.order.status; return state.order; }),
    },
    payment: {
      findUnique: vi.fn(async ({ where }: any) => state.payments.find((p) => p.mpPaymentId === where.mpPaymentId) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = state.payments.find((p) => p.mpPaymentId === where.mpPaymentId);
        if (existing) { Object.assign(existing, update); return existing; }
        const p = { id: `pay-${state.payments.length + 1}`, ...create }; state.payments.push(p); return p;
      }),
    },
    productVariant: {
      findMany: vi.fn(async ({ where }: any) => [...state.variants].filter(([id]) => where.id.in.includes(id)).map(([id, stock]) => ({ id, stock }))),
      update: vi.fn(async ({ where, data }: any) => { state.variants.set(where.id, data.stock.decrement != null ? (state.variants.get(where.id)! - data.stock.decrement) : data.stock); return {}; }),
    },
    coupon: { update: vi.fn(async () => { state.couponUsed++; return {}; }) },
    shipment: { create: vi.fn(async ({ data }: any) => { state.shipments.push(data); return data; }) },
    $transaction: vi.fn(async (fn: any) => fn(db)),
  };
  return { db, state };
}
function structuredCloneSafe<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }

function makeDeps(over: Partial<ProcessWebhookDeps> = {}): ProcessWebhookDeps {
  return {
    db: makeFakeDb().db,
    getPayment: vi.fn(async () => ({ id: "mp-pay-1", status: "approved", external_reference: "ord-1", transaction_amount: 8260 })),
    sendEmail: vi.fn(async () => ({ id: "e1", logged: false })),
    verifySignature: vi.fn(async () => true),
    secret: "s",
    now: new Date("2026-06-04T12:00:00Z"),
    ...over,
  };
}

describe("processWebhook", () => {
  it("firma inválida → 401, sin efectos", async () => {
    const deps = makeDeps({ verifySignature: vi.fn(async () => false) });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "bad", xRequestId: "r" }, deps);
    expect(r.status).toBe(401);
    expect(deps.getPayment).not.toHaveBeenCalled();
  });

  it("approved → paga, descuenta stock, incrementa cupón, manda 2 emails", async () => {
    const { db, state } = makeFakeDb();
    const deps = makeDeps({ db });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.order.status).toBe("paid");
    expect(state.variants.get("v1")).toBe(3); // 5 - 2
    expect(state.couponUsed).toBe(1);
    expect((deps.sendEmail as any).mock.calls.length).toBe(2);
  });

  it("idempotente: el mismo webhook 2× descuenta stock una sola vez", async () => {
    const { db, state } = makeFakeDb();
    const deps = makeDeps({ db });
    await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(state.variants.get("v1")).toBe(3); // sigue 3, no 1
    expect(state.couponUsed).toBe(1);
  });

  it("rejected → no cambia el pedido (reintento), sin descuento", async () => {
    const { db, state } = makeFakeDb();
    const deps = makeDeps({ db, getPayment: vi.fn(async () => ({ id: "mp-pay-1", status: "rejected", external_reference: "ord-1" })) });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
    expect(state.order.status).toBe("pending_payment");
    expect(state.variants.get("v1")).toBe(5);
  });

  it("pedido inexistente → 200 (ack)", async () => {
    const deps = makeDeps({ getPayment: vi.fn(async () => ({ id: "mp-pay-1", status: "approved", external_reference: "no-existe" })), db: { ...makeFakeDb().db, order: { findFirst: vi.fn(async () => null), update: vi.fn() } } as any });
    const r = await processWebhook({ dataId: "mp-pay-1", xSignature: "ok", xRequestId: "r" }, deps);
    expect(r.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/integration/webhook-service.test.ts`

- [ ] **Step 3: Implementar `src/lib/orders/webhook-service.ts`**

```ts
// NOTA: sin `import "server-only"` — lo importa scripts/simulate-mp-webhook.ts (node). Server por importar prisma.
import { prisma } from "@/lib/prisma";
import { verifyMpSignature } from "@/lib/payments/signature";
import { getPayment as realGetPayment, mpStatusToPaymentStatus } from "@/lib/payments/mercadopago";
import { decideWebhookEffects } from "@/lib/payments/webhook-effects";
import { computeStockDecrements, checkAvailability } from "@/lib/orders/stock";
import { sendEmail as realSendEmail } from "@/lib/email/resend";
import { orderConfirmationEmail, newOrderAlertEmail, type OrderEmailData } from "@/lib/email/templates";
import { toNumber } from "@/lib/catalog/pricing";
import type { CartLine } from "@/lib/cart/types";

export interface ProcessWebhookInput {
  dataId: string;
  xSignature: string | null;
  xRequestId: string | null;
}
export interface ProcessWebhookDeps {
  db: any;
  getPayment: typeof realGetPayment;
  sendEmail: typeof realSendEmail;
  verifySignature: (input: { xSignature: string | null; xRequestId: string | null; dataId: string; secret: string }) => Promise<boolean>;
  secret: string;
  ownerEmail?: string;
  now?: Date;
}
export interface ProcessWebhookResult {
  status: 200 | 401;
  detail: string;
}

export function defaultWebhookDeps(): ProcessWebhookDeps {
  return {
    db: prisma,
    getPayment: realGetPayment,
    sendEmail: realSendEmail,
    verifySignature: verifyMpSignature,
    secret: process.env.MP_WEBHOOK_SECRET ?? "",
    ownerEmail: process.env.RESEND_OWNER_EMAIL ?? "",
  };
}

/** Convierte un OrderItem (con snapshots) a CartLine para computar decrementos de stock. */
function orderItemToLine(it: any): CartLine {
  if (it.comboId && it.combo) {
    return { id: it.id ?? it.comboId, kind: "combo", refId: it.comboId, unitPrice: toNumber(it.unitPriceSnapshot), qty: it.qty, weightGr: 0, components: it.combo.items.map((ci: any) => ({ variantId: ci.variantId, qty: ci.qty })) };
  }
  return { id: it.id ?? it.variantId, kind: "variant", refId: it.variantId, unitPrice: toNumber(it.unitPriceSnapshot), qty: it.qty, weightGr: 0 };
}

export async function processWebhook(input: ProcessWebhookInput, deps: ProcessWebhookDeps): Promise<ProcessWebhookResult> {
  // 1. Verificar firma (origen).
  const valid = await deps.verifySignature({ xSignature: input.xSignature, xRequestId: input.xRequestId, dataId: input.dataId, secret: deps.secret });
  if (!valid) return { status: 401, detail: "Firma inválida." };

  // 2. Consultar el pago a MP (fuente de verdad).
  const mpPayment = await deps.getPayment(input.dataId);
  const paymentStatus = mpStatusToPaymentStatus(mpPayment.status);
  const orderId = mpPayment.external_reference;
  if (!orderId) return { status: 200, detail: "Sin external_reference." };

  // 3. Cargar el pedido con items (+ combo items para stock).
  const order = await deps.db.order.findFirst({
    where: { id: orderId },
    include: { items: { include: { combo: { include: { items: true } } } } },
  });
  if (!order) return { status: 200, detail: "Pedido inexistente (ack)." };

  // 4. Decidir efectos (idempotente por Order.status).
  const effects = decideWebhookEffects({ currentOrderStatus: order.status, mpStatus: paymentStatus, hasCoupon: Boolean(order.couponId) });

  let oversoldLines: Array<{ name: string }> = [];

  // 5. Aplicar en tx.
  await deps.db.$transaction(async (tx: any) => {
    await tx.payment.upsert({
      where: { mpPaymentId: String(mpPayment.id) },
      create: { orderId: order.id, provider: "mercadopago", mpPaymentId: String(mpPayment.id), status: effects.updatePaymentTo, amount: mpPayment.transaction_amount ?? toNumber(order.total), rawPayload: mpPayment as unknown as object },
      update: { status: effects.updatePaymentTo, rawPayload: mpPayment as unknown as object },
    });

    if (effects.setOrderStatusTo) {
      await tx.order.update({ where: { id: order.id }, data: { status: effects.setOrderStatusTo } });
    }

    if (effects.decrementStock) {
      const lines = order.items.map(orderItemToLine);
      const decrements = computeStockDecrements(lines);
      const ids = [...decrements.keys()];
      const current = await tx.productVariant.findMany({ where: { id: { in: ids } }, select: { id: true, stock: true } });
      const stockMap = new Map<string, number>(current.map((v: any) => [v.id, v.stock]));
      const avail = checkAvailability(decrements, stockMap);
      for (const [variantId, qty] of decrements) {
        const have = stockMap.get(variantId) ?? 0;
        const dec = Math.min(have, qty); // no bajar de 0 (oversell)
        if (dec > 0) await tx.productVariant.update({ where: { id: variantId }, data: { stock: { decrement: dec } } });
      }
      if (!avail.ok) {
        oversoldLines = order.items
          .filter((it: any) => avail.shortages.some((s) => s.variantId === it.variantId))
          .map((it: any) => ({ name: it.variantNameSnapshot ? `${it.productNameSnapshot} (${it.variantNameSnapshot})` : it.productNameSnapshot }));
      }
      await tx.shipment.create({ data: { orderId: order.id, status: "pending", cost: toNumber(order.shippingCost) } });
    }

    if (effects.incrementCouponUse && order.couponId) {
      await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
    }
  });

  // 6. Emails (fuera de tx).
  if (effects.sendCustomerEmail || effects.sendOwnerEmail) {
    const emailData: OrderEmailData = {
      orderNumber: order.orderNumber, contactName: order.contactName, contactEmail: order.contactEmail,
      items: order.items.map((it: any) => ({ name: it.productNameSnapshot, variantName: it.variantNameSnapshot, qty: it.qty, lineTotal: toNumber(it.lineTotal) })),
      subtotal: toNumber(order.subtotal), shippingCost: toNumber(order.shippingCost), discountTotal: toNumber(order.discountTotal), total: toNumber(order.total),
      shippingMethod: order.shippingMethod,
    };
    if (effects.sendCustomerEmail) {
      const m = orderConfirmationEmail(emailData);
      await deps.sendEmail({ to: order.contactEmail, subject: m.subject, html: m.html, text: m.text });
    }
    if (effects.sendOwnerEmail && deps.ownerEmail) {
      const m = newOrderAlertEmail({ ...emailData, oversoldLines: oversoldLines.length ? oversoldLines : undefined });
      await deps.sendEmail({ to: deps.ownerEmail, subject: m.subject, html: m.html, text: m.text });
    }
  }

  return { status: 200, detail: effects.setOrderStatusTo ?? "sin cambio" };
}
```

- [ ] **Step 4: Run → PASA + typecheck.** Run: `pnpm vitest run tests/integration/webhook-service.test.ts && pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/webhook-service.ts tests/integration/webhook-service.test.ts
git commit -m "feat(m2): webhook service — verify, query MP, idempotent tx (stock/coupon/email) (TDD)"
```

### Task 21: Server Actions + `cartToCheckoutLines`

**Files:** Create: `src/app/(storefront)/actions.ts`. Modify: `src/lib/cart/cart-service.ts` (+ `cartToCheckoutLines`, `loadCurrentCart`). Test: `tests/unit/cart/checkout-lines.test.ts`.

- [ ] **Step 1: Escribir `tests/unit/cart/checkout-lines.test.ts`** (mapping puro cart→checkout lines):

```ts
import { describe, it, expect } from "vitest";
import { cartToCheckoutLines } from "@/lib/cart/cart-service";

const cart = {
  items: [
    { id: "ci1", qty: 2, unitPriceSnapshot: "3200", comboId: null, variantId: "v1",
      variant: { id: "v1", name: "Rojo Pasión", sku: "LAB-0001", priceOverride: null, weightGrOverride: null, product: { id: "p1", name: "Labial Mate", basePrice: "3200", weightGr: 25, categoryId: "c1" } },
      combo: null },
    { id: "ci2", qty: 1, unitPriceSnapshot: "4990", comboId: "combo1", variantId: null,
      variant: null,
      combo: { id: "combo1", name: "Dúo Labios Glam", comboPrice: "4990", items: [{ variantId: "v1", qty: 1, variant: { weightGrOverride: null, product: { weightGr: 25 } } }] } },
  ],
} as any;

describe("cartToCheckoutLines", () => {
  it("genera snapshots y título para variantes y combos", () => {
    const lines = cartToCheckoutLines(cart);
    expect(lines[0]).toMatchObject({ productNameSnapshot: "Labial Mate", variantNameSnapshot: "Rojo Pasión", skuSnapshot: "LAB-0001", title: "Labial Mate — Rojo Pasión" });
    expect(lines[0].line).toMatchObject({ kind: "variant", refId: "v1", unitPrice: 3200, qty: 2 });
    expect(lines[1]).toMatchObject({ productNameSnapshot: "Dúo Labios Glam", variantNameSnapshot: null, skuSnapshot: null, title: "Dúo Labios Glam" });
    expect(lines[1].line.kind).toBe("combo");
  });
});
```

- [ ] **Step 2: Run → FALLA.** Run: `pnpm vitest run tests/unit/cart/checkout-lines.test.ts`

- [ ] **Step 3: Agregar a `src/lib/cart/cart-service.ts`** (al final):

```ts
import type { CheckoutLineInput } from "@/lib/orders/checkout-service";

/** Mapea un carrito cargado a las líneas de checkout (con snapshots y título para MP). */
export function cartToCheckoutLines(cart: CartWithItems): CheckoutLineInput[] {
  return cart.items.map((item) => {
    const line = cartItemToCartLine(item);
    if (item.combo) {
      return { line, productNameSnapshot: item.combo.name, variantNameSnapshot: null, skuSnapshot: null, title: item.combo.name };
    }
    const v = item.variant!;
    return {
      line,
      productNameSnapshot: v.product.name,
      variantNameSnapshot: v.name,
      skuSnapshot: v.sku,
      title: `${v.product.name} — ${v.name}`,
    };
  });
}

/** Carga el carrito de la sesión actual (cookie) con sus líneas. */
export async function loadCurrentCart(): Promise<LoadedCart & { cartId: string | null }> {
  const { getCartIdFromCookie } = await import("@/lib/cart/cart-cookie");
  const cartId = await getCartIdFromCookie();
  const loaded = await loadCart(cartId);
  return { ...loaded, cartId: loaded.cart ? cartId : null };
}
```

- [ ] **Step 4: Run → PASA.** Run: `pnpm vitest run tests/unit/cart/checkout-lines.test.ts`

- [ ] **Step 5: Implementar `src/app/(storefront)/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import {
  loadCart, loadCurrentCart, createCart, addItem, updateItem, removeItem, cartToCheckoutLines,
} from "@/lib/cart/cart-service";
import { getCartIdFromCookie, setCartIdCookie, getCouponCodeFromCookie, setCouponCodeCookie } from "@/lib/cart/cart-cookie";
import { cartSubtotal } from "@/lib/cart/totals";
import { validateCoupon } from "@/lib/coupons/apply";
import { prisma } from "@/lib/prisma";
import { quoteShipping } from "@/lib/shipping/index";
import { getShippingZonesForQuote, getFreeShippingThreshold } from "@/lib/orders/checkout-data";
import { createCheckout, defaultCheckoutDeps } from "@/lib/orders/checkout-service";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function ensureCartId(): Promise<string> {
  const existing = await getCartIdFromCookie();
  if (existing) {
    const cart = await prisma.cart.findUnique({ where: { id: existing }, select: { id: true, status: true } });
    if (cart && cart.status === "active") return existing;
  }
  const id = await createCart();
  await setCartIdCookie(id);
  return id;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function addToCartAction(input: { variantId?: string; comboId?: string; qty?: number }): Promise<ActionResult> {
  try {
    const cartId = await ensureCartId();
    await addItem({ cartId, variantId: input.variantId, comboId: input.comboId, qty: input.qty ?? 1 });
    revalidatePath("/", "layout");
    revalidatePath("/carrito");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo agregar al carrito." };
  }
}

export async function updateCartItemAction(itemId: string, qty: number): Promise<ActionResult> {
  await updateItem(itemId, qty);
  revalidatePath("/", "layout");
  revalidatePath("/carrito");
  return { ok: true };
}

export async function removeCartItemAction(itemId: string): Promise<ActionResult> {
  await removeItem(itemId);
  revalidatePath("/", "layout");
  revalidatePath("/carrito");
  return { ok: true };
}

export async function applyCouponAction(code: string): Promise<ActionResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Ingresá un código." };
  const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon) return { ok: false, error: "Cupón inexistente." };
  const cartId = await getCartIdFromCookie();
  const { lines } = await loadCart(cartId);
  const subtotal = cartSubtotal(lines);
  const v = validateCoupon(coupon, { subtotal, now: new Date() });
  if (!v.ok) return { ok: false, error: v.reason };
  await setCouponCodeCookie(normalized);
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  return { ok: true };
}

export async function removeCouponAction(): Promise<ActionResult> {
  await setCouponCodeCookie(null);
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  return { ok: true };
}

export interface QuoteResult extends ActionResult {
  cost?: number;
  free?: boolean;
  source?: string;
}
export async function quoteShippingAction(input: { cp: string; province?: string; method: "domicilio" | "sucursal" }): Promise<QuoteResult> {
  if (!/^\d{4}$/.test(input.cp)) return { ok: false, error: "CP inválido (4 dígitos)." };
  const cartId = await getCartIdFromCookie();
  const { lines } = await loadCart(cartId);
  if (lines.length === 0) return { ok: false, error: "El carrito está vacío." };
  const subtotal = cartSubtotal(lines);
  const quote = await quoteShipping(
    { cp: input.cp, province: input.province ?? null, method: input.method, lines, subtotal },
    { getZones: getShippingZonesForQuote, getThreshold: getFreeShippingThreshold },
  );
  return { ok: true, cost: quote.cost, free: quote.free, source: quote.source };
}

export interface CheckoutResult extends ActionResult {
  initPoint?: string;
  orderNumber?: string;
}
export async function createCheckoutAction(input: {
  contactName: string; contactEmail: string; contactPhone: string;
  shippingMethod: "domicilio" | "sucursal";
  address: { cp: string; province?: string; street?: string; number?: string; floorApt?: string; city?: string; notes?: string };
}): Promise<CheckoutResult> {
  try {
    const { cart, cartId } = await loadCurrentCart();
    if (!cart || cart.items.length === 0) return { ok: false, error: "Tu carrito está vacío." };
    const lines = cartToCheckoutLines(cart);
    const couponCode = await getCouponCodeFromCookie();
    const result = await createCheckout(
      {
        contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone,
        shippingMethod: input.shippingMethod, address: input.address, lines, couponCode, cartId,
      },
      defaultCheckoutDeps(appUrl()),
    );
    return { ok: true, initPoint: result.initPoint, orderNumber: result.orderNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo iniciar el pago." };
  }
}
```

- [ ] **Step 6: typecheck.** Run: `pnpm typecheck`
Expected: verde. (Si hay import circular cart-service ↔ checkout-service por el tipo `CheckoutLineInput`, mantener el `import type` — es solo tipo, no runtime.)

- [ ] **Step 7: Commit**

```bash
git add src/app/(storefront)/actions.ts src/lib/cart/cart-service.ts tests/unit/cart/checkout-lines.test.ts
git commit -m "feat(m2): server actions (cart/coupon/shipping/checkout) + checkout-line mapping (TDD)"
```

---

### Task 22: Route handler del webhook MP

**Files:** Create: `src/app/api/webhooks/mercadopago/route.ts`.

POST que extrae `data.id` (query o body) + headers de firma, llama `processWebhook` con deps reales, y responde con el status. **Siempre 200** salvo firma inválida (401) → corta los reintentos de MP.

- [ ] **Step 1: Implementar `src/app/api/webhooks/mercadopago/route.ts`**

```ts
import { NextResponse } from "next/server";
import { processWebhook, defaultWebhookDeps } from "@/lib/orders/webhook-service";

/** Webhook de Mercado Pago (blueprint 04 §2/§7). Verifica firma + consulta el pago a MP. */
export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  let dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // MP a veces postea sin body parseable; el data.id de la query alcanza.
  }
  if (!dataId && body && typeof body === "object" && "data" in body) {
    const data = (body as { data?: { id?: string | number } }).data;
    if (data?.id != null) dataId = String(data.id);
  }

  // Ignorar notificaciones que no son de pago (ej. merchant_order) sin id de pago.
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? (body as { type?: string } | null)?.type;
  if (!dataId || (type && type !== "payment")) {
    return NextResponse.json({ ok: true, detail: "ignored" }, { status: 200 });
  }

  const result = await processWebhook(
    { dataId, xSignature: request.headers.get("x-signature"), xRequestId: request.headers.get("x-request-id") },
    defaultWebhookDeps(),
  );
  return NextResponse.json({ ok: result.status === 200, detail: result.detail }, { status: result.status });
}
```

- [ ] **Step 2: typecheck + build parcial.** Run: `pnpm typecheck`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/mercadopago/route.ts
git commit -m "feat(m2): MP webhook route handler (signature-gated, always-200 ack)"
```

## FASE 4 — UI

> UI = "verify by build/e2e" (no TDD unit por componente). Tras cada task: `pnpm typecheck`. La verificación visual real es la e2e (Task 35) + checklist manual (Task 37).

### Task 23: shadcn `RadioGroup`

**Files:** Create: `src/components/ui/radio-group.tsx`.

- [ ] **Step 1: Implementar `src/components/ui/radio-group.tsx`**

```tsx
"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square size-5 rounded-full border-2 border-border text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary",
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <Circle className="size-2.5 fill-primary text-primary" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
```

- [ ] **Step 2: typecheck + commit.**

```bash
pnpm typecheck
git add src/components/ui/radio-group.tsx
git commit -m "feat(m2): shadcn RadioGroup component"
```

---

### Task 24: `cart-view` + cluster de UI del carrito

**Files:** Create: `src/lib/cart/cart-view.ts`, `src/components/cart/cart-provider.tsx`, `cart-button.tsx`, `cart-drawer.tsx`, `cart-contents.tsx`, `cart-line-item.tsx`, `cart-summary.tsx`, `free-shipping-bar.tsx`, `coupon-input.tsx`, `empty-cart.tsx`.

`cart-view.ts` (server, `cache()`-deduped) es la fuente única de la vista del carrito (líneas + count + subtotal + cupón preview + umbral). La consumen header, drawer y `/carrito`.

- [ ] **Step 1: `src/lib/cart/cart-view.ts`**

```ts
import "server-only";
import { cache } from "react";
import { loadCurrentCart, type CartWithItems } from "@/lib/cart/cart-service";
import { cartSubtotal, cartItemCount } from "@/lib/cart/totals";
import { getCouponCodeFromCookie } from "@/lib/cart/cart-cookie";
import { getFreeShippingThreshold } from "@/lib/orders/checkout-data";
import { prisma } from "@/lib/prisma";
import { validateCoupon, applyCoupon } from "@/lib/coupons/apply";
import type { CartLine } from "@/lib/cart/types";

export interface CartCouponPreview {
  code: string;
  discount: number;
  freeShipping: boolean;
}
export interface CartView {
  cart: CartWithItems | null;
  lines: CartLine[];
  count: number;
  subtotal: number;
  threshold: number;
  coupon: CartCouponPreview | null;
}

/** Vista del carrito de la sesión (deduplicada por request con React cache). */
export const getCartView = cache(async (): Promise<CartView> => {
  const { cart, lines } = await loadCurrentCart();
  const subtotal = cartSubtotal(lines);
  const threshold = await getFreeShippingThreshold();

  let coupon: CartCouponPreview | null = null;
  const code = await getCouponCodeFromCookie();
  if (code && lines.length > 0) {
    const row = await prisma.coupon.findUnique({ where: { code } });
    if (row && validateCoupon(row, { subtotal, now: new Date() }).ok) {
      const res = applyCoupon(row, lines);
      coupon = { code, discount: res.discount, freeShipping: res.freeShipping };
    }
  }
  return { cart, lines, count: cartItemCount(lines), subtotal, threshold, coupon };
});
```

- [ ] **Step 2: `src/components/cart/cart-provider.tsx`** (contexto open/close):

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface CartUI {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  setOpen: (v: boolean) => void;
}
const CartContext = createContext<CartUI | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <CartContext.Provider value={{ open, openCart: () => setOpen(true), closeCart: () => setOpen(false), setOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCartUI(): CartUI {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartUI debe usarse dentro de CartProvider");
  return ctx;
}
```

- [ ] **Step 3: `src/components/cart/cart-button.tsx`** (ícono + badge, abre drawer):

```tsx
"use client";

import { ShoppingBag } from "lucide-react";
import { useCartUI } from "@/components/cart/cart-provider";
import { cn } from "@/lib/utils";

export function CartButton({ count, className }: { count: number; className?: string }) {
  const { openCart } = useCartUI();
  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Carrito${count > 0 ? ` (${count})` : ""}`}
      className={cn("relative grid size-11 place-items-center rounded-full hover:bg-muted", className)}
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: `src/components/cart/cart-drawer.tsx`** (Sheet controlado por contexto, contenido server por children):

```tsx
"use client";

import { type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCartUI } from "@/components/cart/cart-provider";

export function CartDrawer({ children }: { children: ReactNode }) {
  const { open, setOpen } = useCartUI();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">Tu carrito</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 5: `src/components/cart/free-shipping-bar.tsx`**:

```tsx
import { formatARS } from "@/lib/money";
import { Truck } from "lucide-react";

export function FreeShippingBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  if (threshold <= 0) return null;
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Truck className="size-4 text-primary" aria-hidden />
        {remaining > 0 ? <>Te faltan <strong>{formatARS(remaining)}</strong> para el envío gratis</> : <>¡Tenés envío gratis! 🎉</>}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `src/components/cart/cart-line-item.tsx`** (qty stepper + remove → actions):

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { formatARS } from "@/lib/money";
import { QuantityStepper } from "@/components/catalog/quantity-stepper";
import { updateCartItemAction, removeCartItemAction } from "@/app/(storefront)/actions";

export interface CartLineItemView {
  id: string;
  name: string;
  variantName?: string | null;
  unitPrice: number;
  qty: number;
  image?: string | null;
}

export function CartLineItem({ item }: { item: CartLineItemView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setQty = (qty: number) =>
    startTransition(async () => {
      await updateCartItemAction(item.id, qty);
      router.refresh();
    });
  const remove = () =>
    startTransition(async () => {
      await removeCartItemAction(item.id);
      router.refresh();
    });

  return (
    <div className="flex gap-3 py-3" data-pending={pending ? "" : undefined}>
      <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.image ? <img src={item.image} alt={item.name} className="size-full object-cover" /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium leading-tight">{item.name}</p>
            {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
          </div>
          <button type="button" onClick={remove} disabled={pending} aria-label="Eliminar" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <QuantityStepper initial={item.qty} max={99} onChange={setQty} />
          <span className="text-sm font-semibold tabular-nums">{formatARS(item.unitPrice * item.qty)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `src/components/cart/coupon-input.tsx`** (aplica/quita cupón):

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { applyCouponAction, removeCouponAction } from "@/app/(storefront)/actions";

export function CouponInput({ applied }: { applied: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = () =>
    startTransition(async () => {
      setError(null);
      const r = await applyCouponAction(code);
      if (!r.ok) setError(r.error ?? "No se pudo aplicar.");
      else { setCode(""); router.refresh(); }
    });
  const remove = () =>
    startTransition(async () => {
      await removeCouponAction();
      router.refresh();
    });

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
        <span>Cupón <strong>{applied}</strong> aplicado</span>
        <button type="button" onClick={remove} disabled={pending} className="text-xs text-primary hover:underline">Quitar</button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Cupón" aria-label="Código de cupón" className="uppercase" />
        <Button type="button" variant="outline" onClick={apply} disabled={pending || !code.trim()}>Aplicar</Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 8: `src/components/cart/cart-summary.tsx`**:

```tsx
import { formatARS } from "@/lib/money";

export interface CartSummaryProps {
  subtotal: number;
  discount: number;
  shippingCost: number | null; // null = "se calcula en checkout"
  total: number;
  freeShipping?: boolean;
}

export function CartSummary({ subtotal, discount, shippingCost, total, freeShipping }: CartSummaryProps) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatARS(subtotal)}</dd></div>
      {discount > 0 && (
        <div className="flex justify-between text-primary"><dt>Descuento</dt><dd className="tabular-nums">−{formatARS(discount)}</dd></div>
      )}
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Envío</dt>
        <dd className="tabular-nums">{freeShipping ? "Gratis" : shippingCost == null ? "A calcular" : formatARS(shippingCost)}</dd>
      </div>
      <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
        <dt>Total</dt><dd className="tabular-nums">{formatARS(total)}</dd>
      </div>
    </dl>
  );
}
```

- [ ] **Step 9: `src/components/cart/empty-cart.tsx`**:

```tsx
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <ShoppingBag className="size-12 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-display text-lg">Tu carrito está vacío</p>
        <p className="text-sm text-muted-foreground">Sumá tus productos favoritos y volvé.</p>
      </div>
      <Button asChild><Link href="/tienda">Ir a la tienda</Link></Button>
    </div>
  );
}
```

- [ ] **Step 10: `src/components/cart/cart-contents.tsx`** (server — contenido del drawer):

```tsx
import Link from "next/link";
import { getCartView } from "@/lib/cart/cart-view";
import { round2 } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { FreeShippingBar } from "@/components/cart/free-shipping-bar";
import { CartSummary } from "@/components/cart/cart-summary";
import { EmptyCart } from "@/components/cart/empty-cart";

/** Contenido del carrito para el drawer (server component, se refresca con router.refresh). */
export async function CartContents() {
  const { cart, subtotal, count, threshold, coupon } = await getCartView();
  if (!cart || count === 0) return <EmptyCart />;

  const discount = coupon?.discount ?? 0;
  const total = round2(subtotal - discount);

  return (
    <div className="flex h-full flex-col gap-4">
      <FreeShippingBar subtotal={subtotal} threshold={threshold} />
      <div className="flex-1 divide-y divide-border">
        {cart.items.map((item) => (
          <CartLineItem
            key={item.id}
            item={{
              id: item.id,
              name: item.combo ? item.combo.name : item.variant!.product.name,
              variantName: item.combo ? null : item.variant!.name,
              unitPrice: Number(item.unitPriceSnapshot),
              qty: item.qty,
              image: item.combo ? item.combo.images[0] ?? null : item.variant!.image ?? item.variant!.product.images[0] ?? null,
            }}
          />
        ))}
      </div>
      <Separator />
      <CartSummary subtotal={subtotal} discount={discount} shippingCost={null} total={total} freeShipping={coupon?.freeShipping} />
      <div className="grid gap-2">
        <Button asChild size="lg"><Link href="/checkout">Iniciar compra</Link></Button>
        <Button asChild variant="outline"><Link href="/carrito">Ver carrito</Link></Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: typecheck + commit.**

```bash
pnpm typecheck
git add src/lib/cart/cart-view.ts src/components/cart
git commit -m "feat(m2): cart view + drawer UI cluster (provider, button, drawer, line item, coupon, summary)"
```

### Task 25: `add-to-cart.tsx` (wiring de la ficha)

**Files:** Create: `src/components/cart/add-to-cart.tsx`. Modify: `src/app/(storefront)/producto/[slug]/page.tsx`.

Componente client que reúne `VariantSwatchSelector` (onChange) + `QuantityStepper` (onChange) + botón "Agregar al carrito" → `addToCartAction` → abre el drawer + `router.refresh()`.

- [ ] **Step 1: Implementar `src/components/cart/add-to-cart.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VariantSwatchSelector } from "@/components/catalog/variant-swatch-selector";
import { QuantityStepper } from "@/components/catalog/quantity-stepper";
import { useCartUI } from "@/components/cart/cart-provider";
import { addToCartAction } from "@/app/(storefront)/actions";
import type { CatalogVariant } from "@/lib/catalog/types";

export function AddToCart({ variants }: { variants: CatalogVariant[] }) {
  const router = useRouter();
  const { openCart } = useCartUI();
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState<string | undefined>(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = variants.find((v) => v.id === variantId) ?? firstAvailable;
  const outOfStock = !selected || selected.stock <= 0;

  const add = () =>
    startTransition(async () => {
      setError(null);
      if (!variantId) { setError("Elegí un tono."); return; }
      const r = await addToCartAction({ variantId, qty });
      if (!r.ok) { setError(r.error ?? "No se pudo agregar."); return; }
      router.refresh();
      openCart();
    });

  return (
    <div className="space-y-4">
      {variants.length > 0 && <VariantSwatchSelector variants={variants} onChange={(v) => setVariantId(v.id)} />}
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper max={Math.max(1, selected?.stock ?? 99)} onChange={setQty} />
        <Button size="lg" className="flex-1" onClick={add} disabled={pending || outOfStock}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
          {outOfStock ? "Sin stock" : "Agregar al carrito"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Modificar `src/app/(storefront)/producto/[slug]/page.tsx`** — reemplazar el bloque del selector + botón disabled. Quitar imports `VariantSwatchSelector`, `QuantityStepper`, `Button` (si quedan sin uso) y agregar `AddToCart`. Reemplazar:

```tsx
          {product.variants.length > 0 && <VariantSwatchSelector variants={product.variants} />}

          <div className="flex flex-wrap items-center gap-3">
            <QuantityStepper max={99} />
            <Button size="lg" className="flex-1" disabled title="Disponible próximamente">
              Agregar al carrito
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">El carrito estará disponible muy pronto.</p>
```

por:

```tsx
          <AddToCart variants={product.variants} />
```

Y en los imports, reemplazar las líneas de `VariantSwatchSelector`, `QuantityStepper` y `Button` por:

```tsx
import { AddToCart } from "@/components/cart/add-to-cart";
```

(Mantener `PriceTag`, `ProductGallery`, `CatalogBreadcrumbs`, etc.)

- [ ] **Step 3: typecheck + commit.**

```bash
pnpm typecheck
git add src/components/cart/add-to-cart.tsx "src/app/(storefront)/producto/[slug]/page.tsx"
git commit -m "feat(m2): wire add-to-cart on product page (variant + qty + drawer)"
```

---

### Task 26: Página `/carrito`

**Files:** Create: `src/app/(storefront)/carrito/page.tsx`.

- [ ] **Step 1: Implementar `src/app/(storefront)/carrito/page.tsx`**

```tsx
import type { Metadata } from "next";
import { getCartView } from "@/lib/cart/cart-view";
import { round2 } from "@/lib/money";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { FreeShippingBar } from "@/components/cart/free-shipping-bar";
import { CouponInput } from "@/components/cart/coupon-input";
import { CartSummary } from "@/components/cart/cart-summary";
import { EmptyCart } from "@/components/cart/empty-cart";

export const metadata: Metadata = { title: "Tu carrito — Glamify Makeup" };

export default async function CarritoPage() {
  const { cart, subtotal, count, threshold, coupon } = await getCartView();

  if (!cart || count === 0) {
    return (
      <div className="mx-auto max-w-md py-8">
        <h1 className="mb-6 font-display text-2xl font-bold">Tu carrito</h1>
        <EmptyCart />
      </div>
    );
  }

  const discount = coupon?.discount ?? 0;
  const total = round2(subtotal - discount);

  return (
    <div className="mx-auto max-w-4xl py-6">
      <h1 className="mb-6 font-display text-2xl font-bold">Tu carrito ({count})</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <FreeShippingBar subtotal={subtotal} threshold={threshold} />
          <div className="divide-y divide-border rounded-2xl border border-border px-4">
            {cart.items.map((item) => (
              <CartLineItem
                key={item.id}
                item={{
                  id: item.id,
                  name: item.combo ? item.combo.name : item.variant!.product.name,
                  variantName: item.combo ? null : item.variant!.name,
                  unitPrice: Number(item.unitPriceSnapshot),
                  qty: item.qty,
                  image: item.combo ? item.combo.images[0] ?? null : item.variant!.image ?? item.variant!.product.images[0] ?? null,
                }}
              />
            ))}
          </div>
        </div>
        <aside className="space-y-4 rounded-2xl border border-border p-5 lg:sticky lg:top-20 lg:self-start">
          <CouponInput applied={coupon?.code ?? null} />
          <Separator />
          <CartSummary subtotal={subtotal} discount={discount} shippingCost={null} total={total} freeShipping={coupon?.freeShipping} />
          <p className="text-xs text-muted-foreground">El envío se calcula en el checkout según tu código postal.</p>
          <Button asChild size="lg" className="w-full"><Link href="/checkout">Iniciar compra</Link></Button>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: typecheck + commit.**

```bash
pnpm typecheck
git add "src/app/(storefront)/carrito/page.tsx"
git commit -m "feat(m2): /carrito page (lines, coupon, free-shipping bar, summary)"
```

### Task 27: Checkout de un paso (`/checkout` + form)

**Files:** Create: `src/app/(storefront)/checkout/page.tsx`, `src/app/(storefront)/checkout/checkout-form.tsx`, `src/lib/ar-provinces.ts`.

- [ ] **Step 1: `src/lib/ar-provinces.ts`**

```ts
/** Provincias de Argentina (para el selector de envío y match de zonas). */
export const AR_PROVINCES = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos",
  "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro",
  "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero",
  "Tierra del Fuego", "Tucumán",
] as const;
```

- [ ] **Step 2: `src/app/(storefront)/checkout/page.tsx`** (server — guard de carrito vacío + summary):

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCartView } from "@/lib/cart/cart-view";
import { CheckoutForm } from "@/app/(storefront)/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout — Glamify Makeup" };

export default async function CheckoutPage() {
  const { cart, count, subtotal, coupon } = await getCartView();
  if (!cart || count === 0) redirect("/carrito");

  return (
    <div className="mx-auto max-w-4xl py-6">
      <h1 className="mb-6 font-display text-2xl font-bold">Finalizá tu compra</h1>
      <CheckoutForm
        subtotal={subtotal}
        discount={coupon?.discount ?? 0}
        couponCode={coupon?.code ?? null}
        couponFreeShipping={coupon?.freeShipping ?? false}
        items={cart.items.map((item) => ({
          id: item.id,
          name: item.combo ? item.combo.name : item.variant!.product.name,
          variantName: item.combo ? null : item.variant!.name,
          qty: item.qty,
          unitPrice: Number(item.unitPriceSnapshot),
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: `src/app/(storefront)/checkout/checkout-form.tsx`** (client):

```tsx
"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { formatARS, round2 } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CartSummary } from "@/components/cart/cart-summary";
import { AR_PROVINCES } from "@/lib/ar-provinces";
import { quoteShippingAction, createCheckoutAction } from "@/app/(storefront)/actions";

interface ItemView { id: string; name: string; variantName: string | null; qty: number; unitPrice: number }
interface Props {
  subtotal: number;
  discount: number;
  couponCode: string | null;
  couponFreeShipping: boolean;
  items: ItemView[];
}

type Method = "domicilio" | "sucursal";

export function CheckoutForm({ subtotal, discount, couponFreeShipping, items }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<Method>("domicilio");
  const [province, setProvince] = useState("Buenos Aires");
  const [cp, setCp] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [floorApt, setFloorApt] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const [shipping, setShipping] = useState<{ cost: number; free: boolean } | null>(null);
  const [quoting, startQuote] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const shippingCost = couponFreeShipping ? 0 : shipping?.free ? 0 : shipping?.cost ?? null;
  const total = round2(subtotal - discount + (shippingCost ?? 0));

  const quote = () => {
    if (!/^\d{4}$/.test(cp)) { setShipping(null); return; }
    startQuote(async () => {
      const r = await quoteShippingAction({ cp, province, method });
      if (r.ok) setShipping({ cost: r.cost ?? 0, free: Boolean(r.free) });
      else setShipping(null);
    });
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Ingresá tu nombre.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Email inválido.";
    if (!phone.trim()) return "Ingresá un teléfono.";
    if (!/^\d{4}$/.test(cp)) return "Código postal inválido (4 dígitos).";
    if (method === "domicilio" && (!street.trim() || !number.trim())) return "Completá calle y número.";
    if (shippingCost == null) return "Calculá el envío con tu código postal.";
    return null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    startSubmit(async () => {
      const r = await createCheckoutAction({
        contactName: name, contactEmail: email, contactPhone: phone,
        shippingMethod: method,
        address: { cp, province, street, number, floorApt, city, notes },
      });
      if (r.ok && r.initPoint) window.location.href = r.initPoint;
      else setError(r.error ?? "No se pudo iniciar el pago.");
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="mb-1 font-display text-lg">Contacto</legend>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" aria-label="Nombre" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="Email" autoComplete="email" aria-label="Email" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="Teléfono" autoComplete="tel" aria-label="Teléfono" />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 font-display text-lg">Entrega</legend>
          <RadioGroup value={method} onValueChange={(v) => { setMethod(v as Method); setShipping(null); }} className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm has-[:checked]:border-primary">
              <RadioGroupItem value="domicilio" /> Envío a domicilio
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm has-[:checked]:border-primary">
              <RadioGroupItem value="sucursal" /> Sucursal de Correo
            </label>
          </RadioGroup>

          <div className="grid grid-cols-2 gap-3">
            <select value={province} onChange={(e) => { setProvince(e.target.value); setShipping(null); }} aria-label="Provincia" className="h-11 rounded-xl border border-border bg-background px-3 text-sm">
              {AR_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex gap-2">
              <Input value={cp} onChange={(e) => { setCp(e.target.value.replace(/\D/g, "").slice(0, 4)); setShipping(null); }} onBlur={quote} inputMode="numeric" placeholder="CP" aria-label="Código postal" />
              <Button type="button" variant="outline" onClick={quote} disabled={quoting || cp.length !== 4}>
                {quoting ? <Loader2 className="size-4 animate-spin" /> : "Calcular"}
              </Button>
            </div>
          </div>

          {method === "domicilio" && (
            <div className="grid grid-cols-2 gap-3">
              <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Calle" autoComplete="address-line1" aria-label="Calle" />
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Número" aria-label="Número" />
              <Input value={floorApt} onChange={(e) => setFloorApt(e.target.value)} placeholder="Piso / Depto (opcional)" aria-label="Piso/Depto" />
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Localidad" autoComplete="address-level2" aria-label="Localidad" />
            </div>
          )}
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para la entrega (opcional)" aria-label="Notas" />
          {shipping && <p className="text-sm text-muted-foreground">Envío: {shipping.free ? "Gratis 🎉" : formatARS(shippingCost ?? 0)}</p>}
        </fieldset>
      </div>

      <aside className="space-y-4 rounded-2xl border border-border p-5 lg:sticky lg:top-20 lg:self-start">
        <h2 className="font-display text-lg">Resumen</h2>
        <ul className="space-y-1 text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{it.name}{it.variantName ? ` — ${it.variantName}` : ""} × {it.qty}</span>
              <span className="tabular-nums">{formatARS(it.unitPrice * it.qty)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        <CartSummary subtotal={subtotal} discount={discount} shippingCost={shippingCost} total={total} freeShipping={couponFreeShipping || shipping?.free} />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Pagar con Mercado Pago
        </Button>
        <p className="text-center text-xs text-muted-foreground">Pago seguro. Te redirigimos a Mercado Pago.</p>
      </aside>
    </form>
  );
}
```

- [ ] **Step 4: typecheck + commit.**

```bash
pnpm typecheck
git add "src/app/(storefront)/checkout/page.tsx" "src/app/(storefront)/checkout/checkout-form.tsx" src/lib/ar-provinces.ts
git commit -m "feat(m2): one-step checkout page + form (contact, delivery, CP quote, MP submit)"
```

---

### Task 28: Página `/checkout/gracias`

**Files:** Create: `src/app/(storefront)/checkout/gracias/page.tsx`.

Lee el `external_reference` (orderId) del query de MP, carga el pedido y muestra confirmación + estado + WhatsApp. Robusto si el webhook todavía no llegó (estado `pending_payment` → "estamos confirmando tu pago").

- [ ] **Step 1: Implementar `src/app/(storefront)/checkout/gracias/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "¡Gracias por tu compra! — Glamify Makeup" };

export default async function GraciasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const orderId = sp["external_reference"] ?? sp["external_reference[]"];
  const order = orderId ? await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } }) : null;

  const paid = order?.status === "paid" || order?.status === "preparing" || order?.status === "shipped" || order?.status === "delivered";

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      {paid ? <CheckCircle2 className="mx-auto size-14 text-primary" /> : <Clock className="mx-auto size-14 text-muted-foreground" />}
      <h1 className="mt-4 font-display text-2xl font-bold">{paid ? "¡Gracias por tu compra! 💄" : "Estamos confirmando tu pago"}</h1>

      {order ? (
        <>
          <p className="mt-2 text-muted-foreground">
            Pedido <strong className="text-foreground">{order.orderNumber}</strong>
            {!paid && " — apenas se acredite te llega el email de confirmación."}
          </p>
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border p-5 text-left text-sm">
            <ul className="space-y-1">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{it.productNameSnapshot}{it.variantNameSnapshot ? ` — ${it.variantNameSnapshot}` : ""} × {it.qty}</span>
                  <span className="tabular-nums">{formatARS(Number(it.lineTotal))}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold">
              <span>Total</span><span className="tabular-nums">{formatARS(Number(order.total))}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-muted-foreground">Si completaste el pago, te enviaremos la confirmación por email.</p>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button asChild><Link href="/tienda">Seguir comprando</Link></Button>
        <a href="https://wa.me/5491100000000" className="text-sm text-primary hover:underline" target="_blank" rel="noopener noreferrer">
          ¿Dudas? Escribinos por WhatsApp
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: typecheck + commit.**

```bash
pnpm typecheck
git add "src/app/(storefront)/checkout/gracias/page.tsx"
git commit -m "feat(m2): /checkout/gracias confirmation page (reads MP external_reference)"
```

### Task 29: Wiring — layout (CartProvider + drawer), header (CartButton), bottom-nav

**Files:** Modify: `src/app/(storefront)/layout.tsx`, `src/components/layout/site-header.tsx`, `src/components/layout/bottom-nav.tsx`.

- [ ] **Step 1: Reescribir `src/app/(storefront)/layout.tsx`** (async, envuelve en CartProvider, monta drawer):

```tsx
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartContents } from "@/components/cart/cart-contents";
import { getCartView } from "@/lib/cart/cart-view";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const { count } = await getCartView();
  return (
    <CartProvider>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="container flex-1 pb-20 pt-4 md:pb-8">{children}</main>
        <SiteFooter />
        <BottomNav cartCount={count} />
      </div>
      <CartDrawer>
        <CartContents />
      </CartDrawer>
    </CartProvider>
  );
}
```

- [ ] **Step 2: Reescribir `src/components/layout/site-header.tsx`** (agrega CartButton con count):

```tsx
import Link from "next/link";
import { CategoryNav } from "@/components/layout/category-nav";
import { CartButton } from "@/components/cart/cart-button";
import { getCategoryTree } from "@/lib/catalog/queries";
import { getCartView } from "@/lib/cart/cart-view";

export async function SiteHeader() {
  const [tree, { count }] = await Promise.all([getCategoryTree(), getCartView()]);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-2xl font-bold tracking-tight text-primary">
          Glamify
        </Link>
        <CategoryNav tree={tree} />
        <div className="flex items-center gap-1">
          <Link href="/tienda" className="hidden text-sm font-medium hover:text-primary sm:inline">
            Tienda
          </Link>
          <CartButton count={count} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Reescribir `src/components/layout/bottom-nav.tsx`** (Carrito abre el drawer + badge):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, Search, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartUI } from "@/components/cart/cart-provider";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, enabled: true },
  { href: "/tienda", label: "Tienda", icon: Store, enabled: true },
  { href: "#", label: "Buscar", icon: Search, enabled: false },
  { href: "/carrito", label: "Carrito", icon: ShoppingBag, enabled: true },
  { href: "#", label: "Cuenta", icon: User, enabled: false },
];

export function BottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();
  const { openCart } = useCartUI();

  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const isCart = item.label === "Carrito";
          const active = item.enabled && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
          const Icon = item.icon;
          const content = (
            <span className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" aria-hidden />
              {isCart && cartCount > 0 && (
                <span className="absolute right-1/4 top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground tabular-nums">{cartCount}</span>
              )}
              {item.label}
            </span>
          );

          if (isCart) {
            return (
              <li key={item.label}>
                <button type="button" onClick={openCart} aria-label={`Carrito${cartCount > 0 ? ` (${cartCount})` : ""}`} className="w-full">
                  {content}
                </button>
              </li>
            );
          }
          return (
            <li key={item.label}>
              {item.enabled ? (
                <Link href={item.href} aria-current={active ? "page" : undefined}>{content}</Link>
              ) : (
                <span aria-disabled="true" title="Próximamente" className="cursor-not-allowed opacity-50">
                  {content}<span className="sr-only">Próximamente</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: typecheck + build (valida que toda la UI compila con RSC + Server Actions)**

Run: `pnpm typecheck && pnpm build`
Expected: typecheck verde; `next build` compila. Las páginas con `cookies()`/datos de carrito quedan dinámicas (esperado).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(storefront)/layout.tsx" src/components/layout/site-header.tsx src/components/layout/bottom-nav.tsx
git commit -m "feat(m2): wire CartProvider, drawer, header cart button, bottom-nav cart"
```

## FASE 5 — Integración, simulación, e2e, verificación

### Task 30: `scripts/simulate-mp-webhook.ts` (verificación del DoD sin túnel)

**Files:** Create: `scripts/simulate-mp-webhook.ts`. Modify: `package.json` (script `sim:webhook`).

Ejercita el path `approved` real contra la **dev DB**: crea un pedido (preference fake), corre el webhook 2× con **firma válida** y `getPayment` fake → prueba que el stock baja **una sola vez** (idempotencia), que el cupón no se duplica y que el email se loguea/manda. Esta es la evidencia automatizada del DoD.

- [ ] **Step 1: Agregar el script a `package.json`** (en `scripts`):

```json
    "sim:webhook": "tsx scripts/simulate-mp-webhook.ts",
```

- [ ] **Step 2: Implementar `scripts/simulate-mp-webhook.ts`**

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHmac } from "node:crypto";
import { createCheckout } from "../src/lib/orders/checkout-service";
import { processWebhook } from "../src/lib/orders/webhook-service";
import { getShippingZonesForQuote, getFreeShippingThreshold } from "../src/lib/orders/checkout-data";
import { quoteShipping } from "../src/lib/shipping/index";
import { sendEmail } from "../src/lib/email/resend";
import { verifyMpSignature } from "../src/lib/payments/signature";
import { toNumber } from "../src/lib/catalog/pricing";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SECRET = process.env.MP_WEBHOOK_SECRET || "dev_webhook_secret";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function buildSignature(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${createHmac("sha256", SECRET).update(manifest).digest("hex")}`;
}

async function main(): Promise<void> {
  const qty = 2;
  const variant = await prisma.productVariant.findFirst({ where: { stock: { gt: qty }, active: true }, include: { product: true } });
  if (!variant) throw new Error("No hay variante con stock suficiente para simular. Corré `pnpm db:seed`.");
  const stockBefore = variant.stock;

  // 1) Crear pedido (preference fake; resto real contra la DB).
  const line = {
    id: "sim", kind: "variant" as const, refId: variant.id,
    unitPrice: toNumber(variant.priceOverride ?? variant.product.basePrice), qty,
    weightGr: variant.weightGrOverride ?? variant.product.weightGr,
    productId: variant.productId, categoryId: variant.product.categoryId,
  };
  const { orderId, orderNumber } = await createCheckout(
    {
      contactName: "Simulación", contactEmail: "sim@example.com", contactPhone: "1100000000",
      shippingMethod: "domicilio", address: { cp: "1414", province: "CABA", street: "Calle", number: "1", city: "CABA" },
      lines: [{ line, productNameSnapshot: variant.product.name, variantNameSnapshot: variant.name, skuSnapshot: variant.sku, title: `${variant.product.name} — ${variant.name}` }],
      couponCode: null,
    },
    {
      db: prisma as any,
      nextOrderSeq: async (tx: any) => Number((await tx.$queryRawUnsafe("SELECT nextval('order_number_seq') AS seq"))[0].seq),
      createPreference: async () => ({ id: "pref-sim", init_point: "sim", sandbox_init_point: "sim" }),
      quoteShipping: (i) => quoteShipping(i, { getZones: getShippingZonesForQuote, getThreshold: getFreeShippingThreshold }),
      appUrl: APP_URL,
    },
  );
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  console.log(`🧾 Pedido ${orderNumber} creado (${variant.product.name} — ${variant.name} ×${qty}). Stock inicial: ${stockBefore}.`);

  // 2) Webhook approved (firma válida) × 2.
  const dataId = `SIM-${order!.createdAt.getTime()}`;
  const requestId = "sim-req-1";
  const input = { dataId, xSignature: buildSignature(dataId, requestId, "1717500000"), xRequestId: requestId };
  const deps = {
    db: prisma as any,
    getPayment: async () => ({ id: dataId, status: "approved", external_reference: orderId, transaction_amount: toNumber(order!.total) }),
    sendEmail, verifySignature: verifyMpSignature, secret: SECRET, ownerEmail: process.env.RESEND_OWNER_EMAIL || "",
  };

  const r1 = await processWebhook(input, deps);
  const after1 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  const r2 = await processWebhook(input, deps);
  const after2 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  const paid = await prisma.order.findUnique({ where: { id: orderId } });

  console.log(`📨 Webhook #1: ${r1.status} (${r1.detail}) → stock ${stockBefore} → ${after1!.stock}`);
  console.log(`📨 Webhook #2 (repetido): ${r2.status} (${r2.detail}) → stock ${after2!.stock}`);
  console.log(`📦 Estado del pedido: ${paid!.status}`);

  const ok = paid!.status === "paid" && after1!.stock === stockBefore - qty && after2!.stock === after1!.stock;
  console.log(ok ? "✅ DoD: pago acreditado, stock bajó UNA sola vez (idempotente)." : "❌ FALLO: revisar idempotencia/stock.");
  if (!ok) process.exitCode = 1;
}

main()
  .catch((e) => { console.error("❌ Simulación falló:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

- [ ] **Step 3: Correr la simulación contra la dev DB**

Run: `pnpm sim:webhook`
Expected: imprime el pedido creado, los 2 webhooks, y `✅ DoD: … stock bajó UNA sola vez (idempotente).` El email se loguea (sin `RESEND_API_KEY`) o se manda (con key).

> Si falla por falta de stock, correr `pnpm db:seed` antes. El script crea pedidos reales en la dev DB (datos de prueba, se limpian antes del launch en M5).

- [ ] **Step 4: Commit**

```bash
git add scripts/simulate-mp-webhook.ts package.json
git commit -m "feat(m2): simulate-mp-webhook script — real approved path, idempotency check (DoD)"
```

---

### Task 31: E2E — catálogo → carrito → checkout

**Files:** Create: `tests/e2e/checkout.spec.ts`.

Cubre el flujo de UI hasta el borde de MP (no dispara el pago real, que requiere token + redirect externo). Verifica: agregar desde la ficha → drawer/badge → `/carrito` → `/checkout` renderiza con resumen.

- [ ] **Step 1: Implementar `tests/e2e/checkout.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

// Producto del seed (M1). Si cambia el seed, actualizar el slug.
const PRODUCT_SLUG = "labial-mate-larga-duracion";

test("agregar al carrito → drawer → carrito → checkout", async ({ page }) => {
  await page.goto(`/producto/${PRODUCT_SLUG}`);

  // Agregar al carrito (variante por defecto, qty 1).
  await page.getByRole("button", { name: /agregar al carrito/i }).click();

  // El drawer se abre y muestra el título del carrito.
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/tu carrito/i)).toBeVisible();

  // Ir a /carrito y ver una línea + CTA.
  await page.goto("/carrito");
  await expect(page.getByRole("heading", { name: /tu carrito/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /iniciar compra/i })).toBeVisible();

  // Ir a /checkout y ver el form + botón de pago.
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: /finalizá tu compra/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /pagar con mercado pago/i })).toBeVisible();
});
```

- [ ] **Step 2: Correr el e2e (requiere DB seedeada)**

Run: `pnpm db:seed && pnpm test:e2e tests/e2e/checkout.spec.ts`
Expected: PASS. (Playwright levanta `pnpm build && pnpm start`; el flujo de carrito persiste por cookie.)

> El pago real con tarjeta de prueba en el checkout hosteado de MP es **checklist manual** (Task 33) — el redirect a MP se ve local, pero el webhook necesita URL pública (preview de Cloudflare o túnel).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/checkout.spec.ts
git commit -m "test(m2): e2e — add to cart → drawer → cart → checkout"
```

### Task 32: Verificación completa + checklist del DoD

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa** (lint, typecheck, unit+integration, build)

Run:
```bash
pnpm prisma generate && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: TODO verde. `pnpm test` corre unit (money, sku, catalog/*, cart/*, coupons, shipping/quote, orders/*, payments/*, email) **+ integration** (mercadopago, resend, shipping, checkout-service, webhook-service). `next build` compila.

- [ ] **Step 2: Verificación del DoD automatizada**

Run:
```bash
pnpm db:seed && pnpm sim:webhook
```
Expected: `✅ DoD: pago acreditado, stock bajó UNA sola vez (idempotente).`

- [ ] **Step 3: E2E**

Run: `pnpm test:e2e`
Expected: `home.spec`, `catalog.spec` y `checkout.spec` verdes.

- [ ] **Step 4: Checklist manual del DoD (sandbox MP)** — *acción del usuario, documentar resultado*:
  1. `pnpm dev` → abrir `/producto/labial-mate-larga-duracion` → Agregar al carrito → drawer.
  2. `/checkout` → completar contacto + CP `1414` + Calcular envío → ver costo → **Pagar con Mercado Pago**.
  3. En el checkout de MP sandbox, pagar con **tarjeta de prueba** (APRO) → vuelve a `/checkout/gracias`.
  4. Webhook real: requiere URL pública (preview de Cloudflare por PR, o túnel) con `MP_WEBHOOK_SECRET` cargado → al aprobarse, el pedido pasa a `paid`, baja stock y llega el email. *(Local sin túnel: la simulación del Task 30 cubre este tramo.)*

- [ ] **Step 5: Confirmar estado de migraciones**

Run: `pnpm prisma migrate status`
Expected: `Database schema is up to date!` (3 migraciones: init, m1_catalog_fields, m2_coupon_scope_and_order_seq).

---

### Task 33: Docs + push + handoff de PR

**Files:** Modify: `README.md`, `TODO.md`, `SETUP.md` (sección M2 si existe).

- [ ] **Step 1: Actualizar `README.md`** — en la sección de scripts, agregar:
```markdown
- `pnpm db:seed` — seed de catálogo + cupones + zonas + ajustes
- `pnpm sim:webhook` — simula el webhook MP (verifica idempotencia/stock sin túnel)
```
Y en convenciones, una línea: `Pagos: MP Checkout Pro (efectivo excluido), webhook con firma + idempotencia; total recalculado en server.`

- [ ] **Step 2: Actualizar `TODO.md`** — agregar bajo "Producto / features (Fase 2)" lo que M2 dejó explícitamente diferido:
```markdown
- [ ] **MiCorreo API real** (cotización en vivo por CP) — hoy fallback a tabla de zonas (seam listo en `lib/shipping/correo.ts`).
- [ ] **Cron de autocancelación 24h** (Cloudflare Cron Trigger) — lógica lista en `lib/orders/expiry.ts`; falta cablear el trigger (M4).
- [ ] **Cupones por cliente** (`perCustomerLimit`) — requiere cuentas (M4).
```

- [ ] **Step 3: Verificación final + format**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: verde.

- [ ] **Step 4: Commit de docs**

```bash
git add README.md TODO.md SETUP.md
git commit -m "docs(m2): scripts, payments conventions, deferred items (MiCorreo, autocancel cron)"
```

- [ ] **Step 5: Push de la rama**

Run: `git push -u origin m2-checkout`
Expected: rama publicada en `titi2233/glamify-makeup`. (Si el SSH `github-titi` pide passphrase o falla, surface al usuario.)

- [ ] **Step 6: Abrir PR `m2-checkout` → `main`** (vía `gh` o handoff al usuario)

```bash
gh pr create --base main --head m2-checkout --title "M2 — Carrito + Checkout + Pagos" --body "Implementa el milestone M2 (blueprints 04/05/01/02§7): carrito persistido (drawer + /carrito), cupones, checkout de un paso, cálculo de envío por CP (zonas + Correo env-gated), MP Checkout Pro (efectivo excluido) + webhook (firma + idempotencia + consulta a MP), máquina de estados del pedido, descuento de stock al aprobar, emails con Resend. DoD verificado: compra end-to-end en sandbox + idempotencia (sim:webhook) + stock baja + email."
```

> Tras el PR: `superpowers:requesting-code-review` antes de mergear. El **deploy de preview de Cloudflare** (por PR) da una URL pública para probar el webhook real de MP sandbox (cargar `MP_WEBHOOK_SECRET` + `MP_ACCESS_TOKEN` como `wrangler secret`). Merge a `main` recién con el DoD confirmado.

---

## Self-Review (checklist contra el design spec aprobado)

**Cobertura del alcance (design spec §2 + prompt M2):**
- Carrito server-persistido (drawer + `/carrito`) → Tasks 18, 24, 26, 29. ✔
- Cupones (validar + aplicar; percentage/fixed/free_shipping × scope) → Tasks 7, 21, 24, 26. ✔
- Checkout invitado de un paso (contacto, entrega domicilio/sucursal, CP→envío) → Task 27. ✔
- Cálculo de envío (zonas + Correo env-gated + gratis por umbral) → Tasks 8, 17, 19. ✔
- MP Checkout Pro (efectivo excluido `ticket`+`atm`, `external_reference`, `notification_url`, `auto_return`) → Tasks 15, 19. ✔
- Webhook (firma + idempotencia + consulta a MP) → Tasks 12, 13, 20, 22. ✔
- Máquina de estados del pedido (04 §3) → Tasks 9, 13. ✔
- Descuento de stock al aprobar (combos expandidos; oversell marcado) → Tasks 10, 20. ✔
- Emails de pedido/pago (Resend, dev log fallback) → Tasks 14, 16, 20. ✔
- `orderNumber` secuencia + `Coupon.scopeId` → Task 3. ✔
- Seed (cupones, zonas, ajustes, combo) → Task 4. ✔

**DoD (blueprint 09):**
- Compra end-to-end en sandbox MP → Task 27 (UI) + Task 32 §4 (manual) + Task 30 (path approved automatizado). ✔ (webhook real necesita URL pública → preview Cloudflare.)
- Stock baja al aprobar → Tasks 20, 30. ✔
- Email llega (real o log) → Tasks 16, 20, 30. ✔
- Webhook idempotente → Tasks 13, 20, 30 (corre 2×, stock baja 1 vez). ✔

**Casos borde (blueprint 04 §5 / design spec §7):**
- Efectivo excluido ✔ (Task 15). Webhook duplicado/fuera de orden → idempotencia ✔ (13/20/30). Firma inválida → 401 ✔ (20/22). `in_process` → sin cambio ✔ (9/13). Rechazado → reintento (no cancela) ✔ (9/13). Oversell → marca + alerta a la dueña ✔ (20, 14). Cupón revalidado en server + `usedCount++` al aprobar ✔ (19/20). No-aprobado 24h → lógica lista (expiry.ts), trigger M4 ✔ (11).

**Sin placeholders:** cada task trae test + implementación completos. Excepciones declaradas: `quoteCorreo` devuelve `null` (API real M5), `expiry.ts` sin trigger (M4) — ambos documentados como diferidos.

**Consistencia de tipos/nombres (verificado entre tasks):**
- `CartLine` (cart/types) usado idéntico en totals, coupons, shipping/quote, orders/stock, cart-service, checkout-service, webhook-service. ✔
- `round2` (money) reusado en totals/coupons/shipping/checkout. `toNumber`/`getEffectivePrice` (M1 pricing) reusados sin redefinir. ✔
- `applyCoupon`→`{discount, freeShipping}`, `validateCoupon`→`{ok}` consistentes (coupons → cart-view, actions, checkout-service). ✔
- `ShippingQuote` `{cost, free, zoneId, source}` consistente (shipping/index → checkout-service, actions). ✔
- `decideWebhookEffects`→`WebhookEffects` consumido por webhook-service con los mismos nombres de campo. ✔
- `CheckoutLineInput` definido en checkout-service, importado (solo tipo) por cart-service (`cartToCheckoutLines`) — sin ciclo en runtime. ✔
- Enums británicos `cancelled` en todo (state-machine, schema). ✔
- Server Actions (`addToCartAction`, `updateCartItemAction`, `removeCartItemAction`, `applyCouponAction`, `removeCouponAction`, `quoteShippingAction`, `createCheckoutAction`) referenciadas con esos nombres exactos en los componentes client. ✔

**Riesgos conocidos:**
- `server-only` omitido en checkout-service/checkout-data/shipping/index/webhook-service para que el script node los importe — documentado; el guard queda en cart-cookie/cart-view.
- Espacio NBSP de `Intl` en `formatARS` ya normalizado en M1 (`replace`), reusado.
- Webhook real requiere URL pública + `MP_WEBHOOK_SECRET`; sin túnel, la cobertura es la simulación (Task 30).
- `methodFactor` sucursal 0.85 es heurístico (zonas tienen un solo `price`); ajustable cuando entre la API real de Correo.

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-06-04-m2-carrito-checkout-pagos.md`. Dos opciones de ejecución:

1. **Subagent-Driven (recomendado)** — un subagente fresco por task, review entre tasks, iteración rápida (`superpowers:subagent-driven-development`). Encaja con ultracode: las libs puras de Fase 1 (Tasks 5–14) son independientes y se pueden paralelizar; Fases 3–4 son secuenciales.
2. **Inline Execution** — ejecutar las tasks en esta sesión con checkpoints (`superpowers:executing-plans`).

¿Cuál preferís?













