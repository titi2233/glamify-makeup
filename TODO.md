# Glamify Makeup — TODO (diferidos / fase siguiente)

> Cosas decididas conscientemente para **más adelante**, para no inflar la v1. No son olvidos: son scope diferido.

## Diferidos de M3 (panel admin)
> Decididos fuera del scope de M3 (ver spec `docs/superpowers/specs/2026-06-05-m3-panel-admin-design.md`). No son olvidos.
- [ ] **Reseñas (moderación):** aprobar/rechazar `Review` desde el panel — política depende de blueprint 06.
- [ ] **Ajustes / Settings page:** editar `Setting` (storeName, envío gratis, CP origen, redes) desde el panel.
- [ ] **ShippingZone CRUD:** alta/edición de zonas de envío desde el panel (hoy solo por seed).
- [ ] **Import CSV de catálogo:** carga masiva de productos/variantes (hoy carga manual).
- [ ] **Notificaciones WhatsApp** al cambiar estado de pedido (hoy: sin email automático en el cambio manual; el webhook de pago ya notifica).
- [ ] **Historial de movimientos de stock** (auditoría) — hoy solo cantidad + alerta de stock crítico.
- [ ] **Duplicar producto** (acelerar alta de variantes similares).

## Diferidos de M4 (Cuentas + Clientas)
> M4 se ejecutó como el split **"Cuentas + Clientas"** (auth, perfil, reseñas, wishlist, carrito abandonado, cupones por cliente). La mitad **"Conversión + Crecimiento"** del M4 de blueprint 08/09 queda acá (ver spec `docs/superpowers/specs/2026-06-06-m4-cuentas-clientas-design.md`).
- [x] **Conversión/crecimiento (M4b):** order-bump + cross-sell "Te puede gustar" (por tag `order-bump` / misma categoría), exit-intent sutil (email→recupero + cupón `BIENVENIDA10`), PostHog (analytics opt-out + eventos + UTM), SEO + Open Graph (sitemap, robots, JSON-LD de producto/sitio, OG con foto real). *(La barra de envío gratis y los `StockBadge` reales ya existen desde M1/M2. Ver spec `docs/superpowers/specs/2026-06-06-m4b-conversion-crecimiento-design.md`.)*
- [x] **Moderación de reseñas en el panel admin (M4b)** — reseñas abiertas (cualquiera reseña); compra verificada → auto-publicada; resto → cola `pending` en `/admin/resenas` (aprobar/rechazar).
- [ ] **Estética IA / OG image de marca (06 §5)** — fondos/hero/banners generados con IA on-brand y una **OG image de marca dedicada**. Hoy el OG usa la foto real del producto (ficha) y el OG por defecto en el resto. Diferido: requiere generación de assets + art direction.
- [ ] **Fotos en reseñas** — hoy solo rating + título + cuerpo (la entidad `Review` ya tiene `photoUrl`). *(Las reseñas abiertas de M4b no suben foto todavía.)*
- [ ] **Captcha en reseñas abiertas** — hoy honeypot + cola de moderación; sumar captcha si aparece spam real.
- [ ] **Libreta de direcciones** en `/cuenta` (`Address` CRUD) — hoy el checkout snapshotea la dirección en el `Order`.
- [ ] **Magic link** (login passwordless) y **cambio de email** de la clienta.
- [ ] **Carrito abandonado de 2 etapas** (1h + 24h) y por WhatsApp — hoy un único recordatorio a 24h por email.
- [ ] **Matching de pedidos de invitada por email** para una cuenta registrada — hoy "mis pedidos" solo muestra `customerId == me`.

## Infra / notificaciones
- [ ] **WhatsApp automatizado (Evolution Go):** avisos a la dueña y a la clienta (confirmación, despacho) + carrito abandonado por WhatsApp. Requiere instancia **always-on** (reutilizar la de Elite Padel OS o un VPS). **Hoy:** email (Resend). *(El botón wa.me manual en la web ya está en v1.)*
- [ ] **Sentry** (monitoreo de errores). Hoy: Cloudflare logs + PostHog.

## Assets / marca
- [x] **Logo vectorial real (SVG) o PNG transparente** — el actual es un JPEG envuelto en SVG (fondo blanco). Necesario para footer / secciones de color.

## Producto / features (Fase 2)
- [ ] **MiCorreo API real** (cotización en vivo por CP) — hoy fallback a tabla de zonas (seam listo en `lib/shipping/correo.ts`).
- [x] **Cron de autocancelación 24h** (Cloudflare Cron Trigger) — cableado en M4 (`worker.ts` `scheduled` → `runOrderExpiryJob`, cron horario).
- [x] **Cupones por cliente** (`perCustomerLimit`) — implementado en M4 (tabla `CouponRedemption`, enforcement en checkout + registro en webhook).
- [ ] **Checkout embebido (MP Bricks)** — pago on-site sin redirección.
- [ ] **Programa de puntos / fidelidad.**
- [ ] **PWA** (experiencia app-like, instalable).
- [ ] **Historial de movimientos de stock** (auditoría) — hoy solo cantidad + alerta.
- [ ] **Import CSV** de catálogo — hoy carga manual.
- [ ] **Reembolsos in-app** (vía API MP) — hoy manuales por WhatsApp / panel MP.
- [ ] **Reactivar efectivo** (Rapipago/Pago Fácil) si se quiere captar ese público (con manejo de pendientes 24–48h).
- [ ] **Subcategorías 3+ niveles** si el catálogo crece (hoy máx 2).

## Deuda técnica (decidir en M1)
> Hallazgos del review de conformidad de M0 (no-high; el blueprint 01 es ambiguo en estos puntos).
- [ ] **Soft-delete en catálogo:** hoy `deletedAt` está solo en `Product`. El blueprint 01 §5 dice "soft-delete en *catálogo*" (más amplio). Decidir en M1 si agregar `deletedAt` a `Category`/`ProductVariant`/`Combo` o acotar el blueprint a `Product`. *(Sin riesgo hoy: `Order`/`OrderItem` usan snapshots, así que borrar catálogo no rompe historial.)*
- [ ] **Timestamps consistentes:** §5 dice "createdAt/updatedAt en todo", pero `ProductVariant`/`ShippingZone`/`Coupon` no los tienen y varios sin `updatedAt`. Definir en M1 si se agregan o se acota el blueprint.
