# M0 — Cimientos (Glamify Makeup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el repo de Glamify Makeup con Next.js 15 + TS + Tailwind + shadcn/ui andando, el schema Prisma completo del blueprint 01 migrado contra Supabase, los design tokens del blueprint 02 aplicados, `design-system/MASTER.md` persistido, layout base + home placeholder, y CI (lint/typecheck/test) — listo para deployar a Cloudflare Workers.

**Architecture:** App Router con `src/`. Datos en Supabase Postgres vía Prisma (cliente singleton). Auth/Storage de Supabase vía `@supabase/ssr` (browser + server + service-role). Diseño girly-clean soft-UI: tokens como CSS vars (convención shadcn HSL) mapeados en `tailwind.config.ts`; tipografías con `next/font`. 100% serverless, sin piezas always-on.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind CSS 3.4 · shadcn/ui (Radix + CVA + tailwind-merge) · lucide-react · Prisma 6 + `@prisma/client` · `@supabase/supabase-js` + `@supabase/ssr` · Vitest · Playwright · ESLint (`eslint-config-next`) + Prettier · GitHub Actions · Cloudflare Workers (`@opennextjs/cloudflare`) · pnpm.

**Convenciones del proyecto (de los blueprints — NO confundir con otros proyectos):**
- Dinero: `Decimal(12,2)` en ARS (blueprint 01 §5). **NO** centavos-enteros.
- Enums de estado en **inglés británico**: `cancelled` (doble L), tal como blueprint 01 §4. (Opuesto a la convención de TurnoGol.)
- Timestamps UTC; conversión a ART solo en el front.
- Secrets solo en `.env.local` / `wrangler secret`; nunca en git ni en el chat (`.gitignore` ya los excluye).
- Siempre en rama, nunca `main` (playbook 09 §6). Esta rama: `m0-cimientos`.

---

## ⚠️ ADDENDUM (2026-06-04): Migración Vercel → Cloudflare Workers

Tras escribir este plan, el proyecto migró de Vercel a **Cloudflare Workers** (blueprints 07/08/09 actualizados). Estos puntos quedan **reemplazados**:

- **Deploy:** Cloudflare Workers vía **`@opennextjs/cloudflare`** (NO Vercel, NO `@cloudflare/next-on-pages`). Archivos nuevos: `wrangler.jsonc` (`nodejs_compat`, `compatibility_date 2024-12-30`, binding `assets`) + `open-next.config.ts`. **`vercel.json` eliminado.**
- **Prisma:** driver adapter **`@prisma/adapter-pg`** en `src/lib/prisma.ts`. `DATABASE_URL` → pooler 6543; `DIRECT_URL` → 5432 solo migraciones. La migración `init` ya aplicada sigue válida (las migraciones no usan el adapter).
- **`next.config.mjs`:** agrega `initOpenNextCloudflareForDev()`.
- **Scripts:** `build:worker`, `dev:worker` (`wrangler dev --port 8771`), `preview:worker`, `deploy`.
- **Crons:** Cloudflare Cron Triggers (no Vercel Cron) — se cablean en M4.
- **CI:** agrega step `build:worker` (verifica el build del Worker en Linux).
- **Deploy final:** `wrangler deploy` requiere `wrangler login` del usuario (handoff). El build del Worker se verifica en CI/Linux; en Windows local requiere Developer Mode (symlinks del output standalone).

El resto del plan (estructura, tokens, TDD de utils, schema, layout) se mantiene.

## File Structure

```
glamify-makeup/
├─ .github/workflows/ci.yml          # CI: install, prisma generate, lint, typecheck, test, build
├─ prisma/
│  └─ schema.prisma                  # schema COMPLETO del blueprint 01 (todas las entidades)
├─ design-system/
│  └─ MASTER.md                      # fuente de verdad visual (ux-ui-pro-max), tokens del 02
├─ scripts/
│  └─ setup-storage.ts               # crea bucket Supabase Storage `product-images` (idempotente)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                  # root layout: fuentes next/font, <body> con tokens
│  │  ├─ page.tsx                    # home placeholder on-brand (muestra tokens aplicados)
│  │  └─ globals.css                 # @tailwind + CSS vars (tokens shadcn HSL) + base
│  ├─ components/
│  │  └─ ui/
│  │     └─ button.tsx               # shadcn Button (prueba del pipeline shadcn)
│  └─ lib/
│     ├─ utils.ts                    # cn() (clsx + tailwind-merge)
│     ├─ prisma.ts                   # PrismaClient singleton (evita N clientes en dev)
│     ├─ sku.ts                      # generateSku() — pura, TDD
│     ├─ money.ts                    # formatARS() — pura, TDD
│     └─ supabase/
│        ├─ client.ts                # createBrowserClient (componentes cliente)
│        ├─ server.ts                # createServerClient (Server Components/Actions, cookies)
│        └─ admin.ts                 # service-role client (solo server, jobs/scripts)
├─ tests/
│  ├─ unit/
│  │  ├─ sku.test.ts
│  │  └─ money.test.ts
│  └─ e2e/
│     └─ home.spec.ts                # smoke e2e (home responde 200, marca visible)
├─ components.json                   # config shadcn (para `shadcn add` en M1+)
├─ tailwind.config.ts
├─ postcss.config.mjs
├─ next.config.mjs
├─ tsconfig.json
├─ vitest.config.ts
├─ playwright.config.ts
├─ .eslintrc.json
├─ .prettierrc.json
├─ .prettierignore
├─ wrangler.jsonc                    # config Cloudflare Workers (nodejs_compat)
├─ open-next.config.ts               # config OpenNext (adapter Cloudflare)
├─ package.json
├─ README.md
├─ .env.example                      # YA EXISTE (commitear)
└─ .gitignore                        # YA EXISTE
```

