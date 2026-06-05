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

## Infra / notificaciones
- [ ] **WhatsApp automatizado (Evolution Go):** avisos a la dueña y a la clienta (confirmación, despacho) + carrito abandonado por WhatsApp. Requiere instancia **always-on** (reutilizar la de Elite Padel OS o un VPS). **Hoy:** email (Resend). *(El botón wa.me manual en la web ya está en v1.)*
- [ ] **Sentry** (monitoreo de errores). Hoy: Cloudflare logs + PostHog.

## Assets / marca
- [x] **Logo vectorial real (SVG) o PNG transparente** — el actual es un JPEG envuelto en SVG (fondo blanco). Necesario para footer / secciones de color.

## Producto / features (Fase 2)
- [ ] **MiCorreo API real** (cotización en vivo por CP) — hoy fallback a tabla de zonas (seam listo en `lib/shipping/correo.ts`).
- [ ] **Cron de autocancelación 24h** (Cloudflare Cron Trigger) — lógica lista en `lib/orders/expiry.ts`; falta cablear el trigger (M4).
- [ ] **Cupones por cliente** (`perCustomerLimit`) — requiere cuentas (M4).
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
