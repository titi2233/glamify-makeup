# Glamify Makeup

Tienda online de Glamify Makeup — ecommerce custom (Next.js 15 + Supabase + Prisma + **Cloudflare Workers**).
Fuente de verdad del producto: [`blueprints/`](blueprints/) (00–09). Plan de M0: [`docs/superpowers/plans/`](docs/superpowers/plans/). Sistema de diseño: [`design-system/MASTER.md`](design-system/MASTER.md).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3 · shadcn/ui · Prisma 6 + **`@prisma/adapter-pg`** · Supabase (Postgres/Auth/Storage) · **Cloudflare Workers** vía **`@opennextjs/cloudflare`** · Vitest · Playwright.

## Desarrollo

```bash
pnpm install
cp .env.example .env.local   # completar con credenciales (ver SETUP.md)
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev                     # http://localhost:3000
```

## Scripts

- `pnpm dev` — desarrollo (Next)
- `pnpm build` — prisma generate + next build
- `pnpm build:worker` — build del Worker (OpenNext) → `.open-next/`
- `pnpm dev:worker` — `wrangler dev` sobre el Worker buildeado (puerto 8771)
- `pnpm preview:worker` — build:worker + dev:worker (previsualizar el Worker local)
- `pnpm deploy` — build:worker + `wrangler deploy` (requiere `wrangler login`)
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e`
- `pnpm db:migrate` / `pnpm db:studio` / `pnpm setup:storage`
- `pnpm db:seed` — seed de catálogo + cupones + zonas + ajustes
- `pnpm sim:webhook` — simula el webhook MP (verifica idempotencia/stock sin túnel)

## Deploy (Cloudflare Workers)

1. `wrangler login` (o `CLOUDFLARE_API_TOKEN` en el entorno).
2. Cargar secrets: `wrangler secret put DATABASE_URL` (pooler 6543), `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.; las públicas (`NEXT_PUBLIC_*`) como vars.
3. `pnpm deploy` — o conectar el repo en el dashboard de Cloudflare Workers (deploy automático + previews por PR).

> **Nota (dev Windows):** `build:worker` usa el output _standalone_ de Next, que crea symlinks. En Windows **requiere Developer Mode** (o correr la terminal como admin); si no, falla con `EPERM: symlink`. El build corre sin problemas en Linux (CI y la build de Cloudflare). El resto del flujo (`pnpm dev`, `build`, `test`) anda en Windows normalmente.

## Convenciones

- Dinero: `Decimal(12,2)` ARS. Estados en inglés británico (`cancelled`).
- Timestamps UTC; conversión a ART en el front.
- Secrets solo en `.env.local` / `wrangler secret` (nunca en git).
- Rama por milestone; PR + code-review antes de `main`.
- Pagos: MP Checkout Pro (efectivo excluido), webhook con firma + idempotencia; total recalculado en server.
