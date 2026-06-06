# M4 — Cuentas + Clientas · Design Spec

> Estado: aprobado por el usuario (2026-06-06). Fuente de verdad: blueprints `02` (storefront/UX), `06` (conversión), `01` (dominio), `07` (auth/infra/testing) + el código en disco.
> Milestone: **M4 (split: "Cuentas + Clientas")**. Rama: `m4-cuentas` (off HEAD de `m3-admin`).

## 0. Objetivo y DoD

Dar a la clienta una cuenta: registrarse/ingresar (email+contraseña y Google), gestionar su perfil (datos, pedidos, favoritos), dejar reseñas con compra verificada (auto-publicadas) que se muestran en la ficha, y cablear los Cron Triggers de Cloudflare para recupero de carrito abandonado (24h) y autocancelación de pedidos (24h). Además, hacer cumplir el límite de cupones por clienta (`perCustomerLimit`, diferido en M2).

**DoD:** la clienta puede gestionar su cuenta y dejar una reseña post-compra. Verificación e2e: **registro** (email nuevo → pantalla de confirmación) · **login** (clienta seedeada) · **wishlist** (agregar/quitar) · **reseña** sobre un producto comprado → aparece en la ficha.

## 1. Scope

**IN (M4 — Cuentas + Clientas):**
- Auth de clientas: `/ingresar` (email+contraseña + Google OAuth), guard `requireCustomer()`, upsert de `Customer` en el primer load autenticado, callback OAuth, merge de carrito invitado al loguear.
- Perfil `/cuenta`: dashboard, mis datos (editar name/phone), mis pedidos (lista + detalle read-only), favoritos.
- Reseñas: alta con **validación de compra** → `verifiedPurchase=true`, `status=approved` (auto-publicada), display en la ficha de producto (promedio + lista).
- Wishlist: toggle (corazón) en `ProductCard` y ficha + página `/cuenta/favoritos`.
- Carrito abandonado: detección + template + envío (Resend) + **Cloudflare Cron Trigger**. Recordatorio único a **24h**, con consentimiento.
- Autocancelación de pedidos: cablear el cron del `findExpiredOrderIds` (lógica M2 lista, trigger sin cablear).
- Cupones `perCustomerLimit`: enforcement por clienta logueada (nueva tabla `CouponRedemption`).

**DEFERRED → `TODO.md` (mitad "Conversión + Crecimiento" del M4 de blueprint 08/09, más extras):**
- Conversión/crecimiento: order-bump, cross-sell "Te puede gustar", exit-intent, PostHog, SEO/Open Graph, estética IA (06 §5). *(La barra de envío gratis y los `StockBadge` reales ya existen desde M1/M2.)*
- Moderación de reseñas en el panel admin (las reseñas de compra verificada se auto-publican; el approve/reject queda para cuando se construya la UI — diferido desde M3).
- Fotos en reseñas (alta solo rating + título + cuerpo).
- Libreta de direcciones (`Address` CRUD en `/cuenta`); el checkout sigue snapshotteando la dirección en el `Order`.
- Magic link (passwordless), cambio de email, login social extra.
- Carrito abandonado de 2 etapas (1h + 24h) y por WhatsApp.
- Matching de pedidos de invitada por email para una cuenta registrada.

## 2. Convenciones (seguir el patrón existente)

- **Route groups:** clientas en `src/app/(storefront)/` (ya con header/bottom-nav/footer/cart). Auth de clientas en `(storefront)/ingresar`, perfil en `(storefront)/cuenta/*`. Admin sigue en `src/app/admin/*`.
- **Lecturas** en Server Components; **mutaciones** en Server Actions que devuelven `ActionResult { ok, error }` (mismo tipo que `src/app/(storefront)/actions.ts`).
- **Lógica de dominio/validación** como funciones puras en `src/lib/<domain>/*` → tests `unit`.
- **Servicios** que orquestan Prisma reciben `deps` inyectable (mockeable, patrón `deps.db`) → tests `integration`, igual que `src/lib/orders/checkout-service.ts` y `src/lib/admin/*/service.ts`.
- **Auth helper** mirror de `src/lib/admin/auth.ts`: core inyectable (`...WithDeps`) + función pura (`resolve...`) + wrapper real + guard. Reusar `createClient()` de `src/lib/supabase/server.ts`.
- `pnpm typecheck` + `pnpm test` después de cada cambio. TypeScript strict, nunca `any`. Montos `Decimal(12,2)`; UTC en DB.
- Primitivos UI nuevos de shadcn según haga falta (Tabs, Avatar/—, Dialog ya existe). Reusar tokens del design system (`design-system/MASTER.md`).

