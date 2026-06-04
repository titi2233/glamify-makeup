# M2 — Carrito + Checkout + Pagos (Glamify Makeup) — Design Spec

> Estado: aprobado por el usuario (2026-06-04). Fuente de verdad: blueprints `01`, `02 §7`, `04`, `05`, `07`. Rama: `m2-checkout` (worktree aislado off `main`).

## 1. Objetivo y DoD

Permitir comprar de punta a punta: agregar al carrito → checkout invitado de un paso → pagar con **Mercado Pago Checkout Pro** (sandbox) → el webhook confirma el pago, **descuenta stock**, manda emails. 

**DoD (blueprint 09 / prompt M2):** compra end-to-end en sandbox MP funciona; **stock baja** al aprobarse; **email llega** (real o log en dev); **webhook idempotente**.

## 2. Alcance

**Incluye:** carrito server-persistido (drawer + `/carrito`), cupones, checkout invitado un paso, cálculo de envío (tabla de zonas + Correo env-gated), MP Checkout Pro + preference, webhook (firma + idempotencia + consulta a MP), máquina de estados del pedido, descuento de stock al aprobar, emails de pedido/pago con Resend.

**Excluye (diferido):** login de clientas / Google OAuth (milestone aparte); API real de MiCorreo (M5); cron Cloudflare de autocancelación 24h (la lógica + script quedan listos, el trigger es M4); `perCustomerLimit` de cupones (requiere cuentas); reembolsos por API (D04-3: manual por WhatsApp).

## 3. Convenciones (CLAUDE.md + blueprints)

- TypeScript strict, nunca `any`.
- **Dinero: `Decimal(12,2)` ARS, cálculo con `number` (patrón de M1 `toNumber`), `round2` para redondear a 2 decimales en cada total. NO centavos-enteros, NO float sin redondear.**
- **Server Actions** para mutaciones de UI (carrito, cupón, checkout). **Route Handler** SOLO para el webhook de MP.
- Queries a DB solo desde Server Components / Server Actions.
- Enums británicos (`cancelled`). UUIDs PK. Timestamps UTC.
- Total **siempre recalculado en server**; nunca confiar en montos del cliente (blueprint 04 §7).
- Secrets solo de env (`.env.local` / `wrangler secret`); nunca en cliente ni git.
- `pnpm typecheck` después de cada cambio.

## 4. Modelo de datos

El schema de M0 (blueprint 01) ya tiene todo: `Cart`, `CartItem`, `Order`, `OrderItem`, `Payment` (`mpPaymentId @unique`), `Coupon`, `ShippingZone`, `Shipment`, `Setting`. 

**Único cambio (migración aditiva `m2_order_sequence`):** secuencia Postgres `order_number_seq` para el `orderNumber` humano (`GLM-000123`). Se consume con `nextval` dentro de la transacción de creación de pedido. Correrla escribe en Supabase (como M0).

Carrito identificado por cookie httpOnly `glamify_cart` (UUID en `Cart.sessionId`). Invitada → `Order.customerId = null`, datos de contacto en el `Order`.

## 5. Arquitectura por capas (todo TDD)

### 5.1 Libs puras — unit tests, sin DB ni red
| Módulo | Responsabilidad |
|---|---|
| `lib/money.ts` (extender) | `round2(n)`; reusar `formatARS`/`parseDecimal`. |
| `lib/cart/totals.ts` | Subtotal, total de línea (`unitPrice*qty`), expansión de combos (`comboPrice`). Reusa `getEffectivePrice`/`toNumber` de M1. |
| `lib/coupons/apply.ts` | `validateCoupon(coupon, ctx)` + `applyCoupon(coupon, lines)`: percentage/fixed/free_shipping × scope all/category/product; valida `minSubtotal`, ventana `validFrom/validTo`, `active`, `maxUses` vs `usedCount`. |
| `lib/shipping/quote.ts` | `orderWeightGr(lines)` (`weightGrOverride ?? weightGr`, default sensato); `matchZone(zones, { cp, province })` (province / cpRange); `isFreeShipping(subtotal, threshold)`. |
| `lib/orders/state-machine.ts` | `canTransition(from, to)`, `orderStatusForPayment(mpStatus)` (blueprint 04 §3). |
| `lib/orders/stock.ts` | `computeStockDecrements(items)` → `Map<variantId, qty>` (combos → componentes); `checkAvailability(decrements, current)`. |
| `lib/orders/order-number.ts` | `formatOrderNumber(seq)` → `GLM-000123`. |
| `lib/payments/signature.ts` | `verifyMpSignature({ xSignature, xRequestId, dataId, secret })` HMAC-SHA256 (Web Crypto, Workers-safe). |
| `lib/payments/webhook-effects.ts` | `decideWebhookEffects(order, payment, mpPayment)` → efectos a aplicar (idempotente por diseño: guarda por `Order.status` y `Payment` existente). |
| `lib/email/templates.ts` | `orderConfirmationEmail(order)` (a la clienta) + `newOrderAlertEmail(order)` (a la dueña). |

