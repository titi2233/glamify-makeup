# 07 — Arquitectura, infra y seguridad

> **Propósito:** cómo se arma el sistema por dentro: stack, topología, entornos, auth, seguridad, performance, testing, deploy y la **verdad de costos**. Robustez sin sobre-ingeniería.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03 · **Actualizado: 2026-06-04** (migración Vercel → Cloudflare)

---

## 1. Stack

- **Front + API:** Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui. API vía route handlers / server actions.
- **Datos:** **Supabase** (Postgres + Auth + Storage) con **Prisma** (ORM) + **driver adapter** (`@prisma/adapter-pg`).
- **Deploy:** **Cloudflare Workers** vía **`@opennextjs/cloudflare`** (adapter oficial). ~~Vercel~~.
- **Connection pooling:** **Cloudflare Hyperdrive** (proxy entre Workers y Supabase Postgres, reduce latencia TCP). Alternativa viable: conexión directa al pooler de Supabase (puerto 6543) con `nodejs_compat`.
- **Pagos:** Mercado Pago Checkout Pro.
- **Email transaccional:** **Resend** (free tier).
- **Analítica:** PostHog (free).
- *WhatsApp automatizado (Evolution Go) → **diferido**, ver `TODO.md`. El botón wa.me manual en la web sí va.*

### 1.1 ¿Por qué Cloudflare en vez de Vercel?

- **Uso comercial gratis** — Cloudflare Workers/Pages **permite uso comercial** en el plan gratuito. Vercel Hobby no (ToS "no comercial"). Elimina el riesgo de D07-2.
- **100K req/día gratis** — sobra para el volumen actual y de crecimiento.
- **Assets estáticos ilimitados** — los requests a assets estáticos no cuentan contra el límite.
- **Cron Triggers incluidos** — 5 triggers gratis por cuenta (suficiente para carrito abandonado + autocancel).
- **Edge global** — Workers corre en 300+ ciudades, sin cold starts significativos.

### 1.2 Adapter: `@opennextjs/cloudflare`

> **IMPORTANTE:** No usar `@cloudflare/next-on-pages` (legacy). El adapter oficial y recomendado es **`@opennextjs/cloudflare`**.

- Transforma el output de Next.js 15 (App Router) en formato Workers.
- Soporta: **SSR, ISR (via R2/KV), Server Actions, Route Handlers, Middleware**.
- Requiere flag **`nodejs_compat`** en `wrangler.jsonc` para acceso a APIs Node.js.
- Next.js 15 está soportado (últimos minors).

### 1.3 Prisma en Workers

- Prisma funciona en Workers con `nodejs_compat` habilitado.
- Usar **`@prisma/adapter-pg`** (driver adapter) para compatibilidad con el runtime.
- `DATABASE_URL` apunta al pooler de Supabase (puerto 6543, `?pgbouncer=true`).
- `DIRECT_URL` (puerto 5432) solo para migraciones locales (`prisma migrate`).
- Cachear instancia del PrismaClient por invocación (patrón singleton serverless).

## 2. Topología — **100% serverless**

- **Cloudflare Workers** sirve front + API + **Cron Triggers** (carrito abandonado, autocancel de pedidos 24h).
- **Supabase** = DB + Auth + Storage (imágenes de producto y assets IA).
- **Cloudflare Hyperdrive** (opcional, recomendado) = connection pooling entre Workers y Supabase Postgres.
- **Webhook de MP** → route handler en Workers (verifica firma + consulta a MP).
- **Resend** = emails transaccionales (alerta de pedido/pago a la dueña; confirmación, despacho y carrito abandonado a la clienta).
- **Sin piezas always-on** → nada de VPS, todo serverless.

## 3. Entornos y secretos

- **Entornos:** local (dev con `next dev`) · preview (`wrangler dev --port 8771`) · prod (Cloudflare Workers).
- **Secrets** → `wrangler secret put <KEY>` o dashboard de Cloudflare. Nunca en el cliente: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `POSTHOG_KEY`, `DATABASE_URL`.
- `.env.example` versionado (sin valores). `.env.local` para desarrollo local.

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