**Responsabilidad por archivo:** cada `lib/*` tiene una sola responsabilidad (cliente Prisma, cada cliente Supabase, cada util pura). Componentes shadcn en `components/ui`. Config en raíz. Tests separados por tipo en `tests/`.

---

## Task 0: Rama de trabajo

**Files:** ninguno (git).

- [ ] **Step 1: Crear y cambiar a la rama del milestone**

Run:
```bash
git -C "c:/Users/Lazar/Documents/glamify-makeup" checkout -b m0-cimientos
```
Expected: `Switched to a new branch 'm0-cimientos'`

---

## Task 1: package.json + instalación de dependencias

**Files:**
- Create: `package.json`

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "glamify-makeup",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "setup:storage": "tsx scripts/setup-storage.ts",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "@prisma/client": "^6.1.0",
    "@radix-ui/react-slot": "^1.1.1",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.47.10",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.469.0",
    "next": "^15.1.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@types/node": "^20.17.12",
    "@types/react": "^19.0.4",
    "@types/react-dom": "^19.0.2",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.1",
    "eslint-config-next": "^15.1.4",
    "postcss": "^8.4.49",
    "prettier": "^3.4.2",
    "prettier-plugin-tailwindcss": "^0.6.9",
    "prisma": "^6.1.0",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8"
  },
  "packageManager": "pnpm@8.15.0"
}
```

- [ ] **Step 2: Instalar dependencias**

Run:
```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm install
```
Expected: instala sin errores; genera `pnpm-lock.yaml`. (pnpm resuelve el patch más nuevo compatible de cada caret.)

- [ ] **Step 3: Instalar navegador de Playwright (chromium)**

Run:
```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm exec playwright install chromium
```
Expected: descarga chromium. (Si falla por red, no bloquea M0; el e2e queda como `test:e2e` opcional.)

---

## Task 2: Configuración base (TS, Next, PostCSS, Tailwind)

**Files:**
- Create: `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `next-env.d.ts` (lo genera Next)

- [ ] **Step 1: `tsconfig.json` (strict, alias `@/*`)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Supabase Storage público (host real se setea por env en M1)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 3: `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: `tailwind.config.ts` (tokens del blueprint 02, convención shadcn)**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1440px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // token de sección alterna (blueprint 02 §2: fondos alternos #FFF5FA)
        "surface-alt": "hsl(var(--surface-alt))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem", // cards ~16px (blueprint 02 §4)
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        // soft UI (blueprint 02 §4)
        soft: "0 2px 8px -2px rgba(110, 11, 63, 0.08), 0 4px 16px -4px rgba(255, 46, 147, 0.10)",
        "soft-lg": "0 8px 32px -8px rgba(255, 46, 147, 0.18)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 5: Verificar que TS compila el skeleton (todavía sin app, fallará por falta de archivos — OK)**

(No se corre aún; se valida en Task 10 cuando exista la app.)

---

## Task 3: Design tokens + globals.css (tokens APLICADOS)

**Files:**
- Create: `src/app/globals.css`

Tokens del blueprint 02 §2, convertidos a HSL (convención shadcn). Mapeo hex→HSL documentado en MASTER.md (Task 11).

- [ ] **Step 1: Crear `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* === Glamify Makeup — tokens (blueprint 02 §2) ===
       Light mode only (girly-clean, sin dark mode por ahora). */
    --background: 0 0% 100%; /* #FFFFFF */
    --foreground: 328 82% 24%; /* #6E0B3F vino oscuro */

    --card: 0 0% 100%;
    --card-foreground: 328 82% 24%;
    --popover: 0 0% 100%;
    --popover-foreground: 328 82% 24%;

    --primary: 331 100% 59%; /* #FF2E93 rosa eléctrico */
    --primary-hover: 331 76% 50%; /* #E01E7D */
    --primary-foreground: 0 0% 100%; /* #FFFFFF */

    --secondary: 328 100% 81%; /* #FF9ED1 rosa suave */
    --secondary-foreground: 328 82% 24%;

    --accent: 258 90% 66%; /* #8B5CF6 lavanda (pop opcional) */
    --accent-foreground: 0 0% 100%;

    --muted: 324 60% 96%; /* #FBEFF6 */
    --muted-foreground: 328 25% 45%;

    --destructive: 0 72% 51%; /* #DC2626 */
    --destructive-foreground: 0 0% 100%;

    --border: 326 84% 90%; /* #FBCFE8 */
    --input: 326 84% 90%;
    --ring: 331 100% 59%; /* focus rosa */

    --surface-alt: 330 100% 98%; /* #FFF5FA secciones alternas */

    --radius: 0.75rem; /* botones ~12px; cards usan rounded-2xl (16px) */
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
    /* body 16px mínimo en mobile (evita auto-zoom iOS) */
    font-size: 16px;
  }
  h1,
  h2,
  h3,
  h4 {
    @apply font-display;
  }
  /* Números tabulares para precios/totales (blueprint 02 §3) */
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Task 4: shadcn pipeline (cn + components.json + Button)