## 3. Migración de schema (una sola)

> M3 no migró; M4 sí. Cambios mínimos sobre `prisma/schema.prisma` (todas las entidades base ya existen).

1. **`CouponRedemption`** (nuevo) — fila contador para enforcement por clienta:
   ```prisma
   model CouponRedemption {
     customerId    String   @db.Uuid
     customer      Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
     couponId      String   @db.Uuid
     coupon        Coupon   @relation(fields: [couponId], references: [id], onDelete: Cascade)
     redeemedCount Int      @default(0)
     lastRedeemedAt DateTime?
     @@id([customerId, couponId])
     @@index([couponId])
   }
   ```
   (+ back-relations `redemptions CouponRedemption[]` en `Customer` y `Coupon`.)
2. **`Cart`** (campos nuevos): `recoveryEmailConsent Boolean @default(false)` (opt-in de invitada al dejar el email en checkout) + `abandonedEmailSentAt DateTime?` (idempotencia del recupero).
3. **`Customer.marketingConsent Boolean @default(false)`** — opt-in capturado en registro/checkout.
4. **`Review @@unique([customerId, productId])`** — una reseña por clienta por producto. (Postgres trata `customerId` NULL como distintos → reseñas de invitada históricas no se ven afectadas.)

Comando: `npx prisma migrate dev --name m4_accounts` (usa `DIRECT_URL`). En worktree, recordar `.env` además de `.env.local` (ver memoria del proyecto).

## 4. Auth de clientas (Supabase Auth: email+password + Google)

### 4.1 Helper `src/lib/customer/auth.ts` (mirror de admin/auth.ts)
- `interface CustomerUser { id: string; email: string; name: string | null }`.
- Puras/inyectables: `getCustomerWithDeps(deps)` → supabase `getUser()` → **upsert** de `Customer` (id=uid, email; crea fila si falta, idempotente) → `CustomerUser | null`. La superficie de DB (`CustomerAuthDb`) expone `customer.upsert`/`findUnique` (mockeable).
- `getCustomer()` (wrapper real con supabase server + prisma) y `requireCustomer()` (guard → `redirect("/ingresar")`).
- El upsert-on-load unifica signups por email y por Google (la fila `Customer` puede no existir aún tras el signUp de Supabase).

### 4.2 `/ingresar` (Server Component + client form + server actions)
- Tabs **Ingresar / Crear cuenta** (email+password) + botón **"Continuar con Google"**.
- Server actions en `(storefront)/ingresar/actions.ts`:
  - `signInAction({ email, password })` → `supabase.auth.signInWithPassword` → éxito: merge de carrito + `redirect("/cuenta")`.
  - `signUpAction({ email, password, name, marketingConsent })` → `supabase.auth.signUp` (+ `data.name`) → con **confirmación de email ON** (default Supabase), devuelve estado "revisá tu correo" (no auto-login).
  - `signInWithGoogleAction()` → `supabase.auth.signInWithOAuth({ provider: "google", redirectTo: <appUrl>/auth/callback })` → devuelve URL para redirect.
  - `signOutAction()` → `supabase.auth.signOut()` + `redirect("/")`.
- **Confirmación de email: ON.** Registro muestra pantalla "revisá tu correo". *(Ajustable en config de Supabase si se prefiere off.)*

### 4.3 Callback OAuth `src/app/auth/callback/route.ts`
- Route Handler: intercambia el `code` (`supabase.auth.exchangeCodeForSession`) → upsert Customer (vía getCustomer) → merge de carrito → `redirect("/cuenta")`. Maneja `error` de OAuth → `/ingresar?error=...`.

### 4.4 Middleware
- `src/middleware.ts`: extender `matcher` a `["/admin/:path*", "/cuenta/:path*", "/auth/:path*"]` para refrescar la cookie de sesión también en el área de clientas. Sin redirect (el gate real es `requireCustomer()` en el layout `(storefront)/cuenta/layout.tsx` y en cada server action).

