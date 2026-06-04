# 01 — Modelo de dominio y datos

> **Propósito:** definir las entidades del sistema, sus relaciones, el esquema de SKU y los estados. Es la base del schema **Prisma sobre Supabase (Postgres)**. El schema exacto (tipos, índices, constraints) se finaliza en el build a partir de este documento.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03

---

## 1. Mapa de entidades

**Catálogo:** `Category` · `Product` · `ProductVariant` · `Combo` · `ComboItem`
**Inventario:** stock en `ProductVariant` (descuento automático al vender)
**Ventas:** `Cart` · `CartItem` · `Order` · `OrderItem` · `Payment`
**Clientas:** `Customer` · `Address` · `Wishlist` · `Review`
**Envíos:** `ShippingZone` · `Shipment` (+ método de envío como enum)
**Promos:** `Coupon`
**Sistema:** `User` (admin/owner) · `Setting`

**Relaciones clave:**
- `Category` 1—N `Product` · `Category` 0..1 `parent` (self; **jerárquico, hasta 2 niveles**)
- `Product` 1—N `ProductVariant` (el **stock vive en la variante**)
- `Combo` 1—N `ComboItem` N—1 `ProductVariant`
- `Order` 1—N `OrderItem` · `Order` 1—N `Payment` · `Order` 0..1 `Customer` (null = invitada)
- `Customer` 1—N `Address` · `Customer` N—N `Product` (vía `Wishlist`)
- `Order` 0..1 `Shipment` · `Order` 0..1 `ShippingZone`

---

## 2. Entidades en detalle

### Catálogo

**Product** — producto base (lo que ve la clienta como una ficha)
| campo | tipo | nota |
|---|---|---|
| id | uuid | PK |
| slug | string | único, para URL |
| name | string | |
| description | text | |
| categoryId | fk | → Category |
| basePrice | decimal(12,2) | ARS |
| cost | decimal(12,2) | costo unitario (margen/reportes) |
| weightGr | int | peso por defecto, para cotizar envío |
| images | string[] | paths en Supabase Storage |
| isFeatured | bool | héroe de catálogo |
| heroRank | int? | orden de destacados |
| tags | string[] | |
| seoTitle / seoDescription | string? | |
| active | bool | |
| timestamps | | createdAt, updatedAt, deletedAt (soft-delete) |

**ProductVariant** — variante (tono/color); **acá vive el stock y el SKU**
| campo | tipo | nota |
|---|---|---|
| id | uuid | PK |
| productId | fk | → Product |
| name | string | ej. "Rojo Mate" |
| sku | string | único, **autogenerado** (ver §3) |
| priceOverride | decimal? | si null, usa basePrice del Product |
| stock | int | cantidad disponible |
| lowStockThreshold | int | default 3; dispara alerta |
| weightGrOverride | int? | si null, usa weightGr del Product |
| image | string? | foto del tono |
| active | bool | |
| order | int | orden de exhibición |

> **Productos sin variantes:** se crea automáticamente **1 variante "Único"** por debajo. Así el stock, el SKU y el checkout son uniformes. La dueña solo "ve" variantes cuando carga más de un tono.

**Category** — **D1 ✔ jerárquica** (subcategorías)
| campo | tipo | nota |
|---|---|---|
| id, slug, name | | |
| parentId | fk? self | **subcategorías** (jerárquico, **máx 2 niveles** para no complicar) |
| skuPrefix | string(3) | ej. "LAB"; alimenta el SKU |
| image | string? | |
| order, active | | |

**Combo** + **ComboItem** — **D2 ✔ combos fijos** (set de productos a precio especial)
| Combo | tipo | nota |
|---|---|---|
| id, slug, name, description | | |
| comboPrice | decimal(12,2) | precio del set |
| images | string[] | |
| active, validFrom?, validTo? | | |

| ComboItem | tipo | nota |
|---|---|---|
| comboId | fk | |
| variantId | fk | variante incluida |
| qty | int | |

> Una línea de carrito/pedido puede referenciar **una variante o un combo**; al pagarse, el combo **descuenta el stock de sus componentes** (`ComboItem`). Detalle del flujo → `04`.
>
> *Sin `PriceTier`/precio por cantidad: las **sorpresitas** (1x$1000 / 2x$1500 / 3x$2000) son una mecánica de **feria/presencial**, no de envío online — no se modelan en la web.*

### Inventario

> **D4 ✔ — Inventario simple.** El stock es `stock` + `lowStockThreshold` en cada **ProductVariant**: se descuenta solo al vender y dispara alerta bajo el mínimo. El **historial de movimientos** queda como mejora de **Fase 2**.
>
> **Stock compartido (feria + web):** la dueña ajusta cantidades en el panel después de cada feria. No hay POS por ahora.

### Clientas

**Customer** — solo clientas **registradas** (las invitadas viven en el `Order`)
| campo | tipo | nota |
|---|---|---|
| id | uuid | = uid de Supabase Auth |
| email, name, phone | | |
| timestamps | | |

**Address** (de clienta registrada) · **Wishlist** (Customer N—N Product)
`Address`: recipientName, phone, street, number, floor/apt, city, province, **postalCode**, notes, isDefault.

> **D3 ✔ — Login de clientas:** Supabase Auth con **email** (contraseña / magic link) + **Google OAuth**.

