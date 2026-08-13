# Glamify Makeup

Ecommerce de maquillaje y accesorios para chicas de 16–35 en Argentina. Venta por IG/TikTok/ferias → web propia. Glam accesible, no humo.

## Documentación

La carpeta `blueprints/` contiene 10 documentos aprobados que son la fuente de verdad del proyecto. Están numerados del 00 al 09:

### Marca y Negocio
- `00` — Visión, alcance, marca, personas, objetivos, KPIs, scope Fase 1/2
- `01` — Modelo de dominio y datos (entidades, relaciones, SKU, enums, Prisma schema)

### Storefront y UX
- `02` — Storefront: páginas, flujos y diseño (sitemap, design system, componentes, tokens)
- `03` — Panel de administración (CRUD, stock, pedidos, envíos, dashboard)

### Transacciones
- `04` — Checkout, pagos y ciclo de pedido (MP Checkout Pro, webhooks, máquina de estados)
- `05` — Envíos y logística (MiCorreo, zonas, envío gratis, pesos)
- `06` — Conversión y crecimiento (FOMO real, combos, carrito abandonado, SEO, analytics)

### Infra y Ejecución
- `07` — Arquitectura, infra y seguridad (Cloudflare Workers, Prisma, Supabase, auth, testing)
- `08` — Roadmap y fases (milestones M0–M5)
- `09` — Playbook de ejecución (prompts por milestone, skills, modelo)

### Otros archivos clave
- `design-system/MASTER.md` — Fuente de verdad visual (tokens, componentes, patrones)
- `SETUP.md` — Guía de altas de servicios y credenciales
- `TODO.md` — Scope diferido y deuda técnica

## Stack confirmado
- Next.js 15 (App Router) + TypeScript strict
- Cloudflare Workers vía `@opennextjs/cloudflare` (NO Vercel, NO `@cloudflare/next-on-pages`)
- PostgreSQL vía Supabase (Auth + Storage)
- Prisma ORM con driver adapter (`@prisma/adapter-pg`) + `nodejs_compat`
- shadcn/ui + Tailwind CSS 3.4
- MercadoPago Checkout Pro (redirect, excluir efectivo)
- Resend (email transaccional)
- PostHog (analytics)
- Vitest + Playwright
- pnpm (no npm, no yarn)

## Comandos
- `pnpm dev` — desarrollo local (Next.js)
- `pnpm dev:worker` — preview con Wrangler (simula Workers)
- `pnpm build` — build Next.js
- `pnpm build:worker` — build para Cloudflare Workers
- `pnpm deploy` — deploy a Cloudflare Workers
- `pnpm typecheck` — verificar tipos
- `pnpm lint` — ESLint
- `pnpm test` — tests unitarios (Vitest)
- `pnpm test:e2e` — tests e2e (Playwright)
- `pnpm db:seed` — seed de datos de prueba
- `npx prisma migrate dev` — nueva migración
- `npx prisma db push` — aplicar schema sin migración

## Reglas críticas
- TypeScript strict, nunca `any`
- Server Actions para mutaciones de UI (forms, carrito, checkout)
- Route Handlers solo para: webhooks de MP, endpoints públicos
- Queries a DB solo desde Server Components o Server Actions
- Montos en ARS con `Decimal(12,2)` (no centavos, no float)
- Timestamps en UTC, conversión a ART solo en el frontend
- UUIDs como primary keys
- ENUMs en inglés británico: `cancelled` (doble L), no `canceled`
- Correr `pnpm typecheck` después de cada cambio
- Soft-delete (`deletedAt`) en Product; definir ampliación en próximo milestone
- SKU autogenerado: `{PREFIJO_CATEGORIA}-{NNNN}` (ej. `LAB-0007`)
- Imágenes en Supabase Storage, paths en DB
- `prefers-reduced-motion` en todas las animaciones

## Design system (resumen — ver design-system/MASTER.md)
- Paleta: rosa eléctrico `#FF2E93` (primario), `#E01E7D` (hover), `#FF9ED1` (secundario), `#6E0B3F` (texto)
- Tipografía: Playfair Display (títulos) + Nunito Sans (cuerpo), body 16px mínimo
- Estilo: Soft UI Evolution, light mode only, sombras suaves, radii 12-16px
- Íconos: Lucide (SVG), nada de emojis como íconos
- Mobile-first, breakpoints: 375 / 768 / 1024 / 1440
- Touch targets ≥ 44px, contraste ≥ 4.5:1
- Regla explícita del dueño: tan simple que un niño lo entienda — compradora no técnica, flujos de un paso, nada de opciones "por las dudas"

## Deploy y CI
- Deploy: Cloudflare Workers (auto-deploy desde `main`)
- Preview: cada PR genera preview deploy en Cloudflare
- Secrets: `wrangler secret put <KEY>` (no en wrangler.jsonc)
- Variables públicas: en `wrangler.jsonc` → `[vars]`
- CI: lint + typecheck + test + build + build:worker
- Ramas: una por milestone (`m0-cimientos`, `m1-catalogo`, `m2-checkout`...)
- Nunca push directo a `main`, siempre merge desde rama de milestone

## Convenciones de comunicación
- Respuestas directas, sin introducciones ni conclusiones
- Código y comandos, no explicaciones previas
- Si hay ambigüedad entre blueprints, señalarla explícitamente
- Si falta info, preguntar antes de inventar
- La fuente de verdad son los blueprints + el código en disco, no el historial del chat

## Entidades principales (ver blueprint 01)
- **Catálogo**: Category (jerárquica, 2 niveles) → Product → ProductVariant (stock + SKU acá)
- **Combos**: Combo → ComboItem → ProductVariant
- **Ventas**: Cart → CartItem → Order → OrderItem (con snapshots) → Payment
- **Clientas**: Customer (= Supabase Auth uid) → Address, Wishlist, Review
- **Envíos**: ShippingZone, Shipment
- **Promos**: Coupon
- **Sistema**: User (admin: owner/dev), Setting

## Estados (enums)
- `OrderStatus`: pending_payment → paid → preparing → shipped → delivered | cancelled | refunded
- `PaymentStatus`: pending, approved, rejected, in_process, refunded, cancelled
- `ShipmentStatus`: pending, ready, dispatched, in_transit, delivered, returned

## Git (cuenta titi2233)
- Repo: `titi2233/glamify-makeup` (SSH: `git@github-titi:titi2233/glamify-makeup.git`)
- User: `titi2233` / `lisantiziana@gmail.com` (config local, no global)
- SSH host: `github-titi` (ver `~/.ssh/config`)

## Compact Instructions
Al resumir la conversación, preservar:
- Cambios de API pública y su razón
- Errores encontrados y sus soluciones
- Archivos modificados en esta sesión
- Decisiones arquitectónicas tomadas
- Estado actual del milestone en progreso

Resumir brevemente:
- Intentos de exploración fallidos
- Discusiones que llegaron a conclusión
