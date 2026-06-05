# M3 — Panel de administración · Design Spec

> Estado: aprobado por el usuario (2026-06-05). Fuente de verdad: blueprints `03` (panel) y `01` (dominio) + el código en disco.
> Milestone: **M3**. Rama: `m3-admin` (off HEAD de `m2-checkout`).

## 0. Objetivo y DoD

Construir el panel de administración de la dueña: shell propio con auth, dashboard de estadísticas básicas, CRUD de catálogo (Category, Product+Variant, Combo, Coupon) y gestión de pedidos (cambio de estado manual + cancelación) y envíos (tracking dentro del detalle del pedido).

**DoD:** la admin puede gestionar el catálogo (crear producto con variantes y stock; crear cupón) y cambiar el estado de un pedido. Verificación e2e: login → crear producto con variante+stock → crear cupón → abrir un pedido y cambiar su estado.

## 1. Scope

**IN (M3):**
- Auth de admin + shell `(admin)` (sin navbar/footer de clientas).
- Dashboard (blueprint 03 §4 — el prompt cita "§8", que no existe; la spec del dashboard vive en §4).
- CRUD: Category, Product+Variant, Combo, Coupon.
- Pedidos: lista, detalle, cambio de estado manual, cancelación.
- Envíos: actualizar tracking (dentro del detalle del pedido).

**DEFERRED → `TODO.md`:**
- Reseñas (moderación) — política depende de blueprint 06.
- Ajustes (Settings page).
- ShippingZone CRUD (config de zonas).
- Import CSV de catálogo.
- Notificaciones WhatsApp.
- Historial de movimientos de stock.
- Duplicar producto (si no entra en el tiempo de M3).

## 2. Convenciones (seguir el patrón existente)

- **Route group** `src/app/(admin)/` con su propio `layout.tsx`. Sin header/footer/bottom-nav de storefront.
- **Lecturas** en Server Components; **mutaciones** en Server Actions que devuelven `{ ok, error }` (tipo `ActionResult`, igual que `src/app/(storefront)/actions.ts`).
- **Lógica de dominio/validación** como funciones puras en `src/lib/admin/*` → tests `unit`.
- **Servicios** que orquestan transacciones Prisma reciben `deps.db` inyectable (mockeable) → tests `integration`, igual que `src/lib/orders/checkout-service.ts`.
- `pnpm typecheck` + `pnpm test` después de cada cambio. TypeScript strict, nunca `any`.
- Decimal(12,2) para montos; UTC en DB, conversión a ART solo en frontend/cálculo de dashboard.
- Primitivos UI nuevos de shadcn según haga falta (Table, Badge, Label, Textarea, Switch/Checkbox, Dialog —ya existe—).

## 3. Auth (Supabase Auth + role gate)

- `/admin/login`: form email/password → Supabase `signInWithPassword`. Éxito → redirect `/admin`. Logout action limpia sesión.
- `src/lib/admin/auth.ts` → `requireAdmin()`:
  1. `createClient()` (supabase server) → `getUser()`. Sin usuario → `redirect('/admin/login')`.
  2. `prisma.user.findUnique({ where: { id: uid } })`. Si no existe o `role ∉ {owner, admin}` → redirect a login (o 403).
  3. Devuelve `{ id, email, role }`.
- **Enforcement (defensa en profundidad):**
  - `(admin)/layout.tsx` (Server Component) llama `requireAdmin()` → protege todas las páginas del grupo.
  - Cada Server Action de admin llama `requireAdmin()` **primero** (los layout guards no cubren actions).
  - `middleware.ts` fino, matcher `/admin/:path*`, refresca la cookie de sesión Supabase.
- `/admin/login` queda **fuera** del layout protegido (su propio segmento sin el guard, o ruta hermana).
- `scripts/create-admin.ts` (tsx, service-role): crea el usuario en Supabase Auth + fila `User` (role `owner`). Idempotente. Documentar en `SETUP.md`.

## 4. Dashboard (blueprint 03 §4)

Funciones puras en `src/lib/admin/dashboard.ts` (TDD), reciben filas + `now` de referencia. **Zona horaria ART = UTC−3 fija (Argentina sin DST).**

- **Ventas hoy / semana / mes:** suma de `order.total` de pedidos que alcanzaron pago (`status ∈ {paid, preparing, shipped, delivered}`), agrupado por límites de día/semana/mes en ART.
- **Pedidos pendientes de acción:** conteo de `paid` (a preparar) y `preparing` (a despachar).
- **Ticket promedio:** promedio de `total` de pedidos paid+ en el período.
- **Top productos:** qty vendida desde `OrderItem` de pedidos paid+.
- **Stock crítico:** variantes activas con `stock ≤ lowStockThreshold`.

El Server Component hace los fetch Prisma y pasa datos a las funciones puras; renderiza cards de números grandes + listas + **empty states guiados**.

## 5. CRUD de catálogo

Cada módulo: **lista** (Server Component, búsqueda/filtros) + **form** crear/editar + **server actions** → **servicio**.