### Ventas

**Cart** + **CartItem** — carrito persistente y base del recupero de abandono
| Cart | tipo | nota |
|---|---|---|
| id | uuid | |
| customerId | fk? | o sessionId si es invitada |
| sessionId | string? | |
| status | enum | active / ordered / abandoned |
| contactEmail / contactPhone | string? | si la invitada los dejó (para recupero) |
| timestamps | | |

`CartItem`: cartId, **variantId? / comboId?** (uno u otro), qty, unitPriceSnapshot.

**Order** — el pedido
| campo | tipo | nota |
|---|---|---|
| id | uuid | |
| orderNumber | string | humano, ej. **GLM-000123** |
| customerId | fk? | null = compra como invitada |
| contactName / contactEmail / contactPhone | | datos de contacto del pedido |
| shippingAddress | jsonb | **snapshot** de la dirección |
| shippingMethod | enum | domicilio / sucursal |
| shippingZoneId | fk? | zona aplicada |
| subtotal / shippingCost / discountTotal / total | decimal | |
| couponId | fk? | |
| status | enum | ver §4 |
| timestamps | | |

**OrderItem** — con **snapshots** (los precios/nombres históricos no cambian si después editás el catálogo)
`orderId, variantId? / comboId?, productNameSnapshot, variantNameSnapshot, skuSnapshot, unitPriceSnapshot, qty, lineTotal`.

**Payment** — un pedido puede tener varios intentos
| campo | tipo | nota |
|---|---|---|
| id, orderId | | |
| provider | enum | mercadopago |
| mpPreferenceId | string? | |
| mpPaymentId | string? | **índice único** → idempotencia de webhook |
| status | enum | espejo de MP (§4) |
| amount | decimal | |
| rawPayload | jsonb | payload crudo del webhook |
| timestamps | | |

### Envíos

**ShippingZone** — tabla de zonas que controla la dueña (fallback + control manual)
`id, name, matchType (province | cpRange), provinces[] | cpFrom/cpTo, price, active, order`.

**Shipment**
`id, orderId, carrier (correo_argentino), service, trackingNumber, status (§4), labelUrl?, cost, createdAt`.

> El detalle del cálculo por CP (API Correo vs tabla), umbral de envío gratis y retiro → **blueprint 05**.

### Promos

**Coupon**
`id, code (único), type (percentage | fixed | free_shipping), value, scope (all | category | product), minSubtotal?, maxUses?, usedCount, perCustomerLimit?, validFrom, validTo, active`.

### Sistema

**User** (admin) — `id (Supabase Auth), email, role (owner | admin)`. Owner = la dueña; admin = dev.
**Setting** (clave/valor o singleton) — `freeShippingThreshold, originPostalCode, storeName, whatsappNumber, social links, …`.

---

## 3. Esquema de SKU (autogenerado)

- **Formato:** `{PREFIJO_CATEGORIA}-{NNNN}` → ej. `LAB-0007`, `RUB-0003`.
- El prefijo sale de `Category.skuPrefix` (3 letras, configurable). La secuencia es **por categoría**.
- Se genera **al crear la variante** (cada variante = 1 SKU). **Editable** a mano si la dueña quiere. Único global.
- Productos sin variantes igual generan 1 SKU (variante "Único").

## 4. Estados (enums)

- **OrderStatus:** `pending_payment → paid → preparing → shipped → delivered`; ramas `cancelled`, `refunded`.
- **PaymentStatus:** `pending, approved, rejected, in_process, refunded, cancelled` (espejo de Mercado Pago).
- **ShipmentStatus:** `pending, ready, dispatched, in_transit, delivered, returned`.

> Las **transiciones**, el manejo de webhooks y los casos borde (pago pendiente, rechazado, expirado, doble webhook) → **blueprint 04**.

## 5. Notas de implementación

- **Prisma** sobre **Supabase Postgres**.
- Precios en **ARS** con `decimal(12,2)`.
- `createdAt/updatedAt` en todo; **soft-delete** (`deletedAt`) en catálogo.
- Imágenes en **Supabase Storage**; en DB guardamos paths/URLs.
- Índices: `slug`, `sku`, `orderNumber`, `coupon.code`, `address.postalCode`, `payment.mpPaymentId`.
- **Snapshots** de precio/nombre/SKU en `OrderItem` y de dirección en `Order.shippingAddress`.
- `jsonb` para `rawPayload` de pagos y snapshots.

## 6. Decisiones

- **D1 ✔** — Categorías **jerárquicas** (subcategorías, máx 2 niveles).
- **D2 ✔** — **Combos fijos: SÍ** (suben ticket y envían bien). **Sorpresitas / price tiers: NO** (mecánica de feria/presencial).
- **D3 ✔** — Login: **email + Google**.
- **D4 ✔** — Inventario **simple** (cantidad + alerta); historial de movimientos → Fase 2.
- **D5** — Reseñas: política de moderación → **blueprint 06** (la entidad `Review` ya queda definida acá).

> **Reseña (`Review`):** `id, productId, customerId?, authorName, rating (1–5), title?, body, photoUrl?, verifiedPurchase, status (pending/approved/rejected), createdAt`. La política (quién puede reseñar, moderación) se cierra en `06`.