### 4.5 Merge de carrito invitado → clienta
- `src/lib/cart/merge.ts` (puro + servicio): al loguear, si hay cookie `glamify_cart` con un cart `active`, setear su `customerId`. Si la clienta ya tenía un cart activo propio, **mover los items** al cart con cookie (o preferir el de cookie) y marcar el otro `ordered`/descartar — regla simple: el cart de la cookie gana, se le asigna `customerId`. Servicio con `deps.db` (test integration).
- Propaga consentimiento: si `customer.marketingConsent`, set `cart.recoveryEmailConsent=true`.

## 5. Perfil `/cuenta` (gated por `requireCustomer()` en el layout)

- `(storefront)/cuenta/layout.tsx` → `requireCustomer()` + nav del perfil (Mis datos / Mis pedidos / Favoritos / Salir).
- **`/cuenta`** — dashboard: saludo, últimos pedidos (3), conteo de favoritos, accesos.
- **`/cuenta/datos`** — form editar `name`, `phone` (Customer). Email read-only (es la identidad de auth). Server action `updateProfileAction` (requireCustomer → update). Cambio de email: diferido.
- **`/cuenta/pedidos`** — lista de `Order` con `customerId == me` (chips de estado + tracking si hay). Detalle read-only `(/cuenta/pedidos/[orderNumber])` reusando snapshots (items, total, estado, tracking del `Shipment`). Solo pedidos del customer logueado (no matching por email — diferido).
- **`/cuenta/favoritos`** — grid de `ProductCard` desde `Wishlist` con quitar.
- Habilitar el ítem **"Cuenta"** del `bottom-nav` (hoy `enabled:false`, "Próximamente") y un acceso en el header. Si no hay sesión, "Cuenta" lleva a `/ingresar`.

## 6. Reseñas — compra verificada, auto-publicadas

### 6.1 Puras
- `src/lib/reviews/purchase.ts` → `hasPurchased(items, productId): boolean` — sobre filas ya proyectadas `{ productId: string }[]` (el servicio mapea `OrderItem.variant.productId`): true si existe alguna con `productId` igual. El servicio arma esa lista desde pedidos `status ∈ {paid, preparing, shipped, delivered}` del customer. *(Combos fuera del predicado por ahora.)*
- `src/lib/reviews/validation.ts` → `validateReview({ rating, title?, body })` — rating entero 1–5, body no vacío (trim, **máx 2000 caracteres**), title opcional (máx 120).

### 6.2 Servicio + action
- `src/lib/reviews/service.ts` → `createReview(input, deps)` con `deps.db`: valida (puras) → verifica compra (query `orderItem` del customer) → crea `Review` con `verifiedPurchase=true`, `status="approved"`, `authorName = customer.name ?? email`. Respeta `@@unique([customerId, productId])` → si ya existe, error "Ya dejaste tu reseña".
- `createReviewAction` en `(storefront)/producto/.../actions.ts` (o `account-actions.ts`): `requireCustomer()` → `createReview` → `revalidatePath("/producto/[slug]")`.

### 6.3 Display en la ficha
- `src/components/ui/rating-stars.tsx` (display + input) y `src/components/catalog/review-card.tsx` (nuevos).
- En `(storefront)/producto/[slug]/page.tsx`: sección **Reseñas** = promedio (`RatingStars` + conteo) + lista de `Review` `status="approved"` (badge "Compra verificada"). Form de alta si la clienta está logueada y compró; si no compró → texto "Solo quienes compraron pueden reseñar"; si no logueada → CTA a `/ingresar`.
- "X vendidos" / `SocialProofBadge`: diferido con la mitad de conversión.

## 7. Wishlist

- `src/components/catalog/wishlist-heart.tsx` (client, optimista) en `ProductCard` y ficha.
- `toggleWishlistAction(productId)` → `requireCustomer()` (si no hay sesión → `redirect("/ingresar")`) → upsert/delete en `Wishlist` (PK compuesta `[customerId, productId]`) → `revalidatePath`. Servicio `src/lib/wishlist/service.ts` con `deps.db` (test integration).
- `/cuenta/favoritos` consume `Wishlist` del customer.

