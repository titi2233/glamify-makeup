# Glamify Makeup — TODO (diferidos / fase siguiente)

> Cosas decididas conscientemente para **más adelante**, para no inflar la v1. No son olvidos: son scope diferido.

## Infra / notificaciones
- [ ] **WhatsApp automatizado (Evolution Go):** avisos a la dueña y a la clienta (confirmación, despacho) + carrito abandonado por WhatsApp. Requiere instancia **always-on** (reutilizar la de Elite Padel OS o un VPS). **Hoy:** email (Resend). *(El botón wa.me manual en la web ya está en v1.)*
- [ ] **Vercel Pro** (~US$20/mes): pasar de Hobby si factura / para estar ToS-clean. Hoy: Hobby asumiendo el riesgo.
- [ ] **Sentry** (monitoreo de errores). Hoy: Vercel logs + PostHog.

## Assets / marca
- [x] **Logo vectorial real (SVG) o PNG transparente** — el actual es un JPEG envuelto en SVG (fondo blanco). Necesario para footer / secciones de color.

## Producto / features (Fase 2)
- [ ] **Checkout embebido (MP Bricks)** — pago on-site sin redirección.
- [ ] **Programa de puntos / fidelidad.**
- [ ] **PWA** (experiencia app-like, instalable).
- [ ] **Historial de movimientos de stock** (auditoría) — hoy solo cantidad + alerta.
- [ ] **Import CSV** de catálogo — hoy carga manual.
- [ ] **Reembolsos in-app** (vía API MP) — hoy manuales por WhatsApp / panel MP.
- [ ] **Reactivar efectivo** (Rapipago/Pago Fácil) si se quiere captar ese público (con manejo de pendientes 24–48h).
- [ ] **Subcategorías 3+ niveles** si el catálogo crece (hoy máx 2).
