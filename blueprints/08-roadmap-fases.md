# 08 — Roadmap y fases

> **Propósito:** el plan de construcción en **milestones**, derivado de los blueprints `00`–`07`. Cada milestone se ejecuta siguiendo el `09` (playbook). El orden prioriza tener algo demostrable temprano y dejar el launch para el final con QA.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03

---

## 1. Prerrequisitos externos (altas que hay que hacer)

Cuentas/credenciales necesarias (las junta el dev a medida que avanzan los milestones):

- [ ] **GitHub** — repo del proyecto.
- [ ] **Vercel** (Hobby) + conectar repo.
- [ ] **Supabase** — proyecto (Postgres/Auth/Storage) + **Google OAuth** (para login con Google).
- [ ] **Mercado Pago** — app + credenciales **TEST y PROD** + webhook.
- [ ] **MiCorreo (Correo Argentino)** — cuenta + credenciales de **API**.
- [ ] **Resend** — cuenta + verificar dominio `glamifymakeup.site` (SPF/DKIM).
- [ ] **PostHog** — cuenta + key.
- [ ] **Dominio** — apuntar DNS de `glamifymakeup.site` a Vercel.
- [ ] **Assets** — fotos de producto + textos (logo vectorial → `TODO.md`).

## 2. Milestones (Fase 1)

### M0 — Cimientos
Scaffolding Next.js 15 + TS + Tailwind + shadcn/ui · Supabase + **Prisma schema** (`01`) · **design tokens** (`02`: paleta rosa eléctrico, Playfair/Nunito) · layout base · CI + deploy a Vercel.
**DoD:** app deployada (home placeholder) + DB migrada + tokens aplicados.

### M1 — Catálogo (lectura)
Entidades de catálogo + seed · **Home** · **`/tienda`** con filtros · **ficha de producto** con variantes · componentes de diseño (`ProductCard`, `VariantSwatchSelector`, `PriceTag`, etc.).
**DoD:** navegar catálogo y ficha con datos reales, mobile-first.

### M2 — Carrito + Checkout + Pagos
Carrito (drawer) · **checkout de un paso** · **cálculo de envío por CP** (API Correo + zonas, `05`) · **MP Checkout Pro + webhook + máquina de estados** (`04`) · cupones · emails de pedido/pago (Resend).
**DoD:** compra de punta a punta en **sandbox de MP**, stock se descuenta, email llega.

### M3 — Panel de administración (`03`)
Auth admin · CRUD productos/categorías/combos · **control de stock** · **pedidos** (estados, tracking) · envíos (zonas, umbral, CP origen) · cupones · reseñas (moderación) · ajustes · **dashboard**.
**DoD:** la dueña opera **todo** sin tocar código.

### M4 — Cuenta + Conversión + Crecimiento
Cuentas (email+Google) · wishlist · reseñas (alta + display) · **mecánicas de conversión** (`06`: barra envío gratis, combos, order-bump, cross-sell, stock badges) · **carrito abandonado** (Vercel Cron + email) · exit-intent · **PostHog** · **SEO/OG** · **estética IA** (`06 §5`).
**DoD:** funnel completo + medición andando.

### M5 — Pulido, QA y Launch
Páginas legales (**arrepentimiento**, términos, privacidad) · accesibilidad (WCAG AA) · performance (LCP/CLS) · **tests** (unit/integración/e2e) · carga de catálogo real · credenciales **PROD** (MP, MiCorreo, Resend) · DNS del dominio · **go-live**.
**DoD:** tienda en producción en `glamifymakeup.site`.

## 3. Orden y dependencias

- **M0** primero. **M1 → M2** (catálogo antes que carrito).
- **M3** (admin) puede ir **en paralelo** a M2 una vez listo el modelo (M1); para dev de M2 se usa **seed**, y M3 habilita la carga real.
- **M4** tras M2/M3. **M5** cierra.

## 4. Fase 2 (post-launch) → `TODO.md`

WhatsApp (Evolution Go), checkout embebido (Bricks), programa de puntos, PWA, historial de movimientos de stock, import CSV, reembolsos in-app, reactivar efectivo, Sentry, Vercel Pro.

## 5. Cómo se ejecuta

Cada milestone se construye con el **`09` (playbook)**: **Superpowers** (plan → execute → TDD → verify → review) + **ux-ui-pro-max** para UI + **ultracode** en las fases pesadas, con el **modelo recomendado por fase**. Verificación antes de marcar cada milestone como listo.

## 6. Decisión

- **D08-1 ✔** — Orden **M0 → M5** confirmado.