- SSR/ISR según página (ISR usa **R2** o **KV** en Cloudflare para cache).
- **Imágenes optimizadas** (WebP/AVIF, `next/image` con loader custom para Cloudflare), `aspect-ratio` (CLS < 0.1), lazy below-the-fold, code-splitting.
- **Cloudflare Hyperdrive** elimina overhead de TCP handshake en cada request a DB.
- Assets IA pre-generados y optimizados (ver `06 §5`).

## 7. Testing

- **Unit:** precios, cálculo de envío, cupones, combos, SKU.
- **Integración:** checkout + **webhook de pago** (estados/idempotencia), stock, emails.
- **E2E:** flujo de compra completo (catálogo → carrito → pago) con Playwright.
- Stack: Vitest + Playwright.

## 8. Deploy / CI

- **GitHub** + **Cloudflare Workers** (deploy automático conectando el repo, o vía `wrangler deploy`).
- Preview deploys por PR (Cloudflare genera URLs de preview automáticamente).
- **Cloudflare Cron Triggers** para: recordatorio de carrito abandonado y autocancelación de pedidos no aprobados (24h). Máximo 5 triggers en plan gratis (sobra).
- **Migraciones** Prisma versionadas (se corren local/CI con `DIRECT_URL`); lint + typecheck + tests en CI antes de mergear.

### 8.1 Archivos de configuración Cloudflare

**`wrangler.jsonc`** (en la raíz del proyecto):
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": ".open-next/worker.js",
  "name": "glamify-makeup",
  "compatibility_date": "2024-12-30",
  "compatibility_flags": ["nodejs_compat"]
}
```

**Scripts en `package.json`:**
```json
{
  "build:worker": "opennextjs-cloudflare build",
  "dev:worker": "wrangler dev --port 8771",
  "preview:worker": "npm run build:worker && npm run dev:worker",
  "deploy": "npm run build:worker && wrangler deploy"
}
```

## 9. Backups y observabilidad

- **Supabase**: backups del plan (free = limitado → export periódico si hace falta).
- **Logs** de Cloudflare Workers (dashboard + `wrangler tail` para real-time) + **PostHog** (producto). **Sentry → diferido** (`TODO.md`); por ahora logs + PostHog.

## 10. La verdad de costos

| Pieza | Costo |
|---|---|
| Dominio | ya pago |
| Supabase | **free** |
| Cloudflare Workers | **free** — 100K req/día, **uso comercial permitido** ✅ |
| Cloudflare Hyperdrive | **free** (incluido en Workers) |
| Resend (email) | **free tier** |
| PostHog | **free tier** |
| Mercado Pago | **comisión por venta** (inevitable) |

→ **Costo fijo ~$0**; lo único variable es la comisión de MP por venta. **Sin riesgo de ToS** (a diferencia de Vercel Hobby). Si el tráfico supera 100K req/día → Cloudflare Workers Paid ($5/mes, 10M req/mes).

## 11. Límites del plan gratuito de Cloudflare Workers

| Recurso | Límite Free |
|---|---|
| Requests | 100,000/día |
| CPU time | 10ms por request |
| Scripts | 100 |
| Cron Triggers | 5 por cuenta |
| Assets estáticos | **ilimitados** (no cuentan) |
| Builds (Pages) | 500/mes, 1 concurrente |
| Archivos por sitio | 20,000 (máx 25 MiB c/u) |

## 12. Decisiones

- **D07-1 ✔** — Notificaciones por **email (Resend)** en v1. **WhatsApp (Evolution Go) diferido** → `TODO.md`.
- **D07-2 ✔ (ACTUALIZADA)** — **Cloudflare Workers** (free), **uso comercial permitido**. ~~Vercel Hobby con riesgo de ToS~~. Sin riesgo.
- **D07-3 ✔** — **Sentry diferido**; por ahora Cloudflare logs + PostHog.
- **D07-4 ✔ (NUEVA)** — Adapter: **`@opennextjs/cloudflare`** (OpenNext). No usar `@cloudflare/next-on-pages` (legacy).
- **D07-5 ✔ (NUEVA)** — Prisma con **driver adapter** (`@prisma/adapter-pg`) + `nodejs_compat`. Connection pooling vía **Cloudflare Hyperdrive** o pooler de Supabase (puerto 6543).