### 5.1 Categories
- Campos: name, slug (auto desde name, editable, único), parentId (**máx 2 niveles**: una categoría con parent no puede ser parent de otra), skuPrefix (1–3 A–Z), order, active, image.
- Puras: `slugify`, `isValidSkuPrefix`, `assertMaxTwoLevels(parent)`.
- Delete: bloquear si tiene products o children (hay onDelete:SetNull en self-relation, pero el negocio bloquea). Confirm dialog.

### 5.2 Products + Variants
- Product: name, slug(auto), description, categoryId, basePrice, compareAtPrice? (solo si > basePrice), cost, weightGr, images[] (upload), isFeatured, heroRank?, tags[], seoTitle?, seoDescription?, active.
- Variants (anidadas): name, swatchHex?, stock, lowStockThreshold (default 3), priceOverride?, weightGrOverride?, image?, active, order.
- **Sin variantes → crear 1 "Único"** automáticamente (blueprint 01 §2): stock/SKU/checkout uniformes.
- **SKU auto por prefijo de categoría** (editable). Pura `nextSkuSequence(existingSkusForPrefix) → max+1`; el servicio consulta SKUs existentes del prefijo dentro de la tx y **reintenta una vez** ante violación de `@unique`. Reusa `generateSku` y `isValidSku` (`src/lib/sku.ts`).
- **Soft-delete** (`deletedAt`). Stock manual = editar `stock` en el form (un clic). (Inline +/- en lista: nice-to-have.)
- **Image upload:** server action → bucket `product-images` (ya existe: público, 5MB, png/jpeg/webp/avif), guarda path en `images[]`/`variant.image`.

### 5.3 Combos
- Campos: name, slug(auto), description, comboPrice (>0), images[], active, validFrom?, validTo?.
- Items: variantes + qty (≥1), **≥1 item**.
- Puras: `validateCombo` (comboPrice>0, items no vacío, qty≥1).

### 5.4 Coupons
- Campos: code (único, upper), type (percentage|fixed|free_shipping), value (%:1–100, fixed:>0, free_shipping:n/a), scope (all|category|product) + scopeId (requerido si scope≠all), minSubtotal?, maxUses?, perCustomerLimit?, validFrom?, validTo?, active.
- `usedCount` read-only (lo maneja checkout).
- Puras: `validateCoupon` (formato code, reglas de value por type, rango de fechas from<to, scopeId requerido). Alinear semántica con `src/lib/coupons/apply.ts`.

## 6. Pedidos + Envíos

- **Lista:** filtro por estado (chips de color), búsqueda por orderNumber/contacto. Columnas: nº, fecha, cliente, total, estado pago (MP), estado pedido.
- **Detalle:** items (snapshots), contacto, dirección (snapshot), envío (method/zone/cost), pagos (MP status/amount).
- **Cambio de estado:** próximos estados válidos vía `canTransition` (`src/lib/orders/state-machine.ts`). `changeOrderStatusAction(orderId, to)` valida la transición y actualiza.
- **Cancelación:** `cancelOrderAction` → `cancelled` (permitido desde pending_payment/paid/preparing). **Si estaba `paid`, reponer stock** dentro de la tx (reusa `src/lib/orders/stock.ts`). Confirm dialog (acción peligrosa).
- **Envíos (tracking):** en el detalle, upsert de `Shipment` (carrier/service/trackingNumber/labelUrl/cost/status). Cargar tracking mueve el pedido a `shipped`. `Order 0..1 Shipment` (orderId @unique).

## 7. Estrategia de tests (TDD)

- **Unit (puras):** slugify, isValidSkuPrefix, nextSkuSequence, assertMaxTwoLevels, validateProduct/Variant/Combo/Coupon, agregaciones de dashboard + límites de fecha ART, cálculo de restock en cancelación.
- **Integration (servicio + `deps.db` mockeado):** createCategory, createProduct (auto-Único + SKU gen + retry), createCombo, createCoupon, changeOrderStatus (guard + restock-on-cancel), upsertShipment, lógica de `requireAdmin` (supabase + db mockeados).
- **E2E (Playwright — el DoD):** login admin → crear producto con variante+stock → crear cupón → abrir pedido y cambiar estado. (Requiere admin seedeado y, si hace falta, un pedido seedeado; alinear con el setup e2e existente.)

## 8. Branch y housekeeping

- Rama **`m3-admin`** off HEAD (lleva el trabajo de M2). Nunca push directo a `main`.
- **Sin migración de schema prevista:** todas las entidades/enums que M3 toca ya existen. Si aparece un campo faltante, **frenar y avisar** antes de migrar.
- Actualizar `TODO.md` (diferidos) y `SETUP.md` (script create-admin).

## 9. Riesgos / decisiones abiertas

- "Ventas" en dashboard = `order.total` (incluye envío) de pedidos paid+. Si se prefiere neto de envío, es un ajuste menor en la función pura.
- Email (Resend) al cambiar estado de pedido: **default M3 = NO** se envía email automático en el cambio de estado manual (el webhook de pago ya notifica; no está en el DoD). El transporte ya existe y se puede sumar después sin fricción.
- Concurrencia de SKU resuelta con retry-once (suficiente para 1–2 admins); no se agrega columna contador.