**Files:**
- Create: `src/lib/utils.ts`, `components.json`, `src/components/ui/button.tsx`

- [ ] **Step 1: `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: `components.json` (para `shadcn add` en M1+)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "rose",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 3: `src/components/ui/button.tsx` (shadcn Button con tokens de marca)**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:brightness-95",
        outline:
          "border border-border bg-background text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-95",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2", // touch target >= 44px (blueprint 02 §10)
        sm: "h-9 px-4",
        lg: "h-12 px-8 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

---

## Task 5: Clientes Supabase + Prisma singleton

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/lib/prisma.ts`

- [ ] **Step 1: `src/lib/supabase/client.ts` (browser)**

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: `src/lib/supabase/server.ts` (Server Components / Actions)**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: ignorable si hay middleware refrescando sesión.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: `src/lib/supabase/admin.ts` (service role — SOLO server)**

```ts
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Cliente con service-role: bypassa RLS. Usar SOLO en server (jobs, scripts, webhooks). */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

- [ ] **Step 4: `src/lib/prisma.ts` (singleton)**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

> Nota: `@prisma/client` no genera tipos hasta `prisma generate` (Task 6). El typecheck/build de Task 14 corren después de generar.

---

## Task 6: Prisma schema completo (blueprint 01)

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Crear `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ============ ENUMS (blueprint 01 §4 — inglés británico: cancelled) ============
enum OrderStatus {
  pending_payment
  paid
  preparing
  shipped
  delivered
  cancelled
  refunded
}

enum PaymentStatus {
  pending
  approved
  rejected
  in_process
  refunded
  cancelled
}

enum PaymentProvider {
  mercadopago
}

enum ShipmentStatus {
  pending
  ready
  dispatched
  in_transit
  delivered
  returned
}

enum ShipmentCarrier {
  correo_argentino
}

enum ShippingMethod {
  domicilio
  sucursal
}

enum ShippingZoneMatchType {
  province
  cpRange
}

enum CartStatus {
  active
  ordered
  abandoned
}

enum CouponType {
  percentage
  fixed
  free_shipping
}

enum CouponScope {
  all
  category
  product
}

enum UserRole {
  owner
  admin
}

enum ReviewStatus {
  pending
  approved
  rejected
}