## 8. Cupones — límite por clienta (`perCustomerLimit`)

- **Extender la pura** `validateCoupon` (`src/lib/coupons/apply.ts`): `ValidatableCoupon` suma `perCustomerLimit: number | null`; `CouponContext` suma `customerRedemptions: number` (default 0). Nueva regla: si `perCustomerLimit != null` y `customerRedemptions >= perCustomerLimit` → `{ ok:false, reason: "Ya usaste este cupón el máximo de veces." }`. (Los callers existentes pasan `customerRedemptions: 0` por default → comportamiento intacto para invitadas.)
- **Checkout (autoritativo):** `createCheckout` (`checkout-service.ts`) — `CheckoutDb` suma `couponRedemption: { findUnique }`; `CreateCheckoutInput` ya tiene `customerId`. Si hay `customerId` y `coupon.perCustomerLimit`, buscar el contador `(customerId, couponId)` y pasarlo a `validateCoupon`. `CouponRow` suma `perCustomerLimit`.
- **Apply storefront (advisory):** `applyCouponAction` — si la clienta está logueada, pasar su `customerRedemptions`; si no, 0.
- **Incremento:** en `webhook-service.ts` (donde hoy se hace `coupon.usedCount {increment:1}` al aprobarse el pago, dentro de la tx), agregar **upsert** de `CouponRedemption` `(order.customerId, order.couponId)` `redeemedCount {increment:1}` **solo si `order.customerId` no es null**.
- **Limitación documentada:** las invitadas no se trackean por clienta → `perCustomerLimit` solo ata a clientas logueadas; `maxUses` sigue topeando el total global.

## 9. Crons (Cloudflare Cron Triggers) — Approach A: worker custom con `scheduled()`

### 9.1 Jobs (puros + inyectables, transport-agnósticos)
- **Abandoned cart** `src/lib/cart/abandoned.ts`:
  - Pura `findAbandonedCarts(carts, now, idleHours=24)` sobre filas normalizadas `{ cartId, email, consent, idleSince, alreadySent }` → devuelve los `cartId` elegibles: `status active`, `email` presente, `consent === true`, `now - updatedAt ≥ 24h`, `abandonedEmailSentAt == null`, cart con items.
    - Normalización: para cart con `customerId` → `email = customer.email`, `consent = customer.marketingConsent`; para invitada → `email = cart.contactEmail`, `consent = cart.recoveryEmailConsent`.
  - Servicio `runAbandonedCartJob(deps)` (`deps.db`, `deps.sendEmail`, `deps.now`): query carts candidatos (**batch ≤ 50** por corrida), por cada uno: render `abandonedCartEmail()` → `sendEmail` → set `abandonedEmailSentAt`. Idempotente (el guard evita reenvíos). Usar `ctx.waitUntil` para los envíos en el worker.
- **Order expiry** `src/lib/orders/expiry-job.ts`: `runOrderExpiryJob(deps)` → carga `pending_payment`, `findExpiredOrderIds` (ya testeada), por cada uno: transición `pending_payment → cancelled` vía `state-machine` (`canTransition`) en tx. **Sin reposición de stock** (los `pending_payment` nunca lo descontaron — el descuento ocurre al aprobarse el pago en el webhook).
- **Template** `src/lib/email/templates.ts`: agregar `abandonedCartEmail(d: { name?; items; recoverUrl })` → `{ subject, html, text }` (mismo patrón string que `orderConfirmationEmail`).

### 9.2 Wiring del worker
- **Worker entry custom** que re-exporta el `fetch` del worker generado por `@opennextjs/cloudflare` y agrega `scheduled(controller, env, ctx)` que despacha ambos jobs. Una sola Cron schedule **horaria** (`"0 * * * *"`, 1 de 5 triggers free) corre los dos jobs idempotentes.
  - `wrangler.jsonc`: agregar `"triggers": { "crons": ["0 * * * *"] }`.
  - El `scheduled` arma el `PrismaClient` (adapter-pg) desde `env` (mismo init que usa el app en Workers) e invoca `runAbandonedCartJob`/`runOrderExpiryJob` con deps reales.
