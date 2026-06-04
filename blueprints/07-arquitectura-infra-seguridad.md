# 07 — Arquitectura, infra y seguridad

> **Propósito:** cómo se arma el sistema por dentro: stack, topología, entornos, auth, seguridad, performance, testing, deploy y la **verdad de costos**. Robustez sin sobre-ingeniería.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03

---

## 1. Stack

- **Front + API:** Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui. API vía route handlers / server actions.
- **Datos:** **Supabase** (Postgres + Auth + Storage) con **Prisma** (ORM).
- **Pagos:** Mercado Pago Checkout Pro.
- **Email transaccional:** **Resend** (free tier).
- **Analítica:** PostHog (free).
- **Deploy:** Vercel.
- *WhatsApp automatizado (Evolution Go) → **diferido**, ver `TODO.md`. El botón wa.me manual en la web sí va.*

## 2. Topología — **100% serverless**

- **Vercel** sirve front + API + **cron** (carrito abandonado, autocancel de pedidos 24h).
- **Supabase** = DB + Auth + Storage (imágenes de producto y assets IA).
- **Webhook de MP** → route handler en Vercel (verifica firma + consulta a MP).
- **Resend** = emails transaccionales (alerta de pedido/pago a la dueña; confirmación, despacho y carrito abandonado a la clienta).
- **Sin piezas always-on** → nada de VPS, todo serverless.

## 3. Entornos y secretos

- **Entornos:** local (dev) · preview (Vercel por PR) · prod.
- **Secrets en env** (Vercel/Supabase), nunca en el cliente: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `POSTHOG_KEY`, `DATABASE_URL`.
- `.env.example` versionado (sin valores).

## 4. Auth y autorización

- **Clientas:** Supabase Auth (email + Google). **Admin:** owner/dev con `role`.
- **RLS (Row Level Security)** en Supabase: cada quien accede solo a lo suyo; el admin a todo (vía service role en server).
- Checks de autorización **en el server** (no confiar en el cliente).

## 5. Seguridad

- **PCI:** lo maneja **Mercado Pago** (Checkout Pro redirect) → **no tocamos datos de tarjeta**.
- **Pagos:** webhook con **firma + idempotencia**, total **recalculado en server** (ver `04`).
- **RLS + validación server + rate limiting** en endpoints sensibles + sanitización de inputs.
- **Email:** dominio `glamifymakeup.site` verificado en Resend (SPF/DKIM) para entregabilidad.
- **Datos personales** (clientas): **Ley 25.326 (Protección de Datos Personales)** + consentimiento para mensajes y baja.
- **Legales:** Botón de Arrepentimiento + Términos + Privacidad (ver `02`).

## 6. Performance

- SSR/ISR según página, **imágenes optimizadas** (WebP/AVIF, `next/image`), `aspect-ratio` (CLS < 0.1), lazy below-the-fold, code-splitting.
- Assets IA pre-generados y optimizados (ver `06 §5`).

## 7. Testing

- **Unit:** precios, cálculo de envío, cupones, combos, SKU.
- **Integración:** checkout + **webhook de pago** (estados/idempotencia), stock, emails.
- **E2E:** flujo de compra completo (catálogo → carrito → pago) con Playwright.
- Stack: Vitest + Playwright.

## 8. Deploy / CI

- **GitHub** + **Vercel** (deploy automático: preview por PR, prod en `main`).
- **Vercel Cron** para: recordatorio de carrito abandonado y autocancelación de pedidos no aprobados (24h).
- **Migraciones** Prisma versionadas; lint + typecheck + tests en CI antes de mergear.

## 9. Backups y observabilidad

- **Supabase**: backups del plan (free = limitado → export periódico si hace falta).
- **Logs** de Vercel + **PostHog** (producto). **Sentry → diferido** (`TODO.md`); por ahora logs + PostHog.

## 10. La verdad de costos

| Pieza | Costo |
|---|---|
| Dominio | ya pago |
| Supabase | **free** |
| Vercel | **Hobby free** — se **asume el riesgo** del ToS "no comercial" (D07-2) |
| Resend (email) | **free tier** |
| PostHog | **free tier** |
| Mercado Pago | **comisión por venta** (inevitable) |

→ **Costo fijo ~$0**; lo único variable es la comisión de MP por venta. (WhatsApp/Evolution Go agregaría un VPS → por eso quedó diferido.)

## 11. Decisiones

- **D07-1 ✔** — Notificaciones por **email (Resend)** en v1. **WhatsApp (Evolution Go) diferido** → `TODO.md`.
- **D07-2 ✔** — **Vercel Hobby** (free), asumiendo el riesgo de ToS. Pro → si/cuando convenga (`TODO.md`).
- **D07-3 ✔** — **Sentry diferido**; por ahora Vercel logs + PostHog.