// ============ CATÁLOGO ============
model Category {
  id        String     @id @default(uuid()) @db.Uuid
  slug      String     @unique
  name      String
  parentId  String?    @db.Uuid
  parent    Category?  @relation("CategoryToChildren", fields: [parentId], references: [id], onDelete: SetNull)
  children  Category[] @relation("CategoryToChildren")
  skuPrefix String     @db.VarChar(3)
  image     String?
  order     Int        @default(0)
  active    Boolean    @default(true)
  products  Product[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model Product {
  id             String           @id @default(uuid()) @db.Uuid
  slug           String           @unique
  name           String
  description    String?
  categoryId     String           @db.Uuid
  category       Category         @relation(fields: [categoryId], references: [id])
  basePrice      Decimal          @db.Decimal(12, 2)
  cost           Decimal          @db.Decimal(12, 2)
  weightGr       Int
  images         String[]
  isFeatured     Boolean          @default(false)
  heroRank       Int?
  tags           String[]
  seoTitle       String?
  seoDescription String?
  active         Boolean          @default(true)
  variants       ProductVariant[]
  reviews        Review[]
  wishlistedBy   Wishlist[]
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  deletedAt      DateTime?

  @@index([categoryId])
}

model ProductVariant {
  id                String      @id @default(uuid()) @db.Uuid
  productId         String      @db.Uuid
  product           Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  name              String
  sku               String      @unique
  priceOverride     Decimal?    @db.Decimal(12, 2)
  stock             Int         @default(0)
  lowStockThreshold Int         @default(3)
  weightGrOverride  Int?
  image             String?
  active            Boolean     @default(true)
  order             Int         @default(0)
  comboItems        ComboItem[]
  cartItems         CartItem[]
  orderItems        OrderItem[]

  @@index([productId])
}

model Combo {
  id          String      @id @default(uuid()) @db.Uuid
  slug        String      @unique
  name        String
  description String?
  comboPrice  Decimal     @db.Decimal(12, 2)
  images      String[]
  active      Boolean     @default(true)
  validFrom   DateTime?
  validTo     DateTime?
  items       ComboItem[]
  cartItems   CartItem[]
  orderItems  OrderItem[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model ComboItem {
  id        String         @id @default(uuid()) @db.Uuid
  comboId   String         @db.Uuid
  combo     Combo          @relation(fields: [comboId], references: [id], onDelete: Cascade)
  variantId String         @db.Uuid
  variant   ProductVariant @relation(fields: [variantId], references: [id])
  qty       Int

  @@index([comboId])
}

// ============ CLIENTAS ============
model Customer {
  id        String     @id @db.Uuid // = uid de Supabase Auth
  email     String     @unique
  name      String?
  phone     String?
  addresses Address[]
  wishlist  Wishlist[]
  reviews   Review[]
  carts     Cart[]
  orders    Order[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model Address {
  id            String   @id @default(uuid()) @db.Uuid
  customerId    String   @db.Uuid
  customer      Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  recipientName String
  phone         String
  street        String
  number        String
  floorApt      String?
  city          String
  province      String
  postalCode    String
  notes         String?
  isDefault     Boolean  @default(false)

  @@index([customerId])
  @@index([postalCode])
}

model Wishlist {
  customerId String   @db.Uuid
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  productId  String   @db.Uuid
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@id([customerId, productId])
}

model Review {
  id               String       @id @default(uuid()) @db.Uuid
  productId        String       @db.Uuid
  product          Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  customerId       String?      @db.Uuid
  customer         Customer?    @relation(fields: [customerId], references: [id], onDelete: SetNull)
  authorName       String
  rating           Int
  title            String?
  body             String
  photoUrl         String?
  verifiedPurchase Boolean      @default(false)
  status           ReviewStatus @default(pending)
  createdAt        DateTime     @default(now())

  @@index([productId])
}

// ============ VENTAS ============
model Cart {
  id           String     @id @default(uuid()) @db.Uuid
  customerId   String?    @db.Uuid
  customer     Customer?  @relation(fields: [customerId], references: [id], onDelete: SetNull)
  sessionId    String?
  status       CartStatus @default(active)
  contactEmail String?
  contactPhone String?
  items        CartItem[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([sessionId])
}

model CartItem {
  id                String          @id @default(uuid()) @db.Uuid
  cartId            String          @db.Uuid
  cart              Cart            @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variantId         String?         @db.Uuid
  variant           ProductVariant? @relation(fields: [variantId], references: [id])
  comboId           String?         @db.Uuid
  combo             Combo?          @relation(fields: [comboId], references: [id])
  qty               Int
  unitPriceSnapshot Decimal         @db.Decimal(12, 2)

  @@index([cartId])
}

model Order {
  id              String         @id @default(uuid()) @db.Uuid
  orderNumber     String         @unique
  customerId      String?        @db.Uuid
  customer        Customer?      @relation(fields: [customerId], references: [id], onDelete: SetNull)
  contactName     String
  contactEmail    String
  contactPhone    String
  shippingAddress Json
  shippingMethod  ShippingMethod
  shippingZoneId  String?        @db.Uuid
  shippingZone    ShippingZone?  @relation(fields: [shippingZoneId], references: [id])
  subtotal        Decimal        @db.Decimal(12, 2)
  shippingCost    Decimal        @db.Decimal(12, 2)
  discountTotal   Decimal        @default(0) @db.Decimal(12, 2)
  total           Decimal        @db.Decimal(12, 2)
  couponId        String?        @db.Uuid
  coupon          Coupon?        @relation(fields: [couponId], references: [id])
  status          OrderStatus    @default(pending_payment)
  items           OrderItem[]
  payments        Payment[]
  shipment        Shipment?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([customerId])
  @@index([status])
}

model OrderItem {
  id                  String          @id @default(uuid()) @db.Uuid
  orderId             String          @db.Uuid
  order               Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId           String?         @db.Uuid
  variant             ProductVariant? @relation(fields: [variantId], references: [id])
  comboId             String?         @db.Uuid
  combo               Combo?          @relation(fields: [comboId], references: [id])
  productNameSnapshot String
  variantNameSnapshot String?
  skuSnapshot         String?
  unitPriceSnapshot   Decimal         @db.Decimal(12, 2)
  qty                 Int
  lineTotal           Decimal         @db.Decimal(12, 2)

  @@index([orderId])
}

model Payment {
  id             String          @id @default(uuid()) @db.Uuid
  orderId        String          @db.Uuid
  order          Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  provider       PaymentProvider @default(mercadopago)
  mpPreferenceId String?
  mpPaymentId    String?         @unique
  status         PaymentStatus   @default(pending)
  amount         Decimal         @db.Decimal(12, 2)
  rawPayload     Json?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([orderId])
}

// ============ ENVÍOS ============
model ShippingZone {
  id        String                @id @default(uuid()) @db.Uuid
  name      String
  matchType ShippingZoneMatchType
  provinces String[]
  cpFrom    String?
  cpTo      String?
  price     Decimal               @db.Decimal(12, 2)
  active    Boolean               @default(true)
  order     Int                   @default(0)
  orders    Order[]
}

model Shipment {
  id             String          @id @default(uuid()) @db.Uuid
  orderId        String          @unique @db.Uuid
  order          Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  carrier        ShipmentCarrier @default(correo_argentino)
  service        String?
  trackingNumber String?
  status         ShipmentStatus  @default(pending)
  labelUrl       String?
  cost           Decimal         @db.Decimal(12, 2)
  createdAt      DateTime        @default(now())
}

// ============ PROMOS ============
model Coupon {
  id               String      @id @default(uuid()) @db.Uuid
  code             String      @unique
  type             CouponType
  value            Decimal     @db.Decimal(12, 2)
  scope            CouponScope @default(all)
  minSubtotal      Decimal?    @db.Decimal(12, 2)
  maxUses          Int?
  usedCount        Int         @default(0)
  perCustomerLimit Int?
  validFrom        DateTime?
  validTo          DateTime?
  active           Boolean     @default(true)
  orders           Order[]
}

// ============ SISTEMA ============
model User {
  id        String   @id @db.Uuid // = uid de Supabase Auth
  email     String   @unique
  role      UserRole @default(admin)
  createdAt DateTime @default(now())
}

model Setting {
  id                    String   @id @default("default")
  storeName             String   @default("Glamify Makeup")
  freeShippingThreshold Decimal  @default(47500) @db.Decimal(12, 2)
  originPostalCode      String   @default("6700")
  whatsappNumber        String?
  instagramUrl          String?
  tiktokUrl             String?
  updatedAt             DateTime @updatedAt
}
```

- [ ] **Step 2: Generar el cliente Prisma**

Run:
```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm prisma generate
```
Expected: `Generated Prisma Client`. (Valida que el schema parsea antes de migrar.)

- [ ] **Step 3: Migración real contra Supabase**

Run:
```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm prisma migrate dev --name init
```
Expected: crea `prisma/migrations/<ts>_init/migration.sql`, aplica contra la DB de Supabase (usa `DIRECT_URL`), imprime `Your database is now in sync with your schema.`

> Esto **escribe en la DB real** de Supabase (proyecto fresco/vacío). Está autorizado por el DoD del M0 ("DB migrada"). Si la DB no estuviera vacía, `migrate dev` pediría confirmación de reset — en ese caso, parar y avisar.

---

## Task 7: TDD — generador de SKU

**Files:**
- Create: `src/lib/sku.ts`, `tests/unit/sku.test.ts`

Formato (blueprint 01 §3): `{PREFIJO}-{NNNN}`, prefijo 3 letras mayúsculas, secuencia por categoría, padding a 4 dígitos.

- [ ] **Step 1: Escribir el test que falla**

`tests/unit/sku.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { generateSku, isValidSku } from "@/lib/sku";

describe("generateSku", () => {
  it("formatea prefijo + secuencia con padding a 4 dígitos", () => {
    expect(generateSku("LAB", 7)).toBe("LAB-0007");
    expect(generateSku("RUB", 3)).toBe("RUB-0003");
  });

  it("normaliza el prefijo a 3 letras mayúsculas", () => {
    expect(generateSku("lab", 1)).toBe("LAB-0001");
    expect(generateSku("La", 1)).toBe("LA-0001");
    expect(generateSku("labial", 12)).toBe("LAB-0012");
  });

  it("no rompe el padding si la secuencia tiene 4+ dígitos", () => {
    expect(generateSku("MAS", 1234)).toBe("MAS-1234");
    expect(generateSku("MAS", 12345)).toBe("MAS-12345");
  });

  it("rechaza secuencias inválidas", () => {
    expect(() => generateSku("LAB", 0)).toThrow();
    expect(() => generateSku("LAB", -1)).toThrow();
    expect(() => generateSku("LAB", 1.5)).toThrow();
  });

  it("rechaza prefijos no alfabéticos o vacíos", () => {
    expect(() => generateSku("", 1)).toThrow();
    expect(() => generateSku("L1", 1)).toThrow();
  });
});

describe("isValidSku", () => {
  it("valida el formato PREFIJO-NNNN", () => {
    expect(isValidSku("LAB-0007")).toBe(true);
    expect(isValidSku("MAS-12345")).toBe(true);
    expect(isValidSku("lab-0007")).toBe(false);
    expect(isValidSku("LAB-12")).toBe(false);
    expect(isValidSku("LAB0007")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test → debe FALLAR**

Run: `cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm vitest run tests/unit/sku.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/sku"` (no existe aún).

- [ ] **Step 3: Implementación mínima `src/lib/sku.ts`**

```ts
/**
 * Generador de SKU (blueprint 01 §3).
 * Formato: {PREFIJO}-{NNNN} — prefijo de hasta 3 letras (de Category.skuPrefix),
 * secuencia por categoría con padding mínimo a 4 dígitos.
 */
export function generateSku(prefix: string, sequence: number): string {
  const clean = prefix.trim().toUpperCase().slice(0, 3);
  if (!/^[A-Z]{1,3}$/.test(clean)) {
    throw new Error(`Prefijo de SKU inválido: "${prefix}"`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Secuencia de SKU inválida: ${sequence}`);
  }
  return `${clean}-${String(sequence).padStart(4, "0")}`;
}

export function isValidSku(sku: string): boolean {
  return /^[A-Z]{1,3}-\d{4,}$/.test(sku);
}
```

- [ ] **Step 4: Correr el test → debe PASAR**

Run: `cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm vitest run tests/unit/sku.test.ts`
Expected: PASS (todos los casos).

---

## Task 8: TDD — formato de precios ARS

**Files:**
- Create: `src/lib/money.ts`, `tests/unit/money.test.ts`

Dinero en `Decimal(12,2)` ARS. Display formato es-AR (`$1.500,00`).

- [ ] **Step 1: Escribir el test que falla**

`tests/unit/money.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatARS, parseDecimal } from "@/lib/money";

describe("formatARS", () => {
  it("formatea con separador de miles y 2 decimales (es-AR)", () => {
    //   = espacio no separable que usa Intl entre símbolo y número
    expect(formatARS(1500)).toBe("$ 1.500,00");
    expect(formatARS(47500)).toBe("$ 47.500,00");
    expect(formatARS(0)).toBe("$ 0,00");
  });

  it("acepta strings de Prisma Decimal", () => {
    expect(formatARS("999.9")).toBe("$ 999,90");
  });

  it("redondea a 2 decimales", () => {
    expect(formatARS(10.005)).toBe("$ 10,01");
  });
});

describe("parseDecimal", () => {
  it("convierte distintos inputs a number", () => {
    expect(parseDecimal("1234.5")).toBe(1234.5);
    expect(parseDecimal(10)).toBe(10);
  });

  it("rechaza valores no numéricos", () => {
    expect(() => parseDecimal("abc")).toThrow();
  });
});
```

- [ ] **Step 2: Correr el test → debe FALLAR**

Run: `cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm vitest run tests/unit/money.test.ts`
Expected: FAIL — import no resuelve.

- [ ] **Step 3: Implementación `src/lib/money.ts`**

```ts
/** Utilidades de dinero: ARS, Decimal(12,2). Display en es-AR. */

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseDecimal(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Monto inválido: ${value}`);
  }
  return n;
}

export function formatARS(value: number | string): string {
  return ARS.format(parseDecimal(value));
}
```

- [ ] **Step 4: Correr el test → debe PASAR**

Run: `cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm vitest run tests/unit/money.test.ts`
Expected: PASS.

> Si el runtime de Node formatea con un espacio distinto, ajustar el ` ` esperado al carácter real que emite `Intl` en este Node (verificar el output del primer run y fijar el test al carácter correcto). No cambiar la implementación por esto.

---

## Task 9: Config de Vitest

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: `vitest.config.ts` (entorno node, alias `@`)**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 2: Correr toda la suite unit**

Run: `cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm test`
Expected: PASS — 2 archivos, todos los tests verdes.

---

## Task 10: Layout base + home placeholder + e2e smoke

**Files:**
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `tests/e2e/home.spec.ts`, `playwright.config.ts`

- [ ] **Step 1: `src/app/layout.tsx` (fuentes next/font, metadata, tokens)**

```tsx
import type { Metadata, Viewport } from "next";
import { Playfair_Display, Nunito_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glamify Makeup — Maquillaje y accesorios",
  description:
    "Glam accesible: maquillaje y accesorios lindos, en tendencia y a buen precio. Envíos a todo el país.",
};

export const viewport: Viewport = {
  themeColor: "#FF2E93",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${playfair.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: `src/app/page.tsx` (home placeholder on-brand — DEMUESTRA tokens)**

```tsx
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-surface-alt px-6 py-16 text-center">
      <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-primary">
        <Sparkles className="size-4" />
        Próximamente
      </span>

      <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
        Glamify <span className="text-primary">Makeup</span>
      </h1>

      <p className="max-w-md text-balance text-base text-muted-foreground sm:text-lg">
        Glam accesible: maquillaje y accesorios lindos, en tendencia y a buen
        precio. Estamos preparando la tienda. 💄
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg">Ver tienda</Button>
        <Button size="lg" variant="outline">
          Conocer la marca
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} Glamify Makeup · Luján, Buenos Aires
      </p>
    </main>
  );
}
```

- [ ] **Step 3: `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 4: `tests/e2e/home.spec.ts` (smoke)**

```ts
import { test, expect } from "@playwright/test";

test("la home responde y muestra la marca", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Glamify",
  );
  await expect(page.getByRole("button", { name: "Ver tienda" })).toBeVisible();
});
```

- [ ] **Step 5: Typecheck + build (valida tokens, fuentes, shadcn, alias)**

Run:
```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm typecheck && pnpm build
```
Expected: typecheck sin errores; `next build` compila `/` como ruta estática. (Requiere `prisma generate` ya corrido en Task 6.)

---

## Task 11: design-system/MASTER.md (ux-ui-pro-max)

**Files:**
- Create: `design-system/MASTER.md`

- [ ] **Step 1: Invocar la skill `ui-ux-pro-max:ui-ux-pro-max`** para generar/validar el sistema de diseño a partir del blueprint 02, y persistir `design-system/MASTER.md` con: paleta (hex + token + HSL), tipografías (Playfair/Nunito, escala), radios/sombras/spacing, principios (soft-UI, mobile-first, a11y AA), tabla hex→token→clase Tailwind, y reglas de uso del rosa eléctrico "con disciplina". El contenido debe reflejar exactamente los tokens implementados en `globals.css` y `tailwind.config.ts`.

- [ ] **Step 2: Verificar coherencia** — cada color de `globals.css` aparece en MASTER.md con su hex de origen del blueprint 02 §2, y los nombres de token/clase coinciden con `tailwind.config.ts`.

---

## Task 12: CI (GitHub Actions) + lint/format config

**Files:**
- Create: `.eslintrc.json`, `.prettierrc.json`, `.prettierignore`, `.github/workflows/ci.yml`

- [ ] **Step 1: `.eslintrc.json`**

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"]
}
```

- [ ] **Step 2: `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 3: `.prettierignore`**

```
node_modules
.next
pnpm-lock.yaml
prisma/migrations
```

- [ ] **Step 4: Correr lint + format check localmente**

Run:
```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm lint && pnpm format:check
```
Expected: lint sin errores. Si `format:check` marca diffs, correr `pnpm format` y re-chequear.

- [ ] **Step 5: `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 8.15.0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Prisma generate
        run: pnpm prisma generate

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test

      - name: Build
        run: pnpm build
        env:
          # Build no requiere DB real; placeholders para que next build no falle.
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          DATABASE_URL: postgresql://placeholder
          DIRECT_URL: postgresql://placeholder
```

---

## Task 13: README + wrangler.jsonc/open-next.config.ts + script de Storage

**Files:**
- Create: `README.md`, `wrangler.jsonc`, `open-next.config.ts`, `scripts/setup-storage.ts`

- [ ] **Step 1: `wrangler.jsonc` + `open-next.config.ts` (Cloudflare Workers)**

`wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "glamify-makeup",
  "main": ".open-next/worker.js",
  "compatibility_date": "2024-12-30",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" }
}
```

`open-next.config.ts`:
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig();
```

- [ ] **Step 2: `scripts/setup-storage.ts` (bucket idempotente)**

```ts
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "product-images";

async function main() {
  const supabase = createAdminClient();
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;

  if (buckets?.some((b) => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" ya existe — nada que hacer.`);
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/avif"],
  });
  if (error) throw error;
  console.log(`Bucket "${BUCKET}" creado (público, imágenes).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

> El script usa el alias `@`; correrlo con `pnpm setup:storage` (tsx con resolución de paths via tsconfig). Si `tsx` no resuelve `@`, usar import relativo `../src/lib/supabase/admin`. Requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`.

- [ ] **Step 3: Crear el bucket (verificación de Storage)**

Run:
```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm setup:storage
```
Expected: `Bucket "product-images" creado` (o "ya existe").

- [ ] **Step 4: `README.md`**

```markdown
# Glamify Makeup

Tienda online de Glamify Makeup — ecommerce custom (Next.js 15 + Supabase + Prisma + Cloudflare Workers).
Fuente de verdad del producto: [`blueprints/`](blueprints/) (00–09). Plan de M0: [`docs/superpowers/plans/`](docs/superpowers/plans/). Sistema de diseño: [`design-system/MASTER.md`](design-system/MASTER.md).

## Stack
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3 · shadcn/ui · Prisma 6 · Supabase (Postgres/Auth/Storage) · Vitest · Playwright · Cloudflare Workers (@opennextjs/cloudflare).

## Desarrollo
\`\`\`bash
pnpm install
cp .env.example .env.local   # completar con credenciales (ver SETUP.md)
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
\`\`\`

## Scripts
- \`pnpm dev\` — desarrollo
- \`pnpm build\` — prisma generate + next build
- \`pnpm typecheck\` / \`pnpm lint\` / \`pnpm test\` / \`pnpm test:e2e\`
- \`pnpm db:migrate\` / \`pnpm db:studio\` / \`pnpm setup:storage\`

## Convenciones
- Dinero: \`Decimal(12,2)\` ARS. Estados en inglés británico (\`cancelled\`).
- Timestamps UTC; conversión a ART en el front.
- Secrets solo en \`.env.local\` / \`wrangler secret\` (nunca en git).
- Rama por milestone; PR + code-review antes de \`main\`.
```

---

## Task 14: Verificación final + commit + push

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa de verificación**

Run:
```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm prisma generate && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: TODO verde (lint, typecheck, 2 archivos de test, build OK).

- [ ] **Step 2: Confirmar migración aplicada**

Run:
```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && pnpm prisma migrate status
```
Expected: `Database schema is up to date!`

- [ ] **Step 3: Commit en la rama**

```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && git add -A && git commit -m "M0: cimientos — Next.js 15 + Prisma + tokens + CI

- Scaffolding Next.js 15 (App Router) + TS strict + Tailwind 3 + shadcn/ui
- Schema Prisma completo (blueprint 01) + migracion init contra Supabase
- Design tokens del blueprint 02 (rosa electrico, Playfair/Nunito, soft UI)
- design-system/MASTER.md (ux-ui-pro-max)
- Utils SKU + ARS con TDD; layout base + home placeholder
- CI (lint/typecheck/test/build) + wrangler.jsonc + script de Storage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push de la rama**

```bash
cd "c:/Users/Lazar/Documents/glamify-makeup" && git push -u origin m0-cimientos
```
Expected: rama publicada en `titi2233/glamify-makeup`. (Si el SSH del alias `github-titi` pide passphrase o falla, surface al usuario.)

---

## Task 15: Handoff de deploy a Cloudflare Workers (acción del usuario)

> El build del Worker (`pnpm build:worker`) se verifica en CI/Linux. El `wrangler deploy` final requiere auth de Cloudflare del usuario.

- [ ] **Pasos para el usuario:**
  1. `wrangler login` (o `CLOUDFLARE_API_TOKEN` en el entorno).
  2. Cargar secrets: `wrangler secret put DATABASE_URL` (pooler 6543), `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`; públicas (`NEXT_PUBLIC_*`) como vars.
  3. `pnpm deploy` (= `build:worker && wrangler deploy`) — o conectar el repo en el dashboard de Cloudflare Workers (deploy automático + previews por PR).
  4. Custom domain `glamifymakeup.site` en Workers → Custom Domains.

---

## Self-Review (checklist contra el spec)

**Cobertura del DoD de M0** (blueprint 08 §M0 + prompt):
- Next.js 15 + TS + Tailwind + shadcn/ui → Tasks 1–4, 10. ✔
- Supabase (Postgres+Auth+Storage) + Prisma con schema del 01 → Tasks 5, 6, 13. ✔
- Design tokens del 02 (#FF2E93, Playfair/Nunito, soft UI) + MASTER.md → Tasks 3, 11. ✔
- Layout base + estructura de carpetas → Task 10 + File Structure. ✔
- CI (lint/typecheck/test) → Task 12. ✔
- Deploy a Cloudflare Workers → Task 13 (config) + Task 15 (handoff). ⚠️ requiere acción del usuario.
- Verificar build OK / migración corre → Task 14. ✔  Deploy OK → Task 15 (usuario). ⚠️
- DoD: home placeholder ✔ (Task 10) · DB migrada ✔ (Task 6) · tokens aplicados ✔ (Tasks 3,10,11).

**Placeholders:** ninguno — todos los archivos tienen contenido real.

**Consistencia de tipos/nombres:** tokens de color usan los mismos nombres en `globals.css` (HSL vars), `tailwind.config.ts` (`hsl(var(--…))`) y MASTER.md. `generateSku`/`isValidSku`, `formatARS`/`parseDecimal`, `createClient`/`createAdminClient`, `prisma` — todos consistentes entre tasks. Enums en británico `cancelled` en todo el schema.

**Riesgos conocidos:**
- Resolución de versiones por caret (pnpm elige patch nuevo); si algún paquete trae breaking, fijar la versión exacta.
- `Intl` puede emitir un espacio distinto entre `$` y el número según Node → ajustar el esperado del test de `money` al carácter real (Task 8 Step 4 nota).
- Deploy a Cloudflare Workers y push SSH dependen de credenciales del usuario.