- **Fallback documentado (Approach B):** si el import del artefacto `.open-next/worker.js` desde el entry custom resulta frágil en el build, exponer Route Handlers internos `app/api/cron/abandoned-cart` y `app/api/cron/expiry` guardados por header `CRON_SECRET`, y que `scheduled()` los invoque por `fetch`. Los módulos de job son idénticos en ambos casos.
- **Límites:** batch por corrida + idempotencia → progresa aunque haya tope de CPU del plan free; la corrida siguiente continúa.

## 10. Estrategia de tests (TDD)

- **Unit (puras):** `hasPurchased`, `validateReview`, `validateCoupon` extendido (per-customer: límite alcanzado / por debajo / invitada sin límite), `findAbandonedCarts` (idle + consent + email + already-sent + carrito vacío), merge de carrito (regla de cuál gana). (`findExpiredOrderIds` ya cubierta.)
- **Integration (servicio + `deps.db` mock con `vi.fn`):** `getCustomerWithDeps` (upsert/null), `createReview` (guard de compra + unique + auto-approve), `toggleWishlist`, `updateProfile`, merge de carrito (asigna customerId / mueve items), `runAbandonedCartJob` (selecciona, envía con `sendEmail` mock, estampa `abandonedEmailSentAt`), `runOrderExpiryJob` (cancela), incremento de `CouponRedemption` en el webhook, `createCheckout` con `perCustomerLimit` (rechaza al límite).
- **E2E (Playwright — el DoD):**
  - `scripts/create-customer.ts` (tsx, service-role, mirror de `create-admin.ts`): crea clienta **confirmada** en Supabase Auth + fila `Customer`. Idempotente. Documentar en `SETUP.md`.
  - `prisma/seed.ts`: agregar un pedido `paid` con `customerId` = la clienta e2e, conteniendo un producto conocido (para reseñar sin pasar por pago real). (Mirror del `GLM-E2E001` que ya existe para admin.)
  - `playwright.config.ts`: pasar `CUSTOMER_EMAIL` / `CUSTOMER_PASSWORD` al `env` del `webServer` (como `ADMIN_*`).
  - `tests/e2e/cuenta.spec.ts`: **registro** (email único → pantalla "revisá tu correo") · **login** (clienta seedeada) · **favoritos** (toggle on/off) · **reseña** sobre el producto comprado → aparece en la ficha. Botón de Google **presente** (OAuth no se maneja en e2e).

## 11. Branch y housekeeping

- Rama **`m4-cuentas`** off HEAD de `m3-admin`. Nunca push directo a `main`. PR + code-review al cerrar.
- **Migración prevista:** sí (`m4_accounts`, §3). Si aparece otro campo faltante, frenar y avisar antes de migrar de nuevo.
- Actualizar `TODO.md`: mover a "hecho/parcial" los ítems de M4 cubiertos (cron de autocancelación, cupones por cliente) y listar los diferidos de §1. Actualizar `SETUP.md` (`create-customer`, Google OAuth en Supabase, `CRON_SECRET` si se usa fallback).
- `.env.example`: agregar lo que falte (`CRON_SECRET` si fallback). Google OAuth es config de consola Supabase + Google Cloud (prereq blueprint 08).

## 12. Riesgos / decisiones abiertas

- **Google OAuth** requiere que la dueña configure el provider en Supabase (Client ID/Secret de Google Cloud) — prereq externo (blueprint 08 §1). El código (botón + callback) queda listo; si el provider no está configurado, el botón falla controladamente. El email+password no depende de esto.
- **Confirmación de email ON**: agrega fricción (la clienta confirma antes de loguear). Si se prefiere off, es un toggle en Supabase; el e2e usa clienta pre-confirmada por service-role de todas formas.
- **Cron Approach A vs B**: A (worker custom con `scheduled`) es lo elegido; el único riesgo es el import del artefacto de build — B (Route Handler + `CRON_SECRET`) es el fallback con los mismos módulos de job.
- **`perCustomerLimit` para invitadas**: no se puede trackear sin identidad → solo ata a logueadas (limitación aceptada y documentada).
- **Merge de carrito**: regla "el cart de la cookie gana"; si la clienta tenía otro cart activo se consolidan items en el de la cookie. Caso borde de stock se resuelve en checkout (revalidación server ya existente).