### 5.2 IO — integration tests con mocks
| Módulo | Responsabilidad |
|---|---|
| `lib/payments/mercadopago.ts` | `createPreference(input, deps?)` y `getPayment(id, deps?)` vía `fetch` (Bearer `MP_ACCESS_TOKEN`); `fetch` inyectable para tests. |
| `lib/email/resend.ts` | `sendEmail({to,subject,html})`: real si hay `RESEND_API_KEY`, si no log a consola (dev transport). |
| `lib/shipping/correo.ts` | Provider MiCorreo env-gated (`MICORREO_*`); si no hay creds → fallback a zonas. |
| `lib/shipping/index.ts` | `quoteShipping({cp, province, method, weightGr, subtotal})` → orquesta Correo → zonas → gratis. |
| `app/(storefront)/.../actions.ts` | Server Actions: `addToCart`, `updateCartItem`, `removeCartItem`, `applyCouponToCart`, `quoteShippingAction`, `createCheckout`. |
| `app/api/webhooks/mercadopago/route.ts` | Route Handler POST del webhook. |

### 5.3 UI
- **Carrito:** `CartDrawer` (Sheet) + badge de cantidad en `SiteHeader`; `/carrito` página; `CartLineItem`, `FreeShippingBar`, `CouponInput`, `CartSummary`, `EmptyState`. "Agregar al carrito" desde la ficha (client → server action → `router.refresh()`, abre drawer).
- **Checkout `/checkout`:** form un paso — contacto (email/nombre/tel), entrega domicilio/sucursal (RadioGroup), dirección + CP → `quoteShippingAction`, resumen, cupón. Validación inline. Submit → `createCheckout` → `sandbox_init_point` → `window.location`.
- **`/checkout/gracias`:** nº de pedido + estado + tracking + CTA WhatsApp (lee `external_reference`/orderNumber del query de MP).
- Dep nueva: `@radix-ui/react-radio-group` + componente shadcn `radio-group`. El resto de primitivos ya existen (Sheet, Dialog, Input, Button, Separator, Select).

## 6. Flujo de datos

```
Ficha → addToCart (action) → Cart/CartItem (cookie sesión) → CartDrawer/​/carrito
  → /checkout → quoteShipping (zonas) + applyCoupon → resumen (total recalculado server)
  → createCheckout (action): Order(pending_payment) + OrderItem(snapshots) + Payment(pending)
      + MP createPreference(external_reference=orderId, back_urls, notification_url,
        excluded_payment_types:[ticket,atm], auto_return:approved) → sandbox_init_point
  → redirect a MP Checkout Pro → /checkout/gracias
  ── (async) ── MP → POST /api/webhooks/mercadopago:
      1. verifyMpSignature   2. getPayment(id) [fuente de verdad]
      3. tx idempotente (mpPaymentId @unique + guarda por Order.status):
         approved → Order.paid + descuenta stock (chequea disponibilidad; oversell→marca)
                    + Coupon.usedCount++ + emails (1 vez)
         rejected → reintento posible; refunded → refunded
      4. 200 siempre (corta reintentos de MP)
```

## 7. Manejo de errores y casos borde (blueprint 04 §5)

- **Efectivo/offline:** excluido (`ticket`,`atm`) → sin pedidos pendientes de efectivo.
- **Webhook duplicado / fuera de orden:** idempotencia por `mpPaymentId` + guarda por `Order.status` (no doble-descuenta stock ni reenvía email). Estado más reciente desde MP.
- **Firma inválida:** 401, no procesa.
- **`in_process`:** queda `pending_payment` hasta el webhook definitivo.
- **Rechazado / preference expirada:** permitir regenerar preference (reintento).
- **No aprobado 24h:** lógica de autocancelación lista (`lib/orders/expiry.ts` + script); trigger Cloudflare en M4.
- **Oversell:** si tras aprobar no hay stock, se marca el pedido (no se rompe el pago); se resuelve por WhatsApp.
- **Cupón:** revalidado en server antes de confirmar total; `usedCount++` recién al aprobarse (no en pedidos abandonados).
- **Sin URL pública (dev):** `notification_url` apunta a `NEXT_PUBLIC_APP_URL`; verificación local vía `scripts/simulate-mp-webhook.ts` (firma válida, postea al webhook local).

## 8. Testing y verificación del DoD

- **Unit (Vitest):** money/round2, totales, cupones, envío (peso/zona/gratis), máquina de estados, decrementos de stock, firma MP (vectores conocidos), efectos del webhook (todas las ramas), plantillas de email, order-number.
- **Integration (Vitest, `tests/integration/`, Prisma + `fetch` mockeados):** `createCheckout` crea Order + preference; webhook → **idempotente** (mismo pago 2× = 1 decremento), firma inválida rechazada, `approved→paid+stock+email`, `rejected`.
- **E2E (Playwright):** catálogo → agregar → drawer → checkout → obtener `init_point` (corta en el borde de MP).
- **Verificación local sin túnel:** `scripts/simulate-mp-webhook.ts` ejercita el path `approved` real (stock baja, email loguea/llega, idempotencia corriéndolo 2×). La compra con tarjeta de prueba en el checkout hosteado de MP = checklist manual (el redirect sí se ve local).

## 9. Riesgos y supuestos

- Necesito copiar `.env.local` (del working copy principal) al worktree para migración/seed/dev. Si el sandbox bloquea la copia, lo hace el usuario con `! cp ...`.
- MP Node SDK no se usa: todo vía `fetch` (runtime Workers).
- El push final usa SSH `github-titi` (cuenta `titi2233`); si pide passphrase o falla, handoff al usuario.
- Resend sin key → emails logueados; el envío real se activa al cargar `RESEND_API_KEY`.
