# M3 — Panel de administración Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the owner-facing admin panel: auth-gated `/admin/*` shell, a basic stats dashboard, full CRUD for Category / Product+Variant / Combo / Coupon, and order management (manual state change + cancellation) with shipment tracking.

**Architecture:** Route group `src/app/admin/(panel)/` with its own layout (no storefront chrome), guarded by `requireAdmin()` (Supabase Auth + `User`-table role gate) at both the layout and every Server Action. Reads via Server Components, mutations via Server Actions returning `AdminResult`. Domain logic lives as pure functions (`src/lib/admin/<module>/validation.ts`, tested in `tests/unit`) plus services that orchestrate Prisma transactions through an injectable `deps.db` seam (tested in `tests/integration` with mocked db), mirroring the existing `checkout-service.ts` pattern. No schema migration expected — all entities/enums already exist.

**Tech Stack:** Next.js 15 (App Router) · TypeScript strict · Prisma + `@prisma/adapter-pg` · Supabase Auth/Storage · shadcn/ui + Tailwind · Vitest + Playwright · pnpm.

**Spec:** `docs/superpowers/specs/2026-06-05-m3-panel-admin-design.md`
**Branch:** `m3-admin`. Run `pnpm typecheck` + `pnpm test` after each task; commit on green.

## Execution order

Implement sections top-to-bottom. **FOUNDATIONS** and **AUTH** are prerequisites for everything (shared types, `requireAdmin`, admin shell, UI primitives). The four CRUD modules (CATEGORIES → PRODUCTS → COMBOS → COUPONS) are independent of each other and may be done in any order or in parallel once foundations land. **DASHBOARD** and **ORDERS** depend only on foundations/auth. **E2E_HOUSEKEEPING** is last (needs the panel working end-to-end).

Task IDs are module-prefixed (e.g. `Task PRODUCTS-3`); they are not globally renumbered.

---

## FOUNDATIONS — Result, slug, sku, UI primitives, admin shell

Base layer for the M3 admin panel: the shared `AdminResult` type, the pure `slugify`/SKU helpers used by every CRUD module, the missing shadcn primitives (`table`, `badge`, `label`, `textarea`, `switch`), and the admin shell components (`AdminSidebar`, `PageHeader`, `ConfirmDialog`). Everything here is consumed by AUTH, CATEGORIES, PRODUCTS, COMBOS, COUPONS, DASHBOARD and ORDERS — those sections reference these files, they do not redefine them.

**Files**
- Create `src/lib/admin/result.ts` — `AdminResult` interface.
- Create `src/lib/admin/slug.ts` — pure `slugify`.
- Create `src/lib/admin/sku.ts` — pure `isValidSkuPrefix`, `nextSkuSequence` (re-exports `generateSku`).
- Create `src/components/ui/table.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/label.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/switch.tsx`.
- Create `src/components/admin/admin-sidebar.tsx`, `src/components/admin/page-header.tsx`, `src/components/admin/confirm-dialog.tsx`.
- Test `tests/unit/admin/slug.test.ts`, `tests/unit/admin/sku.test.ts`.
- Modify `package.json` / lockfile (via `pnpm add` of two radix deps).

---

### Task FOUNDATIONS-1: `AdminResult` shared type

**Files**
- Create `src/lib/admin/result.ts`.

- [ ] **Step 1: Create the shared result type (UI-only, no unit test).** Write `src/lib/admin/result.ts` with the EXACT shape from the contract — every admin Server Action returns this:

```ts
/**
 * Resultado uniforme de toda Server Action del panel admin (M3).
 * `ok:false` siempre trae `error` legible para la dueña; `ok:true` puede traer
 * el `id` del registro creado/editado para redirigir.
 */
export interface AdminResult {
  ok: boolean;
  error?: string;
  id?: string;
}
```

- [ ] **Step 2: Typecheck.**
  - Run: `pnpm typecheck`
  - Expected: passes (no errors).
- [ ] **Step 3: Commit.**
  - Run:
    ```
    git add src/lib/admin/result.ts
    git commit -m "$(cat <<'EOF'
feat(m3): AdminResult, tipo de retorno uniforme de server actions admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-2: pure `slugify`

**Files**
- Create `tests/unit/admin/slug.test.ts`.
- Create `src/lib/admin/slug.ts`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/admin/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/admin/slug";

describe("slugify", () => {
  it("pasa a minúsculas y reemplaza espacios por guiones", () => {
    expect(slugify("Labial Mate")).toBe("labial-mate");
    expect(slugify("Sombra de Ojos")).toBe("sombra-de-ojos");
  });

  it("saca acentos y la ñ", () => {
    expect(slugify("Máscara de Pestañas")).toBe("mascara-de-pestanas");
    expect(slugify("Rubor Melocotón")).toBe("rubor-melocoton");
  });

  it("colapsa espacios/guiones repetidos y recorta extremos", () => {
    expect(slugify("  Labial   Rojo  ")).toBe("labial-rojo");
    expect(slugify("Glam --- Total")).toBe("glam-total");
    expect(slugify("---hola---")).toBe("hola");
  });

  it("elimina símbolos que no sean letra/número/guion", () => {
    expect(slugify("Set 3x1 (¡oferta!)")).toBe("set-3x1-oferta");
    expect(slugify("Kit #1 · Glow")).toBe("kit-1-glow");
  });

  it("devuelve cadena vacía si no queda nada útil", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});
```
  - Run: `pnpm test -- tests/unit/admin/slug.test.ts`
  - Expected: FAIL (cannot find module `@/lib/admin/slug`).

- [ ] **Step 2: Implement `slugify`.** Create `src/lib/admin/slug.ts`:

```ts
/**
 * Genera un slug URL-safe a partir de un nombre (M3 admin).
 * minúsculas → saca acentos/ñ → todo lo no [a-z0-9] pasa a guion → colapsa y recorta.
 * Pura, sin DB: la unicidad la chequea el servicio contra la base.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca tildes (incluye la tilde de la ñ → n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // cualquier cosa rara → guion
    .replace(/-+/g, "-") // colapsa guiones repetidos
    .replace(/^-+|-+$/g, ""); // recorta guiones de los extremos
}
```
  - Run: `pnpm test -- tests/unit/admin/slug.test.ts`
  - Expected: PASS (all assertions green).

- [ ] **Step 3: Typecheck.**
  - Run: `pnpm typecheck`
  - Expected: passes.
- [ ] **Step 4: Commit.**
  - Run:
    ```
    git add src/lib/admin/slug.ts tests/unit/admin/slug.test.ts
    git commit -m "$(cat <<'EOF'
feat(m3): slugify puro para nombres de catálogo (admin)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-3: pure SKU helpers (`isValidSkuPrefix`, `nextSkuSequence`)

**Files**
- Create `tests/unit/admin/sku.test.ts`.
- Create `src/lib/admin/sku.ts`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/admin/sku.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isValidSkuPrefix, nextSkuSequence, generateSku } from "@/lib/admin/sku";

describe("isValidSkuPrefix", () => {
  it("acepta 1 a 3 letras A-Z mayúsculas", () => {
    expect(isValidSkuPrefix("L")).toBe(true);
    expect(isValidSkuPrefix("LA")).toBe(true);
    expect(isValidSkuPrefix("LAB")).toBe(true);
  });

  it("rechaza minúsculas, números, vacío y más de 3 letras", () => {
    expect(isValidSkuPrefix("lab")).toBe(false);
    expect(isValidSkuPrefix("LA1")).toBe(false);
    expect(isValidSkuPrefix("")).toBe(false);
    expect(isValidSkuPrefix("LABS")).toBe(false);
    expect(isValidSkuPrefix("L-B")).toBe(false);
  });
});

describe("nextSkuSequence", () => {
  it("devuelve 1 cuando no hay SKUs", () => {
    expect(nextSkuSequence([])).toBe(1);
  });

  it("devuelve el máximo número final + 1", () => {
    expect(nextSkuSequence(["LAB-0001", "LAB-0002", "LAB-0003"])).toBe(4);
    expect(nextSkuSequence(["LAB-0007"])).toBe(8);
  });

  it("usa el máximo aunque vengan desordenados o de distinto prefijo", () => {
    expect(nextSkuSequence(["RUB-0010", "LAB-0002", "LAB-0009"])).toBe(11);
  });

  it("ignora SKUs malformados o sin número final", () => {
    expect(nextSkuSequence(["LAB-0002", "roto", "LAB-", "SIN-NUMERO", "LAB-0005"])).toBe(6);
  });

  it("ignora todos los malformados y cae a 1", () => {
    expect(nextSkuSequence(["roto", "tambien-roto"])).toBe(1);
  });

  it("toma SKUs con 5+ dígitos", () => {
    expect(nextSkuSequence(["MAS-12345"])).toBe(12346);
  });
});

describe("generateSku (re-export)", () => {
  it("queda disponible desde el módulo admin/sku", () => {
    expect(generateSku("LAB", nextSkuSequence(["LAB-0006"]))).toBe("LAB-0007");
  });
});
```
  - Run: `pnpm test -- tests/unit/admin/sku.test.ts`
  - Expected: FAIL (cannot find module `@/lib/admin/sku`).

- [ ] **Step 2: Implement the SKU helpers.** Create `src/lib/admin/sku.ts`:

```ts
import { generateSku } from "@/lib/sku";

// Re-export para que los módulos admin importen todo lo de SKU desde acá.
export { generateSku };

/**
 * Valida un prefijo de SKU de categoría: 1 a 3 letras A-Z mayúsculas.
 * (El generador `generateSku` exige el mismo formato; esto valida en el form.)
 */
export function isValidSkuPrefix(p: string): boolean {
  return /^[A-Z]{1,3}$/.test(p);
}

/**
 * Próxima secuencia para un prefijo dado: máximo número final entre los SKUs
 * existentes + 1; si no hay ninguno válido, 1. Ignora SKUs malformados.
 * Pura — el servicio le pasa los SKUs ya filtrados por prefijo desde la tx.
 */
export function nextSkuSequence(existingSkus: string[]): number {
  let max = 0;
  for (const sku of existingSkus) {
    const m = /-(\d+)$/.exec(sku); // toma el número final tras el último guion
    if (!m) continue;
    const n = Number.parseInt(m[1], 10);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}
```
  - Run: `pnpm test -- tests/unit/admin/sku.test.ts`
  - Expected: PASS (all assertions green).

- [ ] **Step 3: Typecheck.**
  - Run: `pnpm typecheck`
  - Expected: passes.
- [ ] **Step 4: Commit.**
  - Run:
    ```
    git add src/lib/admin/sku.ts tests/unit/admin/sku.test.ts
    git commit -m "$(cat <<'EOF'
feat(m3): helpers puros de SKU admin (isValidSkuPrefix, nextSkuSequence)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-4: install radix deps for `label` + `switch`

**Files**
- Modify `package.json`, `pnpm-lock.yaml`.

- [ ] **Step 1: Add the two radix packages.** These back `label.tsx` and `switch.tsx` (FOUNDATIONS-6/8). Note `@radix-ui/react-dialog` is already installed (used by `sheet.tsx`) and `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` are present too.
  - Run: `pnpm add @radix-ui/react-label @radix-ui/react-switch`
  - Expected: both packages appear under `dependencies` in `package.json` and the lockfile updates without errors.
- [ ] **Step 2: Typecheck (sanity, deps resolve).**
  - Run: `pnpm typecheck`
  - Expected: passes.
- [ ] **Step 3: Commit.**
  - Run:
    ```
    git add package.json pnpm-lock.yaml
    git commit -m "$(cat <<'EOF'
chore(m3): radix label y switch para primitivos UI del panel admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-5: `Table` primitive

**Files**
- Create `src/components/ui/table.tsx`.

- [ ] **Step 1: Create the Table primitive (UI-only; verification = typecheck).** Matches the shadcn structure and the repo's tokens (`rounded-2xl`, `text-muted-foreground`, `cn`). Write `src/components/ui/table.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-x-auto rounded-2xl border bg-card">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />,
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-semibold text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
```
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: a list page rendering `<Table><TableHeader>…</TableHeader><TableBody>…</TableBody></Table>` shows a bordered, horizontally-scrollable table on mobile.
- [ ] **Step 2: Commit.**
  - Run:
    ```
    git add src/components/ui/table.tsx
    git commit -m "$(cat <<'EOF'
feat(m3): primitivo Table de shadcn para listas del panel admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-6: `Badge` primitive

**Files**
- Create `src/components/ui/badge.tsx`.

- [ ] **Step 1: Create the Badge primitive (UI-only; verification = typecheck).** Uses the same `cva` style as `button.tsx`, with variants for order/payment/shipment status chips. Write `src/components/ui/badge.tsx`:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-emerald-100 text-emerald-800",
        warning: "border-transparent bg-amber-100 text-amber-800",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: `<Badge variant="success">Pagado</Badge>` renders a green pill; `variant="warning"` amber; `variant="destructive"` red.
- [ ] **Step 2: Commit.**
  - Run:
    ```
    git add src/components/ui/badge.tsx
    git commit -m "$(cat <<'EOF'
feat(m3): primitivo Badge para chips de estado del panel admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-7: `Label` primitive

**Files**
- Create `src/components/ui/label.tsx`.

- [ ] **Step 1: Create the Label primitive (UI-only; verification = typecheck).** Wraps `@radix-ui/react-label` (installed in FOUNDATIONS-4) with `cva`, mirroring shadcn. Write `src/components/ui/label.tsx`:

```tsx
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: `<Label htmlFor="name">Nombre</Label>` is associated with its input (clicking the label focuses the field).
- [ ] **Step 2: Commit.**
  - Run:
    ```
    git add src/components/ui/label.tsx
    git commit -m "$(cat <<'EOF'
feat(m3): primitivo Label (radix) para formularios del panel admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-8: `Textarea` primitive

**Files**
- Create `src/components/ui/textarea.tsx`.

- [ ] **Step 1: Create the Textarea primitive (UI-only; verification = typecheck).** Mirrors `input.tsx` (same border/radius/focus tokens). Write `src/components/ui/textarea.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
```
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: `<Textarea placeholder="Descripción" />` renders a multi-line field matching the Input styling.
- [ ] **Step 2: Commit.**
  - Run:
    ```
    git add src/components/ui/textarea.tsx
    git commit -m "$(cat <<'EOF'
feat(m3): primitivo Textarea para descripciones del panel admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-9: `Switch` primitive

**Files**
- Create `src/components/ui/switch.tsx`.

- [ ] **Step 1: Create the Switch primitive (UI-only; verification = typecheck).** Wraps `@radix-ui/react-switch` (installed in FOUNDATIONS-4); on-state uses primary rosa, off-state `bg-input`. Write `src/components/ui/switch.tsx`:

```tsx
"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-5 rounded-full bg-background shadow-soft ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
```
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: a controlled `<Switch checked={…} onCheckedChange={…} />` toggles between rosa (on) and grey (off); the thumb slides.
- [ ] **Step 2: Commit.**
  - Run:
    ```
    git add src/components/ui/switch.tsx
    git commit -m "$(cat <<'EOF'
feat(m3): primitivo Switch (radix) para campos activo/destacado del admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-10: `PageHeader` shell component

**Files**
- Create `src/components/admin/page-header.tsx`.

- [ ] **Step 1: Create PageHeader (UI-only; verification = typecheck).** Every admin page = a title + a one-line "para qué sirve" (contract). Server-safe (no `"use client"`); `action` slot holds the primary CTA (e.g. "Nuevo producto"). Write `src/components/admin/page-header.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Encabezado estándar de cada página del panel: título grande + una línea
 * que explica "para qué sirve esta pantalla" (que lo entienda un nene).
 * `action` es el botón principal de la pantalla (ej. "Nuevo producto").
 */
export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
```
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: `<PageHeader title="Productos" subtitle="Acá cargás y editás lo que se vende." action={<Button>Nuevo</Button>} />` shows title, subtitle and a right-aligned button (stacked on mobile).
- [ ] **Step 2: Commit.**
  - Run:
    ```
    git add src/components/admin/page-header.tsx
    git commit -m "$(cat <<'EOF'
feat(m3): PageHeader del panel (titulo + para que sirve + accion)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-11: `AdminSidebar` shell navigation

**Files**
- Create `src/components/admin/admin-sidebar.tsx`.

- [ ] **Step 1: Create AdminSidebar (UI-only; verification = typecheck).** Client component (needs `usePathname` for active state), Lucide icons, no emojis. Desktop = fixed left sidebar; mobile = fixed bottom nav (same pattern as `bottom-nav.tsx`). The `logout` slot receives the logout button rendered by AUTH's `(panel)/layout.tsx` (which wires `signOutAction`) — this component does NOT define auth logic. Write `src/components/admin/admin-sidebar.tsx`:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Layers,
  Ticket,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { href: "/admin/combos", label: "Combos", icon: Layers },
  { href: "/admin/cupones", label: "Cupones", icon: Ticket },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar({ logout }: { logout?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: sidebar fija a la izquierda */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="px-6 py-5">
          <Link href="/admin" className="font-display text-xl font-bold text-primary">
            Glamify
          </Link>
          <p className="text-xs text-muted-foreground">Panel de la dueña</p>
        </div>
        <nav aria-label="Navegación del panel" className="flex-1 px-3">
          <ul className="space-y-1">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {logout ? <div className="border-t border-border p-3">{logout}</div> : null}
      </aside>

      {/* Mobile: bottom nav fija */}
      <nav
        aria-label="Navegación del panel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card md:hidden"
      >
        <ul className="grid grid-cols-6">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px]",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
```
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: at ≥768px a left sidebar with the 6 links (active one highlighted rosa); below 768px a 6-item bottom bar. The `logout` node, when passed, sits at the sidebar bottom.
- [ ] **Step 2: Commit.**
  - Run:
    ```
    git add src/components/admin/admin-sidebar.tsx
    git commit -m "$(cat <<'EOF'
feat(m3): AdminSidebar — nav del panel (desktop lateral + mobile bottom)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task FOUNDATIONS-12: `ConfirmDialog` for dangerous actions

**Files**
- Create `src/components/admin/confirm-dialog.tsx`.

- [ ] **Step 1: Create ConfirmDialog (UI-only; verification = typecheck).** Client component reusing the existing `Sheet` primitives (Radix Dialog under the hood — there is no separate `Dialog` component in the repo, only `sheet.tsx`). Centered modal via `side` override; used for delete/cancel confirmations (e.g. cancel order, delete category). The trigger is passed as a child; `onConfirm` runs the dangerous Server Action; supports a `pending` state to disable buttons while it runs. Write `src/components/admin/confirm-dialog.tsx`:

```tsx
"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  /** El elemento que abre el diálogo (ej. un botón "Cancelar pedido"). */
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción peligrosa (ej. cancelar pedido, borrar categoría). */
  onConfirm: () => void | Promise<void>;
  /** Deshabilita los botones mientras corre la acción. */
  pending?: boolean;
}

/**
 * Diálogo de confirmación para acciones peligrosas del panel (borrar, cancelar).
 * Reusa el primitivo Sheet (Radix Dialog) — lo centramos como modal.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Sí, confirmar",
  cancelLabel = "No, volver",
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);

  async function handleConfirm() {
    await onConfirm();
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-2xl sm:bottom-1/2 sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-6 gap-2">
          <SheetClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              {cancelLabel}
            </Button>
          </SheetClose>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "Procesando…" : confirmLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: clicking the trigger opens a centered modal (bottom sheet on mobile) with the question; "No, volver" closes it; "Sí, confirmar" runs `onConfirm` and closes; buttons disable while `pending`.
- [ ] **Step 2: Commit.**
  - Run:
    ```
    git add src/components/admin/confirm-dialog.tsx
    git commit -m "$(cat <<'EOF'
feat(m3): ConfirmDialog para acciones peligrosas del panel (borrar/cancelar)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```


---


## AUTH — Autenticación de admin (requireAdmin, middleware, login, script create-admin)

Esta sección construye la puerta de entrada del panel: quién es admin, cómo entra, cómo se refresca la sesión y cómo se crea el primer usuario. `AdminSidebar` (componente) y los primitivos shadcn vienen de FOUNDATIONS — acá se referencian, no se redefinen. `AdminResult` se define acá en `src/lib/admin/result.ts` solo si FOUNDATIONS aún no lo creó; si ya existe, importarlo tal cual (mismo shape exacto).

**Files**
- Create `src/lib/admin/auth.ts` — `resolveAdminRole` (pura), `getAdminUser` (core inyectable + wrapper), `requireAdmin`.
- Create `tests/unit/admin/auth.test.ts` — unit de `resolveAdminRole`.
- Create `tests/integration/admin/auth-service.test.ts` — integration de `getAdminUserWithDeps` (supabase + db mockeados).
- Create `src/middleware.ts` — refresh de sesión Supabase SSR, matcher `/admin/:path*`.
- Create `src/app/admin/login/page.tsx` — Server Component (redirige a `/admin` si ya es admin).
- Create `src/app/admin/login/login-form.tsx` — `"use client"`, email/password.
- Create `src/app/admin/login/actions.ts` — `signInAction`, `signOutAction`.
- Create `src/app/admin/(panel)/layout.tsx` — shell guardado con `requireAdmin()` + `<AdminSidebar/>`.
- Create `scripts/create-admin.ts` — tsx service-role, idempotente.
- Modify `package.json` — script `admin:create`.
- Modify `SETUP.md` — doc del script create-admin.

---

### Task AUTH-1: `resolveAdminRole` puro + test unit

**Files**
- Create `src/lib/admin/result.ts`
- Create `src/lib/admin/auth.ts` (parcial — solo `AdminUser` + `resolveAdminRole`)
- Create `tests/unit/admin/auth.test.ts`

- [ ] **Step 1: Crear `AdminResult` compartido** (si FOUNDATIONS ya lo creó con este shape exacto, omitir este step y no duplicar). Archivo `src/lib/admin/result.ts`:

```ts
/** Resultado uniforme de las Server Actions del panel admin. */
export interface AdminResult {
  ok: boolean;
  error?: string;
  id?: string;
}
```

- [ ] **Step 2: Escribir el test unit primero** en `tests/unit/admin/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveAdminRole } from "@/lib/admin/auth";

describe("resolveAdminRole", () => {
  it("fila null → null (no hay usuario admin)", () => {
    expect(resolveAdminRole(null)).toBeNull();
  });

  it("role owner → AdminUser", () => {
    const row = { id: "u-1", email: "duenia@glamify.test", role: "owner" as const };
    expect(resolveAdminRole(row)).toEqual({ id: "u-1", email: "duenia@glamify.test", role: "owner" });
  });

  it("role admin → AdminUser", () => {
    const row = { id: "u-2", email: "staff@glamify.test", role: "admin" as const };
    expect(resolveAdminRole(row)).toEqual({ id: "u-2", email: "staff@glamify.test", role: "admin" });
  });
});
```

- [ ] **Step 3: Run** `pnpm test -- tests/unit/admin/auth.test.ts`
  **Expected: FAIL** — `Cannot find module '@/lib/admin/auth'` (el archivo todavía no existe).

- [ ] **Step 4: Crear `src/lib/admin/auth.ts`** con `AdminUser` + `resolveAdminRole` (el resto de la API se agrega en AUTH-2; este archivo se completará):

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export interface AdminUser {
  id: string;
  email: string;
  role: "owner" | "admin";
}

/** Fila de `User` (prisma) mínima para decidir si concede admin. */
export type AdminUserRow = { id: string; email: string; role: "owner" | "admin" } | null;

/** Pura: una fila `User` con role owner|admin concede admin; null o sin fila → no. */
export function resolveAdminRole(row: AdminUserRow): AdminUser | null {
  if (!row) return null;
  if (row.role !== "owner" && row.role !== "admin") return null;
  return { id: row.id, email: row.email, role: row.role };
}
```

- [ ] **Step 5: Run** `pnpm test -- tests/unit/admin/auth.test.ts`
  **Expected: PASS** — 3 passed.

- [ ] **Step 6: Commit**
```
git add src/lib/admin/result.ts src/lib/admin/auth.ts tests/unit/admin/auth.test.ts
git commit -m "$(cat <<'EOF'
feat(m3): resolveAdminRole puro + AdminResult compartido

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task AUTH-2: `getAdminUser` (core inyectable) + `requireAdmin` + integration test

**Files**
- Modify `src/lib/admin/auth.ts` (agregar `getAdminUserWithDeps`, `getAdminUser`, `requireAdmin`)
- Create `tests/integration/admin/auth-service.test.ts`

- [ ] **Step 1: Escribir el integration test primero** en `tests/integration/admin/auth-service.test.ts`. Mockea el cliente supabase (`auth.getUser`) y `db.user.findUnique` con `vi.fn()`, igual al seam de `tests/integration/checkout-service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { getAdminUserWithDeps, type GetAdminUserDeps } from "@/lib/admin/auth";

function makeDeps(over: Partial<GetAdminUserDeps> = {}): GetAdminUserDeps {
  return {
    getUser: vi.fn(async () => ({ data: { user: { id: "u-1", email: "duenia@glamify.test" } }, error: null })),
    db: {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === "u-1" ? { id: "u-1", email: "duenia@glamify.test", role: "owner" as const } : null,
        ),
      },
    },
    ...over,
  };
}

describe("getAdminUserWithDeps", () => {
  it("usuario logueado + fila User owner → AdminUser", async () => {
    const deps = makeDeps();
    const u = await getAdminUserWithDeps(deps);
    expect(u).toEqual({ id: "u-1", email: "duenia@glamify.test", role: "owner" });
  });

  it("sin usuario en supabase → null (no consulta la db)", async () => {
    const deps = makeDeps({ getUser: vi.fn(async () => ({ data: { user: null }, error: null })) });
    const u = await getAdminUserWithDeps(deps);
    expect(u).toBeNull();
    expect(deps.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("usuario logueado pero sin fila User → null", async () => {
    const deps = makeDeps({
      db: { user: { findUnique: vi.fn(async () => null) } },
    });
    const u = await getAdminUserWithDeps(deps);
    expect(u).toBeNull();
  });

  it("usa el id del usuario de supabase para buscar la fila", async () => {
    const findUnique = vi.fn(async () => ({ id: "u-9", email: "x@glamify.test", role: "admin" as const }));
    const deps = makeDeps({
      getUser: vi.fn(async () => ({ data: { user: { id: "u-9", email: "x@glamify.test" } }, error: null })),
      db: { user: { findUnique } },
    });
    await getAdminUserWithDeps(deps);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "u-9" } });
  });
});
```

- [ ] **Step 2: Run** `pnpm test -- tests/integration/admin/auth-service.test.ts`
  **Expected: FAIL** — `getAdminUserWithDeps` / `GetAdminUserDeps` no existen aún en `@/lib/admin/auth`.

- [ ] **Step 3: Completar `src/lib/admin/auth.ts`** agregando el core inyectable, el wrapper real y `requireAdmin`. Agregar este bloque al final del archivo (debajo de `resolveAdminRole`):

```ts
/** Superficie mínima de DB que necesita el lookup del admin (mockeable en tests). */
export interface AdminAuthDb {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<AdminUserRow>;
  };
}
/** Resultado mínimo de supabase `auth.getUser()` que consumimos. */
export type SupabaseGetUser = () => Promise<{
  data: { user: { id: string; email?: string | null } | null };
  error: unknown;
}>;
export interface GetAdminUserDeps {
  getUser: SupabaseGetUser;
  db: AdminAuthDb;
}

/** Core inyectable: supabase user → fila User → AdminUser|null. Sin redirect. */
export async function getAdminUserWithDeps(deps: GetAdminUserDeps): Promise<AdminUser | null> {
  const { data } = await deps.getUser();
  const authUser = data.user;
  if (!authUser) return null;
  const row = await deps.db.user.findUnique({ where: { id: authUser.id } });
  return resolveAdminRole(row);
}

/** Wrapper real: cablea supabase server client + prisma. Devuelve null si no es admin. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  return getAdminUserWithDeps({
    getUser: () => supabase.auth.getUser(),
    db: prisma as unknown as AdminAuthDb,
  });
}

/** Guard: si no es admin redirige a /admin/login; si lo es, devuelve el AdminUser. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
```

- [ ] **Step 4: Run** `pnpm test -- tests/integration/admin/auth-service.test.ts`
  **Expected: PASS** — 4 passed.

- [ ] **Step 5: Run** `pnpm typecheck`
  **Expected: passes** (sin errores).

- [ ] **Step 6: Commit**
```
git add src/lib/admin/auth.ts tests/integration/admin/auth-service.test.ts
git commit -m "$(cat <<'EOF'
feat(m3): getAdminUser inyectable + requireAdmin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task AUTH-3: middleware de refresh de sesión Supabase

**Files**
- Create `src/middleware.ts`

UI-only / infra (sin lógica pura testeable) → verificación = `pnpm typecheck`. Sigue el patrón oficial de `@supabase/ssr` para Next middleware (crear cliente con cookies de `request`/`response`, llamar `getUser()` para refrescar la cookie).

- [ ] **Step 1: Crear `src/middleware.ts`** con cliente SSR propio (no se puede reusar `@/lib/supabase/server` porque ese usa `next/headers` `cookies()`, no `NextRequest`):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options }),
          );
        },
      },
    },
  );

  // Refresca la sesión (rota la cookie de auth si hace falta). NO redirige acá:
  // el gate real es requireAdmin() en el layout y en cada server action.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Run** `pnpm typecheck`
  **Expected: passes** (sin errores).
  Verificar en app: con sesión activa, navegar entre páginas `/admin/*` mantiene la sesión (la cookie se refresca sin desloguear).

- [ ] **Step 3: Commit**
```
git add src/middleware.ts
git commit -m "$(cat <<'EOF'
feat(m3): middleware de refresh de sesión Supabase para /admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task AUTH-4: server actions de login/logout

**Files**
- Create `src/app/admin/login/actions.ts`

`AdminResult` viene de `src/lib/admin/result.ts` (AUTH-1). Sin lógica pura testeable (orquesta supabase) → verificación = `pnpm typecheck`.

- [ ] **Step 1: Crear `src/app/admin/login/actions.ts`**:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";

/** Inicia sesión con email/password. Solo deja pasar a usuarios con fila User (owner/admin). */
export async function signInAction(email: string, password: string): Promise<AdminResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) return { ok: false, error: "Completá email y contraseña." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  if (error) return { ok: false, error: "Email o contraseña incorrectos." };

  // Defensa: que la cuenta de Auth tenga además fila User con role admin/owner.
  const admin = await getAdminUser();
  if (!admin) {
    await supabase.auth.signOut();
    return { ok: false, error: "Esta cuenta no tiene permisos de administración." };
  }
  return { ok: true };
}

/** Cierra sesión y vuelve al login. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
```

- [ ] **Step 2: Run** `pnpm typecheck`
  **Expected: passes** (sin errores).

- [ ] **Step 3: Commit**
```
git add src/app/admin/login/actions.ts
git commit -m "$(cat <<'EOF'
feat(m3): server actions signIn/signOut del panel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task AUTH-5: página de login + formulario cliente

**Files**
- Create `src/app/admin/login/login-form.tsx`
- Create `src/app/admin/login/page.tsx`

UI-only → verificación = `pnpm typecheck` + chequeo en app. La página es Server Component y redirige a `/admin` si ya hay admin logueado.

- [ ] **Step 1: Crear el formulario cliente** `src/app/admin/login/login-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signInAction(email, password);
      if (!res.ok) {
        setError(res.error ?? "No pudimos iniciar sesión.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Crear la página** `src/app/admin/login/page.tsx` (Server Component; redirige si ya es admin). Es un segmento hermano del grupo `(panel)`, así que **no** pasa por el layout guardado:

```tsx
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Panel · Ingresar — Glamify Makeup" };

export default async function AdminLoginPage() {
  const admin = await getAdminUser();
  if (admin) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-soft sm:p-8">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h1 className="font-display text-2xl text-foreground">Panel de Glamify</h1>
          <p className="text-sm text-muted-foreground">
            Entrá con tu email y contraseña para administrar la tienda.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run** `pnpm typecheck`
  **Expected: passes** (sin errores).
  Verificar en app: `/admin/login` muestra el form; con credenciales inválidas aparece el mensaje de error; con válidas redirige a `/admin`. Sin sesión, entrar a `/admin/login` no redirige.

- [ ] **Step 4: Commit**
```
git add src/app/admin/login/login-form.tsx src/app/admin/login/page.tsx
git commit -m "$(cat <<'EOF'
feat(m3): página de login del panel + formulario

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task AUTH-6: layout guardado del panel `(panel)` con sidebar + logout

**Files**
- Create `src/app/admin/(panel)/layout.tsx`

`AdminSidebar` viene de FOUNDATIONS (`@/components/admin/admin-sidebar`). El grupo `(panel)` no agrega segmento de URL. UI-only → verificación = `pnpm typecheck` + app. El botón de logout llama `signOutAction` (AUTH-4).

- [ ] **Step 1: Crear `src/app/admin/(panel)/layout.tsx`**. Llama `requireAdmin()` (redirige a login si no es admin) y arma el shell. Pasa el admin y la action de logout al sidebar:

```tsx
import { requireAdmin } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { signOutAction } from "@/app/admin/login/actions";

export default async function AdminPanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-muted lg:flex-row">
      <AdminSidebar admin={admin} signOut={signOutAction} />
      <main className="flex-1 px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
```

  Nota de contrato para FOUNDATIONS: `AdminSidebar` debe aceptar props `{ admin: AdminUser; signOut: () => Promise<void> }` y renderizar el botón de logout dentro de un `<form action={signOut}>`. Si FOUNDATIONS definió otra firma, ajustar acá para coincidir exactamente (no redefinir el componente).

- [ ] **Step 2: Run** `pnpm typecheck`
  **Expected: passes** (sin errores).
  Verificar en app: sin sesión, entrar a `/admin` redirige a `/admin/login`; con sesión admin, se ve el sidebar + contenido; el botón "Salir" cierra sesión y vuelve al login.

- [ ] **Step 3: Commit**
```
git add "src/app/admin/(panel)/layout.tsx"
git commit -m "$(cat <<'EOF'
feat(m3): layout guardado del panel con sidebar y logout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task AUTH-7: script `create-admin` idempotente + npm script + doc en SETUP

**Files**
- Create `scripts/create-admin.ts`
- Modify `package.json`
- Modify `SETUP.md`

Script standalone (corre con tsx, fuera de Next) → cliente self-contained con `@supabase/supabase-js` y `@prisma/client` directos, sin alias `@` ni `server-only`, igual a `scripts/setup-storage.ts` y `scripts/simulate-mp-webhook.ts`. Verificación = `pnpm typecheck`.

- [ ] **Step 1: Crear `scripts/create-admin.ts`**. Crea el usuario en Supabase Auth (con `email_confirm: true`) y upsertea la fila `User` con role `owner`; idempotente (si el Auth user ya existe, lo reutiliza). Lee `ADMIN_EMAIL` / `ADMIN_PASSWORD` del entorno:

```ts
/**
 * Crea (idempotente) el usuario administrador de la tienda:
 *  1) usuario en Supabase Auth (email_confirm: true)
 *  2) fila `User` (prisma) con role `owner`, id = uid de Auth.
 * Standalone (corre con tsx, fuera de Next) → clientes self-contained.
 * Requiere en el entorno:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL,
 *   ADMIN_EMAIL, ADMIN_PASSWORD
 */
import { createClient, type User } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function findAuthUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<User | null> {
  // listUsers pagina; recorremos hasta encontrarlo (1–2 admins → pocas páginas).
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!url || !key || !dbUrl) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o DATABASE_URL.");
    process.exit(1);
  }
  if (!email || !password) {
    console.error("Faltan ADMIN_EMAIL o ADMIN_PASSWORD en el entorno.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });

  try {
    let authUser = await findAuthUserByEmail(supabase, email);
    if (authUser) {
      console.log(`Usuario de Auth para ${email} ya existe — se reutiliza.`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      authUser = data.user;
      console.log(`Usuario de Auth creado para ${email}.`);
    }

    await prisma.user.upsert({
      where: { id: authUser.id },
      update: { email, role: "owner" },
      create: { id: authUser.id, email, role: "owner" },
    });
    console.log(`Fila User (role owner) lista para ${email}. Listo para entrar a /admin.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Agregar el script `admin:create` a `package.json`** (en `"scripts"`, junto a `setup:storage`). Reemplazar la línea existente:

```json
    "setup:storage": "tsx scripts/setup-storage.ts",
```
por:
```json
    "setup:storage": "tsx scripts/setup-storage.ts",
    "admin:create": "tsx --env-file=.env scripts/create-admin.ts",
```

- [ ] **Step 3: Documentar en `SETUP.md`**. Agregar una sección "Crear el usuario administrador" que explique las variables y el comando. Insertar este bloque en el lugar correspondiente del archivo (cerca del setup de Supabase / Storage):

```md
## Crear el usuario administrador

El panel `/admin` se protege con Supabase Auth + una fila `User` con role `owner`.
Para crear (de forma idempotente) la cuenta de la dueña:

1. Definí en tu `.env` (no commitear):
   - `ADMIN_EMAIL` — email de acceso al panel.
   - `ADMIN_PASSWORD` — contraseña inicial (cambiable luego).
   - Ya deben estar: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
2. Corré:
   ```bash
   pnpm admin:create
   ```
   Crea el usuario en Supabase Auth (email confirmado) y la fila `User` (role `owner`).
   Es idempotente: si ya existe, reutiliza la cuenta de Auth y refresca la fila.
3. Entrá a `/admin/login` con ese email/contraseña.
```

- [ ] **Step 4: Run** `pnpm typecheck`
  **Expected: passes** (sin errores).
  Verificación funcional (manual, requiere `.env` con credenciales reales): `pnpm admin:create` imprime que crea/reutiliza el usuario; correrlo dos veces no falla (idempotente).

- [ ] **Step 5: Commit**
```
git add scripts/create-admin.ts package.json SETUP.md
git commit -m "$(cat <<'EOF'
feat(m3): script idempotente create-admin + doc en SETUP

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```


---


## CATEGORIES — CRUD de categorías (catálogo, máx. 2 niveles)

Módulo de catálogo para que la dueña cree y ordene las categorías (con sus subcategorías). Cada categoría tiene nombre, un slug único auto-generado (editable), un prefijo de SKU (1–3 letras), orden, estado y una imagen opcional. Las subcategorías solo pueden colgar de una categoría raíz (jerarquía de **dos niveles máximo**). No se puede borrar una categoría con productos o subcategorías.

Depende de FOUNDATIONS (`slugify` en `src/lib/admin/slug.ts`, `isValidSkuPrefix` en `src/lib/admin/sku.ts`, primitivos UI `table`/`badge`/`label`/`switch`/`textarea`, `AdminSidebar`, `PageHeader`, `ConfirmDialog`) y de AUTH (`requireAdmin`, `AdminResult`, layout guardado). No redefinir esos símbolos: importarlos.

### Files

**Create**
- `src/lib/admin/categories/validation.ts` — puras: `assertMaxTwoLevels`, `validateCategory`.
- `src/lib/admin/categories/service.ts` — deps+db: `createCategory`, `updateCategory`, `deleteCategory`.
- `src/app/admin/(panel)/categorias/page.tsx` — lista en árbol (Server Component).
- `src/app/admin/(panel)/categorias/nuevo/page.tsx` — alta (Server Component que carga posibles padres).
- `src/app/admin/(panel)/categorias/[id]/page.tsx` — edición (Server Component).
- `src/app/admin/(panel)/categorias/category-form.tsx` — formulario (`"use client"`).
- `src/app/admin/(panel)/categorias/actions.ts` — server actions (`createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`).

**Test**
- `tests/unit/admin/categories-validation.test.ts` — puras.
- `tests/integration/admin/categories-service.test.ts` — servicio con `deps.db` mockeado.

---

### Task CATEGORIES-1: Validación pura (`validateCategory` + `assertMaxTwoLevels`)

**Files**
- Create `tests/unit/admin/categories-validation.test.ts`
- Create `src/lib/admin/categories/validation.ts`

- [ ] **Step 1: Escribir el test que falla** — `tests/unit/admin/categories-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  validateCategory,
  assertMaxTwoLevels,
  type CategoryFormInput,
} from "@/lib/admin/categories/validation";

const base: CategoryFormInput = {
  name: "Labiales",
  slug: "",
  parentId: null,
  skuPrefix: "lab",
  order: "0",
  active: true,
  image: null,
};

describe("validateCategory", () => {
  it("acepta una categoría válida y normaliza slug, prefijo y orden", () => {
    const r = validateCategory(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe("Labiales");
    expect(r.value.slug).toBe("labiales"); // auto desde name
    expect(r.value.skuPrefix).toBe("LAB"); // uppercase
    expect(r.value.order).toBe(0);
    expect(r.value.parentId).toBeNull();
    expect(r.value.active).toBe(true);
    expect(r.value.image).toBeNull();
  });

  it("respeta un slug provisto y lo normaliza", () => {
    const r = validateCategory({ ...base, slug: "Labios Mate" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.slug).toBe("labios-mate");
  });

  it("rechaza nombre vacío", () => {
    const r = validateCategory({ ...base, name: "   " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("El nombre es obligatorio.");
  });

  it("rechaza prefijo de SKU inválido", () => {
    const r = validateCategory({ ...base, skuPrefix: "LAB1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("El prefijo de SKU debe tener 1 a 3 letras (A–Z).");
  });

  it("rechaza orden no numérico", () => {
    const r = validateCategory({ ...base, order: "abc" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("El orden debe ser un número entero.");
  });

  it("rechaza orden negativo", () => {
    const r = validateCategory({ ...base, order: "-1" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("El orden no puede ser negativo.");
  });

  it("trim de la imagen vacía → null", () => {
    const r = validateCategory({ ...base, image: "   " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.image).toBeNull();
  });

  it("conserva parentId no vacío", () => {
    const r = validateCategory({ ...base, parentId: "cat-root" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.parentId).toBe("cat-root");
  });
});

describe("assertMaxTwoLevels", () => {
  it("padre raíz (parentId null) → ok", () => {
    expect(assertMaxTwoLevels({ id: "p1", parentId: null })).toEqual({ ok: true });
  });

  it("padre que ya es hijo → rechaza", () => {
    const r = assertMaxTwoLevels({ id: "p2", parentId: "root" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Solo se permiten dos niveles: la categoría elegida ya es una subcategoría.");
  });

  it("padre inexistente → rechaza", () => {
    const r = assertMaxTwoLevels(null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("La categoría padre no existe.");
  });
});
```

- [ ] **Step 2: Run (rojo)**
  - Run: `pnpm test -- tests/unit/admin/categories-validation.test.ts`
  - Expected: FAIL — `Cannot find module '@/lib/admin/categories/validation'`.

- [ ] **Step 3: Implementar la validación pura** — `src/lib/admin/categories/validation.ts`:

```ts
import { slugify } from "@/lib/admin/slug";
import { isValidSkuPrefix } from "@/lib/admin/sku";

/** Lo que llega del formulario (todo string-ish; el form no conoce tipos de DB). */
export interface CategoryFormInput {
  name: string;
  slug: string;
  parentId: string | null;
  skuPrefix: string;
  order: string;
  active: boolean;
  image: string | null;
}

/** Datos ya validados y normalizados, listos para el servicio. */
export interface CategoryClean {
  name: string;
  slug: string;
  parentId: string | null;
  skuPrefix: string;
  order: number;
  active: boolean;
  image: string | null;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validación pura (sin DB). La unicidad del slug se chequea en el servicio. */
export function validateCategory(input: CategoryFormInput): Validated<CategoryClean> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre es obligatorio." };

  const slugSource = input.slug.trim() ? input.slug : name;
  const slug = slugify(slugSource);
  if (!slug) return { ok: false, error: "El slug no puede quedar vacío." };

  const skuPrefix = input.skuPrefix.trim().toUpperCase();
  if (!isValidSkuPrefix(skuPrefix)) {
    return { ok: false, error: "El prefijo de SKU debe tener 1 a 3 letras (A–Z)." };
  }

  const orderRaw = input.order.trim();
  const order = Number(orderRaw);
  if (orderRaw === "" || !Number.isInteger(order)) {
    return { ok: false, error: "El orden debe ser un número entero." };
  }
  if (order < 0) return { ok: false, error: "El orden no puede ser negativo." };

  const parentId = input.parentId && input.parentId.trim() ? input.parentId.trim() : null;
  const image = input.image && input.image.trim() ? input.image.trim() : null;

  return {
    ok: true,
    value: { name, slug, parentId, skuPrefix, order, active: input.active, image },
  };
}

/** Fila mínima del padre candidato (cargada por el servicio desde DB). */
export interface ParentRow {
  id: string;
  parentId: string | null;
}

/** Regla de dominio: el padre elegido debe ser una categoría raíz (máx 2 niveles). */
export function assertMaxTwoLevels(parent: ParentRow | null): Validated<true> {
  if (!parent) return { ok: false, error: "La categoría padre no existe." };
  if (parent.parentId !== null) {
    return { ok: false, error: "Solo se permiten dos niveles: la categoría elegida ya es una subcategoría." };
  }
  return { ok: true, value: true };
}
```

- [ ] **Step 4: Run (verde)**
  - Run: `pnpm test -- tests/unit/admin/categories-validation.test.ts`
  - Expected: PASS — los 11 casos pasan.

- [ ] **Step 5: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (sin errores).

- [ ] **Step 6: Commit**
  - Run:
    ```
    git add src/lib/admin/categories/validation.ts tests/unit/admin/categories-validation.test.ts
    git commit -m "$(cat <<'EOF'
test(m3): validación pura de categorías (slug, prefijo SKU, máx 2 niveles)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task CATEGORIES-2: Servicio (`createCategory` / `updateCategory` / `deleteCategory`) con deps+db

**Files**
- Create `tests/integration/admin/categories-service.test.ts`
- Create `src/lib/admin/categories/service.ts`

- [ ] **Step 1: Escribir el test de integración que falla** — `tests/integration/admin/categories-service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryServiceDeps,
} from "@/lib/admin/categories/service";
import type { CategoryClean } from "@/lib/admin/categories/validation";

const cleanRoot: CategoryClean = {
  name: "Labiales",
  slug: "labiales",
  parentId: null,
  skuPrefix: "LAB",
  order: 0,
  active: true,
  image: null,
};

function makeDeps(over: Partial<CategoryServiceDeps["db"]> = {}): {
  deps: CategoryServiceDeps;
  db: {
    category: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    product: { count: ReturnType<typeof vi.fn> };
  };
} {
  const db = {
    category: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null), // slug libre por defecto
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cat-new", ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cat-1", ...data })),
      delete: vi.fn(async () => ({ id: "cat-1" })),
      count: vi.fn(async () => 0), // sin hijos por defecto
    },
    product: { count: vi.fn(async () => 0) }, // sin productos por defecto
    ...over,
  };
  const deps: CategoryServiceDeps = { db: db as unknown as CategoryServiceDeps["db"] };
  return { deps, db };
}

describe("createCategory", () => {
  it("crea una categoría raíz cuando el slug está libre", async () => {
    const { deps, db } = makeDeps();
    const r = await createCategory(cleanRoot, deps);
    expect(r.id).toBe("cat-new");
    expect(db.category.create).toHaveBeenCalledOnce();
    const data = db.category.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ slug: "labiales", skuPrefix: "LAB", parentId: null, order: 0, active: true });
  });

  it("rechaza slug duplicado", async () => {
    const { deps } = makeDeps({
      category: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => ({ id: "other" })), // slug tomado
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(async () => 0),
      },
    });
    await expect(createCategory(cleanRoot, deps)).rejects.toThrow("Ya existe una categoría con ese slug.");
  });

  it("crea subcategoría cuando el padre es raíz", async () => {
    const child: CategoryClean = { ...cleanRoot, slug: "mate", parentId: "root-1" };
    const { deps, db } = makeDeps({
      category: {
        findUnique: vi.fn(async () => ({ id: "root-1", parentId: null })), // padre raíz
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cat-child", ...data })),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(async () => 0),
      },
    });
    const r = await createCategory(child, deps);
    expect(r.id).toBe("cat-child");
    expect(db.category.findUnique).toHaveBeenCalledWith({
      where: { id: "root-1" },
      select: { id: true, parentId: true },
    });
  });

  it("rechaza subcategoría de un padre que ya es hijo (máx 2 niveles)", async () => {
    const child: CategoryClean = { ...cleanRoot, slug: "mate", parentId: "child-1" };
    const { deps } = makeDeps({
      category: {
        findUnique: vi.fn(async () => ({ id: "child-1", parentId: "root-1" })), // padre ya es hijo
        findFirst: vi.fn(async () => null),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(async () => 0),
      },
    });
    await expect(createCategory(child, deps)).rejects.toThrow("Solo se permiten dos niveles");
  });
});

describe("updateCategory", () => {
  it("actualiza cuando el slug sigue libre (ignora la misma fila)", async () => {
    const { deps, db } = makeDeps({
      category: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null), // no hay OTRA fila con ese slug
        create: vi.fn(),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cat-1", ...data })),
        delete: vi.fn(),
        count: vi.fn(async () => 0),
      },
    });
    const r = await updateCategory("cat-1", { ...cleanRoot, slug: "labiales-edit" }, deps);
    expect(r.id).toBe("cat-1");
    // la búsqueda de slug excluye la propia fila
    expect(db.category.findFirst).toHaveBeenCalledWith({
      where: { slug: "labiales-edit", id: { not: "cat-1" } },
      select: { id: true },
    });
  });

  it("rechaza ponerse a sí misma como padre", async () => {
    const { deps } = makeDeps();
    await expect(
      updateCategory("cat-1", { ...cleanRoot, parentId: "cat-1" }, deps),
    ).rejects.toThrow("Una categoría no puede ser su propia categoría padre.");
  });

  it("rechaza slug tomado por otra categoría", async () => {
    const { deps } = makeDeps({
      category: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => ({ id: "other" })),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(async () => 0),
      },
    });
    await expect(
      updateCategory("cat-1", { ...cleanRoot, slug: "tomado" }, deps),
    ).rejects.toThrow("Ya existe una categoría con ese slug.");
  });
});

describe("deleteCategory", () => {
  it("borra cuando no tiene productos ni hijos", async () => {
    const { deps, db } = makeDeps();
    await deleteCategory("cat-1", deps);
    expect(db.category.delete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
  });

  it("bloquea el borrado si tiene productos", async () => {
    const { deps } = makeDeps({ product: { count: vi.fn(async () => 3) } });
    await expect(deleteCategory("cat-1", deps)).rejects.toThrow(
      "No se puede borrar: la categoría tiene productos.",
    );
  });

  it("bloquea el borrado si tiene subcategorías", async () => {
    const { deps } = makeDeps({
      category: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(async () => 2), // tiene hijos
      },
    });
    await expect(deleteCategory("cat-1", deps)).rejects.toThrow(
      "No se puede borrar: la categoría tiene subcategorías.",
    );
  });
});
```

- [ ] **Step 2: Run (rojo)**
  - Run: `pnpm test -- tests/integration/admin/categories-service.test.ts`
  - Expected: FAIL — `Cannot find module '@/lib/admin/categories/service'`.

- [ ] **Step 3: Implementar el servicio** — `src/lib/admin/categories/service.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { assertMaxTwoLevels, type CategoryClean } from "@/lib/admin/categories/validation";

/** Superficie mínima de Prisma que usa el servicio (para inyectar fakes en tests). */
export interface CategoryDb {
  category: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; parentId: true };
    }) => Promise<{ id: string; parentId: string | null } | null>;
    findFirst: (args: {
      where: { slug: string; id?: { not: string } };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: { data: CategoryCreateData }) => Promise<{ id: string }>;
    update: (args: { where: { id: string }; data: CategoryUpdateData }) => Promise<{ id: string }>;
    delete: (args: { where: { id: string } }) => Promise<{ id: string }>;
    count: (args: { where: { parentId: string } }) => Promise<number>;
  };
  product: {
    count: (args: { where: { categoryId: string } }) => Promise<number>;
  };
}

interface CategoryCreateData {
  name: string;
  slug: string;
  parentId: string | null;
  skuPrefix: string;
  order: number;
  active: boolean;
  image: string | null;
}
type CategoryUpdateData = CategoryCreateData;

export interface CategoryServiceDeps {
  db: CategoryDb;
}

export function defaultCategoryDeps(): CategoryServiceDeps {
  return { db: prisma as unknown as CategoryDb };
}

/** Chequea unicidad de slug; `exceptId` excluye la propia fila al editar. */
async function ensureSlugFree(db: CategoryDb, slug: string, exceptId?: string): Promise<void> {
  const where = exceptId ? { slug, id: { not: exceptId } } : { slug };
  const hit = await db.category.findFirst({ where, select: { id: true } });
  if (hit) throw new Error("Ya existe una categoría con ese slug.");
}

/** Verifica que el padre exista y sea raíz (máx 2 niveles). */
async function ensureValidParent(db: CategoryDb, parentId: string): Promise<void> {
  const parent = await db.category.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });
  const check = assertMaxTwoLevels(parent);
  if (!check.ok) throw new Error(check.error);
}

function toData(input: CategoryClean): CategoryCreateData {
  return {
    name: input.name,
    slug: input.slug,
    parentId: input.parentId,
    skuPrefix: input.skuPrefix,
    order: input.order,
    active: input.active,
    image: input.image,
  };
}

export async function createCategory(
  input: CategoryClean,
  deps: CategoryServiceDeps,
): Promise<{ id: string }> {
  await ensureSlugFree(deps.db, input.slug);
  if (input.parentId) await ensureValidParent(deps.db, input.parentId);
  const created = await deps.db.category.create({ data: toData(input) });
  return { id: created.id };
}

export async function updateCategory(
  id: string,
  input: CategoryClean,
  deps: CategoryServiceDeps,
): Promise<{ id: string }> {
  if (input.parentId === id) {
    throw new Error("Una categoría no puede ser su propia categoría padre.");
  }
  await ensureSlugFree(deps.db, input.slug, id);
  if (input.parentId) await ensureValidParent(deps.db, input.parentId);
  const updated = await deps.db.category.update({ where: { id }, data: toData(input) });
  return { id: updated.id };
}

export async function deleteCategory(id: string, deps: CategoryServiceDeps): Promise<void> {
  const products = await deps.db.product.count({ where: { categoryId: id } });
  if (products > 0) throw new Error("No se puede borrar: la categoría tiene productos.");
  const children = await deps.db.category.count({ where: { parentId: id } });
  if (children > 0) throw new Error("No se puede borrar: la categoría tiene subcategorías.");
  await deps.db.category.delete({ where: { id } });
}
```

- [ ] **Step 4: Run (verde)**
  - Run: `pnpm test -- tests/integration/admin/categories-service.test.ts`
  - Expected: PASS — los 10 casos pasan.

- [ ] **Step 5: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (sin errores).

- [ ] **Step 6: Commit**
  - Run:
    ```
    git add src/lib/admin/categories/service.ts tests/integration/admin/categories-service.test.ts
    git commit -m "$(cat <<'EOF'
feat(m3): servicio de categorías (unicidad de slug, parent depth, borrado bloqueado)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task CATEGORIES-3: Server actions (`createCategoryAction` / `updateCategoryAction` / `deleteCategoryAction`)

**Files**
- Create `src/app/admin/(panel)/categorias/actions.ts`

- [ ] **Step 1: Implementar las actions** — `src/app/admin/(panel)/categorias/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { validateCategory, type CategoryFormInput } from "@/lib/admin/categories/validation";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  defaultCategoryDeps,
} from "@/lib/admin/categories/service";

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

export async function createCategoryAction(input: CategoryFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCategory(input);
    if (!v.ok) return { ok: false, error: v.error };
    const { id } = await createCategory(v.value, defaultCategoryDeps());
    revalidatePath("/admin/categorias");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateCategoryAction(
  id: string,
  input: CategoryFormInput,
): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCategory(input);
    if (!v.ok) return { ok: false, error: v.error };
    const updated = await updateCategory(id, v.value, defaultCategoryDeps());
    revalidatePath("/admin/categorias");
    revalidatePath(`/admin/categorias/${id}`);
    return { ok: true, id: updated.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteCategoryAction(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    await deleteCategory(id, defaultCategoryDeps());
    revalidatePath("/admin/categorias");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
```

- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (sin errores). Las actions devuelven `AdminResult` y orquestan `requireAdmin` → `validateCategory` → servicio → `revalidatePath`.

- [ ] **Step 3: Commit**
  - Run:
    ```
    git add "src/app/admin/(panel)/categorias/actions.ts"
    git commit -m "$(cat <<'EOF'
feat(m3): server actions de categorías (crear, editar, borrar con requireAdmin)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task CATEGORIES-4: Formulario cliente (`category-form.tsx`)

**Files**
- Create `src/app/admin/(panel)/categorias/category-form.tsx`

> Nota: usa `Label`, `Switch` y `Textarea` de FOUNDATIONS y `slugify` para previsualizar el slug en vivo. `createCategoryAction`/`updateCategoryAction` vienen de la Task CATEGORIES-3.

- [ ] **Step 1: Implementar el formulario** — `src/app/admin/(panel)/categorias/category-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/admin/slug";
import { createCategoryAction, updateCategoryAction } from "@/app/admin/(panel)/categorias/actions";

export interface CategoryFormValues {
  id?: string;
  name: string;
  slug: string;
  parentId: string | null;
  skuPrefix: string;
  order: number;
  active: boolean;
  image: string | null;
}

export interface ParentOption {
  id: string;
  name: string;
}

interface Props {
  /** Cuando viene, el form edita; si no, crea. */
  initial?: CategoryFormValues;
  /** Categorías raíz disponibles como padre (sin incluir la propia al editar). */
  parents: ParentOption[];
}

export function CategoryForm({ initial, parents }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [parentId, setParentId] = useState<string>(initial?.parentId ?? "");
  const [skuPrefix, setSkuPrefix] = useState(initial?.skuPrefix ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [image, setImage] = useState(initial?.image ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Slug auto desde el nombre mientras la admin no lo edite a mano.
  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        name,
        slug,
        parentId: parentId || null,
        skuPrefix,
        order,
        active,
        image: image || null,
      };
      const r = initial?.id
        ? await updateCategoryAction(initial.id, payload)
        : await createCategoryAction(payload);
      if (r.ok) {
        router.push("/admin/categorias");
        router.refresh();
      } else {
        setError(r.error ?? "No se pudo guardar la categoría.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="cat-name">Nombre</Label>
        <Input
          id="cat-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Ej: Labiales"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-slug">Slug (la dirección en la web)</Label>
        <Input
          id="cat-slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="labiales"
        />
        <p className="text-xs text-muted-foreground">Se arma solo desde el nombre. Podés cambiarlo.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-parent">Categoría padre (opcional)</Label>
        <select
          id="cat-parent"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Sin padre (categoría principal)</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Elegí una principal para crear una subcategoría. Solo hay dos niveles.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cat-prefix">Prefijo de SKU</Label>
          <Input
            id="cat-prefix"
            value={skuPrefix}
            onChange={(e) => setSkuPrefix(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="LAB"
          />
          <p className="text-xs text-muted-foreground">1 a 3 letras. Arma los códigos de producto.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-order">Orden</Label>
          <Input
            id="cat-order"
            value={order}
            onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">Más chico = aparece antes.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-image">Imagen (ruta, opcional)</Label>
        <Input
          id="cat-image"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="categorias/labiales.webp"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <div>
          <Label htmlFor="cat-active">Activa</Label>
          <p className="text-xs text-muted-foreground">Si está apagada, no se muestra en la tienda.</p>
        </div>
        <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {initial?.id ? "Guardar cambios" : "Crear categoría"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/categorias")} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (sin errores).

- [ ] **Step 3: Verificar en la app** — con un admin logueado, ir a `/admin/categorias/nuevo`: el slug se autocompleta al tipear el nombre y se deja de autocompletar si lo editás a mano; el prefijo fuerza mayúsculas a 3 caracteres; el switch "Activa" alterna. (Se prueba de punta a punta en la Task CATEGORIES-5 al cablear las páginas.)

- [ ] **Step 4: Commit**
  - Run:
    ```
    git add "src/app/admin/(panel)/categorias/category-form.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): formulario de categoría (slug en vivo, padre, prefijo SKU, activa)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task CATEGORIES-5: Páginas Server Component (lista en árbol + alta + edición)

**Files**
- Create `src/app/admin/(panel)/categorias/page.tsx`
- Create `src/app/admin/(panel)/categorias/nuevo/page.tsx`
- Create `src/app/admin/(panel)/categorias/[id]/page.tsx`

> Nota: `PageHeader` y `ConfirmDialog` vienen de FOUNDATIONS; `Table`/`Badge` también. La lista muestra el árbol padre → hijas con conteo de productos y subcategorías, y un empty state guiado.

- [ ] **Step 1: Implementar la lista en árbol** — `src/app/admin/(panel)/categorias/page.tsx`:

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  skuPrefix: string;
  order: number;
  active: boolean;
  parentId: string | null;
  productCount: number;
  childCount: number;
}

async function loadCategories(): Promise<CategoryNode[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      skuPrefix: true,
      order: true,
      active: true,
      parentId: true,
      _count: { select: { products: true, children: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    skuPrefix: r.skuPrefix,
    order: r.order,
    active: r.active,
    parentId: r.parentId,
    productCount: r._count.products,
    childCount: r._count.children,
  }));
}

export default async function CategoriasPage() {
  const all = await loadCategories();
  const roots = all.filter((c) => c.parentId === null);
  const childrenOf = (id: string) => all.filter((c) => c.parentId === id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías"
        subtitle="Organizá tus productos en categorías y subcategorías (hasta dos niveles)."
      >
        <Button asChild>
          <Link href="/admin/categorias/nuevo">
            <Plus className="size-4" /> Nueva categoría
          </Link>
        </Button>
      </PageHeader>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-display text-lg">Todavía no hay categorías</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Creá tu primera categoría (por ejemplo, &ldquo;Labiales&rdquo;) para empezar a cargar productos.
          </p>
          <Button asChild className="mt-4">
            <Link href="/admin/categorias/nuevo">
              <Plus className="size-4" /> Crear la primera
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Prefijo</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roots.flatMap((root) => {
              const kids = childrenOf(root.id);
              const rootRow = (
                <TableRow key={root.id}>
                  <TableCell className="font-medium">{root.name}</TableCell>
                  <TableCell className="font-mono text-xs">{root.skuPrefix}</TableCell>
                  <TableCell className="text-right tabular-nums">{root.productCount}</TableCell>
                  <TableCell>
                    {root.active ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/categorias/${root.id}`}>Editar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
              const childRows = kids.map((child) => (
                <TableRow key={child.id}>
                  <TableCell className="pl-8 text-muted-foreground">↳ {child.name}</TableCell>
                  <TableCell className="font-mono text-xs">{child.skuPrefix}</TableCell>
                  <TableCell className="text-right tabular-nums">{child.productCount}</TableCell>
                  <TableCell>
                    {child.active ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/categorias/${child.id}`}>Editar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ));
              return [rootRow, ...childRows];
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implementar la página de alta** — `src/app/admin/(panel)/categorias/nuevo/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryForm, type ParentOption } from "@/app/admin/(panel)/categorias/category-form";

export const dynamic = "force-dynamic";

async function loadRootParents(): Promise<ParentOption[]> {
  const rows = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return rows;
}

export default async function NuevaCategoriaPage() {
  const parents = await loadRootParents();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva categoría"
        subtitle="Cargá una categoría nueva. Si elegís una categoría padre, será una subcategoría."
      />
      <CategoryForm parents={parents} />
    </div>
  );
}
```

- [ ] **Step 3: Implementar la página de edición** — `src/app/admin/(panel)/categorias/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import {
  CategoryForm,
  type ParentOption,
  type CategoryFormValues,
} from "@/app/admin/(panel)/categorias/category-form";

export const dynamic = "force-dynamic";

export default async function EditarCategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      skuPrefix: true,
      order: true,
      active: true,
      image: true,
    },
  });
  if (!category) notFound();

  // Posibles padres: solo categorías raíz, excluyendo la propia (no puede ser su padre).
  const parentRows = await prisma.category.findMany({
    where: { parentId: null, id: { not: id } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const parents: ParentOption[] = parentRows;

  const initial: CategoryFormValues = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    skuPrefix: category.skuPrefix,
    order: category.order,
    active: category.active,
    image: category.image,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editar: ${category.name}`}
        subtitle="Cambiá los datos de la categoría. El slug afecta la dirección en la web."
      />
      <CategoryForm initial={initial} parents={parents} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (sin errores).

- [ ] **Step 5: Verificar en la app** — logueada como admin: `/admin/categorias` muestra el árbol (raíces con sus hijas indentadas con `↳`, conteo de productos y badge de estado) o el empty state guiado si no hay ninguna; `/admin/categorias/nuevo` crea y redirige a la lista; `/admin/categorias/[id]` edita una existente; intentar borrar una categoría con productos muestra el error del servicio.

- [ ] **Step 6: Commit**
  - Run:
    ```
    git add "src/app/admin/(panel)/categorias/page.tsx" "src/app/admin/(panel)/categorias/nuevo/page.tsx" "src/app/admin/(panel)/categorias/[id]/page.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): páginas de categorías (lista en árbol, alta y edición)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```


---


## PRODUCTS — Productos + Variantes (CRUD, auto-Único, SKU autogenerado, subida de imágenes)

Módulo de catálogo para que la dueña dé de alta y edite productos con sus variantes (tonos/colores), stock y precios. Si no carga ninguna variante, se crea una sola llamada "Único" automáticamente. El SKU se genera solo según el prefijo de la categoría. Las imágenes se suben al bucket `product-images` de Supabase. Borrado lógico (soft-delete) con `deletedAt`.

Depende de FOUNDATIONS (`@/lib/admin/result` → `AdminResult`, `@/lib/admin/slug` → `slugify`, `@/lib/admin/sku` → `nextSkuSequence`, primitivos shadcn `Table`/`Badge`/`Label`/`Textarea`/`Switch`, componentes `PageHeader`/`ConfirmDialog`) y AUTH (`@/lib/admin/auth` → `requireAdmin`). No redefinir esos archivos; importarlos.

### Files

- **Create** `src/lib/admin/products/validation.ts` — puras `validateProduct`, `validateVariant` + tipos.
- **Create** `src/lib/admin/products/service.ts` — `createProduct`, `updateProduct`, `softDeleteProduct` con `deps.db` inyectable; auto-Único, SKU gen + retry-on-collision.
- **Create** `src/lib/admin/products/images.ts` — `uploadProductImage` (Supabase Storage service-role, bucket `product-images`).
- **Create** `src/app/admin/(panel)/productos/page.tsx` — lista (Server Component) con búsqueda + filtros categoría/activo/bajo-stock.
- **Create** `src/app/admin/(panel)/productos/nuevo/page.tsx` — alta (Server Component que renderiza el form).
- **Create** `src/app/admin/(panel)/productos/[id]/page.tsx` — edición (Server Component).
- **Create** `src/app/admin/(panel)/productos/actions.ts` — server actions (`createProductAction`, `updateProductAction`, `deleteProductAction`, `uploadProductImageAction`).
- **Create** `src/app/admin/(panel)/productos/product-form.tsx` — `"use client"` form principal.
- **Create** `src/app/admin/(panel)/productos/variant-fields.tsx` — `"use client"` filas de variantes editables.
- **Create** `src/app/admin/(panel)/productos/image-uploader.tsx` — `"use client"` subida de imágenes.
- **Test** `tests/unit/admin/products-validation.test.ts` — `validateProduct`/`validateVariant`.
- **Test** `tests/integration/admin/products-service.test.ts` — auto-Único, SKU gen, retry-on-collision.

---

### Task PRODUCTS-1: Validadores puros de producto y variante (TDD)

**Files**
- Create `src/lib/admin/products/validation.ts`
- Test `tests/unit/admin/products-validation.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/admin/products-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  validateProduct,
  validateVariant,
  type ProductFormInput,
  type VariantFormInput,
} from "@/lib/admin/products/validation";

const baseVariant = (over: Partial<VariantFormInput> = {}): VariantFormInput => ({
  name: "Rojo Pasión",
  swatchHex: "#FF0000",
  sku: "",
  stock: 5,
  lowStockThreshold: 3,
  priceOverride: null,
  weightGrOverride: null,
  image: null,
  active: true,
  order: 0,
  ...over,
});

const baseProduct = (over: Partial<ProductFormInput> = {}): ProductFormInput => ({
  name: "Labial Mate",
  slug: "",
  description: "Larga duración",
  categoryId: "11111111-1111-1111-1111-111111111111",
  basePrice: 3200,
  compareAtPrice: null,
  cost: 1000,
  weightGr: 25,
  images: [],
  isFeatured: false,
  heroRank: null,
  tags: ["mate", "labial"],
  seoTitle: null,
  seoDescription: null,
  active: true,
  variants: [baseVariant()],
  ...over,
});

describe("validateVariant", () => {
  it("acepta una variante válida y limpia el nombre", () => {
    const r = validateVariant(baseVariant({ name: "  Rosa  " }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Rosa");
      expect(r.value.lowStockThreshold).toBe(3);
    }
  });

  it("rechaza nombre vacío", () => {
    const r = validateVariant(baseVariant({ name: "   " }));
    expect(r.ok).toBe(false);
  });

  it("rechaza stock negativo o no entero", () => {
    expect(validateVariant(baseVariant({ stock: -1 })).ok).toBe(false);
    expect(validateVariant(baseVariant({ stock: 1.5 })).ok).toBe(false);
  });

  it("rechaza lowStockThreshold negativo", () => {
    expect(validateVariant(baseVariant({ lowStockThreshold: -2 })).ok).toBe(false);
  });

  it("rechaza priceOverride <= 0 cuando viene", () => {
    expect(validateVariant(baseVariant({ priceOverride: 0 })).ok).toBe(false);
    expect(validateVariant(baseVariant({ priceOverride: -10 })).ok).toBe(false);
  });

  it("acepta priceOverride null y weightGrOverride null", () => {
    const r = validateVariant(baseVariant({ priceOverride: null, weightGrOverride: null }));
    expect(r.ok).toBe(true);
  });

  it("rechaza swatchHex con formato inválido", () => {
    expect(validateVariant(baseVariant({ swatchHex: "rojo" })).ok).toBe(false);
    expect(validateVariant(baseVariant({ swatchHex: "#FFF" })).ok).toBe(false);
  });

  it("acepta swatchHex null", () => {
    expect(validateVariant(baseVariant({ swatchHex: null })).ok).toBe(true);
  });

  it("conserva un SKU manual no vacío", () => {
    const r = validateVariant(baseVariant({ sku: "lab-0007" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sku).toBe("LAB-0007");
  });

  it("rechaza SKU manual con formato inválido", () => {
    expect(validateVariant(baseVariant({ sku: "LAB-1" })).ok).toBe(false);
    expect(validateVariant(baseVariant({ sku: "12-3456" })).ok).toBe(false);
  });
});

describe("validateProduct", () => {
  it("acepta un producto válido, genera slug y normaliza tags", () => {
    const r = validateProduct(baseProduct({ name: "Labial Máte", slug: "", tags: ["  Mate ", "mate", ""] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.slug).toBe("labial-mate");
      expect(r.value.tags).toEqual(["mate"]);
      expect(r.value.variants).toHaveLength(1);
    }
  });

  it("respeta un slug manual normalizándolo", () => {
    const r = validateProduct(baseProduct({ slug: "  Mi Slug  " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.slug).toBe("mi-slug");
  });

  it("rechaza nombre vacío", () => {
    expect(validateProduct(baseProduct({ name: "  " })).ok).toBe(false);
  });

  it("rechaza categoryId vacío", () => {
    expect(validateProduct(baseProduct({ categoryId: "" })).ok).toBe(false);
  });

  it("rechaza basePrice <= 0", () => {
    expect(validateProduct(baseProduct({ basePrice: 0 })).ok).toBe(false);
  });

  it("rechaza cost negativo", () => {
    expect(validateProduct(baseProduct({ cost: -1 })).ok).toBe(false);
  });

  it("rechaza weightGr <= 0 o no entero", () => {
    expect(validateProduct(baseProduct({ weightGr: 0 })).ok).toBe(false);
    expect(validateProduct(baseProduct({ weightGr: 12.5 })).ok).toBe(false);
  });

  it("rechaza compareAtPrice menor o igual a basePrice", () => {
    expect(validateProduct(baseProduct({ basePrice: 3000, compareAtPrice: 3000 })).ok).toBe(false);
    expect(validateProduct(baseProduct({ basePrice: 3000, compareAtPrice: 2500 })).ok).toBe(false);
  });

  it("acepta compareAtPrice mayor a basePrice", () => {
    const r = validateProduct(baseProduct({ basePrice: 3000, compareAtPrice: 4000 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.compareAtPrice).toBe(4000);
  });

  it("acepta compareAtPrice null", () => {
    expect(validateProduct(baseProduct({ compareAtPrice: null })).ok).toBe(true);
  });

  it("propaga el error si una variante es inválida", () => {
    const r = validateProduct(baseProduct({ variants: [baseVariant({ name: "" })] }));
    expect(r.ok).toBe(false);
  });

  it("rechaza variantes con nombres duplicados (case-insensitive)", () => {
    const r = validateProduct(baseProduct({ variants: [baseVariant({ name: "Rojo" }), baseVariant({ name: "rojo" })] }));
    expect(r.ok).toBe(false);
  });

  it("permite cero variantes (el servicio creará la Única)", () => {
    const r = validateProduct(baseProduct({ variants: [] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.variants).toHaveLength(0);
  });

  it("rechaza SKU manuales duplicados entre variantes", () => {
    const r = validateProduct(
      baseProduct({ variants: [baseVariant({ sku: "LAB-0001" }), baseVariant({ name: "Otra", sku: "LAB-0001" })] }),
    );
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run (FAIL)**
  - Run: `pnpm test -- tests/unit/admin/products-validation.test.ts`
  - Expected: FAIL — `Cannot find module '@/lib/admin/products/validation'`.

- [ ] **Step 3: Implementar el validador**

Crear `src/lib/admin/products/validation.ts`:

```ts
import { slugify } from "@/lib/admin/slug";
import { isValidSku } from "@/lib/sku";

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export interface VariantFormInput {
  name: string;
  swatchHex: string | null;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  priceOverride: number | null;
  weightGrOverride: number | null;
  image: string | null;
  active: boolean;
  order: number;
}

export interface ProductFormInput {
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  basePrice: number;
  compareAtPrice: number | null;
  cost: number;
  weightGr: number;
  images: string[];
  isFeatured: boolean;
  heroRank: number | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  active: boolean;
  variants: VariantFormInput[];
}

export interface VariantClean {
  name: string;
  swatchHex: string | null;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  priceOverride: number | null;
  weightGrOverride: number | null;
  image: string | null;
  active: boolean;
  order: number;
}

export interface ProductClean {
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  basePrice: number;
  compareAtPrice: number | null;
  cost: number;
  weightGr: number;
  images: string[];
  isFeatured: boolean;
  heroRank: number | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  active: boolean;
  variants: VariantClean[];
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}
function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

export function validateVariant(input: VariantFormInput): Validated<VariantClean> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre de la variante no puede estar vacío." };

  let swatchHex: string | null = null;
  if (input.swatchHex != null && input.swatchHex.trim() !== "") {
    const hex = input.swatchHex.trim();
    if (!HEX_RE.test(hex)) return { ok: false, error: "El color del tono debe ser un hex tipo #FF2E93." };
    swatchHex = hex.toUpperCase();
  }

  if (!isNonNegativeInt(input.stock)) return { ok: false, error: "El stock debe ser un número entero mayor o igual a 0." };
  if (!isNonNegativeInt(input.lowStockThreshold)) return { ok: false, error: "El aviso de bajo stock debe ser un entero mayor o igual a 0." };

  let priceOverride: number | null = null;
  if (input.priceOverride != null) {
    if (!(input.priceOverride > 0)) return { ok: false, error: "El precio especial de la variante debe ser mayor a 0." };
    priceOverride = input.priceOverride;
  }

  let weightGrOverride: number | null = null;
  if (input.weightGrOverride != null) {
    if (!isPositiveInt(input.weightGrOverride)) return { ok: false, error: "El peso especial debe ser un entero mayor a 0." };
    weightGrOverride = input.weightGrOverride;
  }

  let sku = "";
  if (input.sku.trim() !== "") {
    sku = input.sku.trim().toUpperCase();
    if (!isValidSku(sku)) return { ok: false, error: `El SKU "${input.sku}" no tiene un formato válido (ej. LAB-0007).` };
  }

  const image = input.image != null && input.image.trim() !== "" ? input.image.trim() : null;

  return {
    ok: true,
    value: {
      name,
      swatchHex,
      sku,
      stock: input.stock,
      lowStockThreshold: input.lowStockThreshold,
      priceOverride,
      weightGrOverride,
      image,
      active: input.active,
      order: Number.isInteger(input.order) ? input.order : 0,
    },
  };
}

export function validateProduct(input: ProductFormInput): Validated<ProductClean> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre del producto no puede estar vacío." };

  const slug = slugify(input.slug.trim() !== "" ? input.slug : name);
  if (!slug) return { ok: false, error: "No se pudo generar un enlace (slug) válido a partir del nombre." };

  if (!input.categoryId.trim()) return { ok: false, error: "Elegí una categoría para el producto." };

  if (!(input.basePrice > 0)) return { ok: false, error: "El precio debe ser mayor a 0." };
  if (input.cost < 0) return { ok: false, error: "El costo no puede ser negativo." };
  if (!isPositiveInt(input.weightGr)) return { ok: false, error: "El peso (en gramos) debe ser un entero mayor a 0." };

  let compareAtPrice: number | null = null;
  if (input.compareAtPrice != null) {
    if (!(input.compareAtPrice > input.basePrice)) {
      return { ok: false, error: "El precio anterior (oferta) tiene que ser mayor al precio actual." };
    }
    compareAtPrice = input.compareAtPrice;
  }

  let heroRank: number | null = null;
  if (input.heroRank != null) {
    if (!isPositiveInt(input.heroRank)) return { ok: false, error: "El orden en portada debe ser un entero mayor a 0." };
    heroRank = input.heroRank;
  }

  const tags = Array.from(
    new Set(input.tags.map((t) => t.trim().toLowerCase()).filter((t) => t !== "")),
  );
  const images = input.images.map((i) => i.trim()).filter((i) => i !== "");

  const cleanVariants: VariantClean[] = [];
  for (const v of input.variants) {
    const r = validateVariant(v);
    if (!r.ok) return { ok: false, error: r.error };
    cleanVariants.push(r.value);
  }

  const lowerNames = cleanVariants.map((v) => v.name.toLowerCase());
  if (new Set(lowerNames).size !== lowerNames.length) {
    return { ok: false, error: "Hay variantes con el mismo nombre. Cada tono debe tener un nombre distinto." };
  }

  const manualSkus = cleanVariants.map((v) => v.sku).filter((s) => s !== "");
  if (new Set(manualSkus).size !== manualSkus.length) {
    return { ok: false, error: "Hay variantes con el mismo SKU. Cada SKU debe ser único." };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      description: input.description != null && input.description.trim() !== "" ? input.description.trim() : null,
      categoryId: input.categoryId.trim(),
      basePrice: input.basePrice,
      compareAtPrice,
      cost: input.cost,
      weightGr: input.weightGr,
      images,
      isFeatured: input.isFeatured,
      heroRank,
      tags,
      seoTitle: input.seoTitle != null && input.seoTitle.trim() !== "" ? input.seoTitle.trim() : null,
      seoDescription: input.seoDescription != null && input.seoDescription.trim() !== "" ? input.seoDescription.trim() : null,
      active: input.active,
      variants: cleanVariants,
    },
  };
}
```

- [ ] **Step 4: Run (PASS)**
  - Run: `pnpm test -- tests/unit/admin/products-validation.test.ts`
  - Expected: PASS (all tests green).

- [ ] **Step 5: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (no errors).

- [ ] **Step 6: Commit**
  - Run:
    ```
    git add src/lib/admin/products/validation.ts tests/unit/admin/products-validation.test.ts
    git commit -m "$(cat <<'EOF'
test(m3): validadores puros de producto y variante

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task PRODUCTS-2: Servicio createProduct/updateProduct/softDelete con auto-Único + SKU gen + retry (TDD)

**Files**
- Create `src/lib/admin/products/service.ts`
- Test `tests/integration/admin/products-service.test.ts`

- [ ] **Step 1: Escribir el test de integración que falla**

Crear `tests/integration/admin/products-service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  createProduct,
  updateProduct,
  softDeleteProduct,
  type CreateProductDeps,
  type ProductDb,
} from "@/lib/admin/products/service";
import type { ProductClean, VariantClean } from "@/lib/admin/products/validation";

const variant = (over: Partial<VariantClean> = {}): VariantClean => ({
  name: "Rojo Pasión",
  swatchHex: "#FF0000",
  sku: "",
  stock: 5,
  lowStockThreshold: 3,
  priceOverride: null,
  weightGrOverride: null,
  image: null,
  active: true,
  order: 0,
  ...over,
});

const clean = (over: Partial<ProductClean> = {}): ProductClean => ({
  name: "Labial Mate",
  slug: "labial-mate",
  description: "Larga duración",
  categoryId: "cat-1",
  basePrice: 3200,
  compareAtPrice: null,
  cost: 1000,
  weightGr: 25,
  images: [],
  isFeatured: false,
  heroRank: null,
  tags: ["mate"],
  seoTitle: null,
  seoDescription: null,
  active: true,
  variants: [variant()],
  ...over,
});

interface FakeOpts {
  prefix?: string;
  existingSkus?: string[];
  slugTaken?: boolean;
  failCreateOnce?: boolean; // simula P2002 en la primera tx.product.create
}

function makeDeps(opts: FakeOpts = {}): { deps: CreateProductDeps; tx: any; db: any } {
  let createCalls = 0;
  const tx = {
    product: {
      create: vi.fn(async ({ data }: any) => {
        createCalls += 1;
        if (opts.failCreateOnce && createCalls === 1) {
          const err = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
          throw err;
        }
        return { id: "prod-1", ...data };
      }),
      update: vi.fn(async ({ data }: any) => ({ id: "prod-1", ...data })),
    },
    productVariant: {
      findMany: vi.fn(async () => (opts.existingSkus ?? []).map((sku) => ({ sku }))),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  };
  const db = {
    category: {
      findUnique: vi.fn(async () => (opts.prefix ? { skuPrefix: opts.prefix } : null)),
    },
    product: {
      findFirst: vi.fn(async () => (opts.slugTaken ? { id: "other" } : null)),
    },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  };
  const deps: CreateProductDeps = { db: db as unknown as ProductDb };
  return { deps, tx, db };
}

describe("createProduct", () => {
  it("crea el producto con sus variantes y SKU autogenerado por prefijo de categoría", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0001", "LAB-0002"] });
    const res = await createProduct(clean({ variants: [variant({ name: "Rojo" }), variant({ name: "Rosa" })] }), deps);
    expect(res.id).toBe("prod-1");
    const data = tx.product.create.mock.calls[0][0].data;
    const skus = data.variants.create.map((v: any) => v.sku);
    expect(skus).toEqual(["LAB-0003", "LAB-0004"]);
    expect(data.slug).toBe("labial-mate");
    expect(data.variants.create).toHaveLength(2);
  });

  it("cuando no se pasan variantes, crea una sola llamada 'Único'", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: [] });
    await createProduct(clean({ variants: [] }), deps);
    const data = tx.product.create.mock.calls[0][0].data;
    expect(data.variants.create).toHaveLength(1);
    expect(data.variants.create[0].name).toBe("Único");
    expect(data.variants.create[0].sku).toBe("LAB-0001");
    expect(data.variants.create[0].stock).toBe(0);
  });

  it("respeta los SKU manuales y autogenera solo los vacíos", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0005"] });
    await createProduct(
      clean({ variants: [variant({ name: "A", sku: "LAB-0099" }), variant({ name: "B", sku: "" })] }),
      deps,
    );
    const skus = tx.product.create.mock.calls[0][0].data.variants.create.map((v: any) => v.sku);
    expect(skus).toEqual(["LAB-0099", "LAB-0006"]);
  });

  it("reintenta una vez ante colisión de SKU (P2002)", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0001"], failCreateOnce: true });
    const res = await createProduct(clean({ variants: [variant()] }), deps);
    expect(res.id).toBe("prod-1");
    expect(tx.product.create).toHaveBeenCalledTimes(2);
    // segundo intento recalcula desde la secuencia ya avanzada
    const secondSkus = tx.product.create.mock.calls[1][0].data.variants.create.map((v: any) => v.sku);
    expect(secondSkus[0]).toBe("LAB-0002");
  });

  it("falla si el slug ya está tomado", async () => {
    const { deps } = makeDeps({ prefix: "LAB", slugTaken: true });
    await expect(createProduct(clean(), deps)).rejects.toThrow(/enlace|slug/i);
  });

  it("falla si la categoría no existe", async () => {
    const { deps } = makeDeps({ prefix: undefined });
    await expect(createProduct(clean(), deps)).rejects.toThrow(/categor/i);
  });
});

describe("updateProduct", () => {
  it("actualiza el producto y reemplaza variantes con SKU consistente", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0001"] });
    const res = await updateProduct("prod-1", clean({ variants: [variant({ name: "Nueva", sku: "" })] }), deps);
    expect(res.id).toBe("prod-1");
    expect(tx.productVariant.deleteMany).toHaveBeenCalled();
    expect(tx.product.update).toHaveBeenCalled();
  });

  it("falla si el slug pertenece a otro producto", async () => {
    const { deps } = makeDeps({ prefix: "LAB", slugTaken: true });
    await expect(updateProduct("prod-1", clean(), deps)).rejects.toThrow(/enlace|slug/i);
  });
});

describe("softDeleteProduct", () => {
  it("marca deletedAt y desactiva, sin borrar la fila", async () => {
    const { deps } = makeDeps();
    const fixedNow = new Date("2026-06-05T00:00:00Z");
    await softDeleteProduct("prod-1", { ...deps, now: fixedNow });
    const call = (deps.db.product.update as any).mock.calls[0][0];
    expect(call.where).toEqual({ id: "prod-1" });
    expect(call.data.deletedAt).toEqual(fixedNow);
    expect(call.data.active).toBe(false);
  });
});
```

- [ ] **Step 2: Run (FAIL)**
  - Run: `pnpm test -- tests/integration/admin/products-service.test.ts`
  - Expected: FAIL — `Cannot find module '@/lib/admin/products/service'`.

- [ ] **Step 3: Implementar el servicio**

Crear `src/lib/admin/products/service.ts`:

```ts
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { generateSku } from "@/lib/sku";
import { nextSkuSequence } from "@/lib/admin/sku";
import type { ProductClean, VariantClean } from "@/lib/admin/products/validation";

/** Superficie mínima de Prisma usada por el servicio (para inyectar fakes en tests). */
export interface ProductDb {
  category: { findUnique: (args: { where: { id: string }; select: { skuPrefix: true } }) => Promise<{ skuPrefix: string } | null> };
  product: {
    findFirst: (args: { where: { slug: string; id?: { not: string }; deletedAt?: null } }) => Promise<{ id: string } | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}
export interface CreateProductDeps {
  db: ProductDb;
  now?: Date;
}

export function defaultProductDeps(): CreateProductDeps {
  return { db: prisma as unknown as ProductDb };
}

/** Detecta el error de violación de unicidad de Prisma (P2002) sin usar `any`. */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: unknown }).code === "P2002";
}

interface VariantCreateData {
  name: string;
  swatchHex: string | null;
  sku: string;
  priceOverride: number | null;
  stock: number;
  lowStockThreshold: number;
  weightGrOverride: number | null;
  image: string | null;
  active: boolean;
  order: number;
}

/**
 * Asigna SKU a cada variante: respeta los manuales, autogenera los vacíos
 * desde `seq` (que arranca en la siguiente secuencia libre del prefijo).
 */
function assignSkus(variants: VariantClean[], prefix: string, startSeq: number): VariantCreateData[] {
  let seq = startSeq;
  return variants.map((v) => {
    const sku = v.sku !== "" ? v.sku : generateSku(prefix, seq++);
    return {
      name: v.name,
      swatchHex: v.swatchHex,
      sku,
      priceOverride: v.priceOverride,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      weightGrOverride: v.weightGrOverride,
      image: v.image,
      active: v.active,
      order: v.order,
    };
  });
}

/** Normaliza la lista de variantes: si está vacía, crea la "Única" por defecto. */
function ensureVariants(variants: VariantClean[]): VariantClean[] {
  if (variants.length > 0) return variants;
  return [
    {
      name: "Único",
      swatchHex: null,
      sku: "",
      stock: 0,
      lowStockThreshold: 3,
      priceOverride: null,
      weightGrOverride: null,
      image: null,
      active: true,
      order: 0,
    },
  ];
}

async function resolvePrefix(db: ProductDb, categoryId: string): Promise<string> {
  const cat = await db.category.findUnique({ where: { id: categoryId }, select: { skuPrefix: true } });
  if (!cat) throw new Error("La categoría elegida no existe.");
  return cat.skuPrefix;
}

function productData(input: ProductClean, variantRows: VariantCreateData[]): Record<string, unknown> {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    categoryId: input.categoryId,
    basePrice: input.basePrice,
    compareAtPrice: input.compareAtPrice,
    cost: input.cost,
    weightGr: input.weightGr,
    images: input.images,
    isFeatured: input.isFeatured,
    heroRank: input.heroRank,
    tags: input.tags,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    active: input.active,
    variants: { create: variantRows },
  };
}

export async function createProduct(input: ProductClean, deps: CreateProductDeps): Promise<{ id: string }> {
  const existing = await deps.db.product.findFirst({ where: { slug: input.slug, deletedAt: null } });
  if (existing) throw new Error(`Ya existe un producto con el enlace "${input.slug}". Cambiá el slug.`);

  const prefix = await resolvePrefix(deps.db, input.categoryId);
  const variants = ensureVariants(input.variants);

  const attempt = async (): Promise<{ id: string }> => {
    return deps.db.$transaction(async (tx) => {
      const txx = tx as unknown as {
        productVariant: { findMany: (args: { where: { sku: { startsWith: string } }; select: { sku: true } }) => Promise<Array<{ sku: string }>> };
        product: { create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }> };
      };
      const rows = await txx.productVariant.findMany({ where: { sku: { startsWith: `${prefix}-` } }, select: { sku: true } });
      const startSeq = nextSkuSequence(rows.map((r) => r.sku));
      const variantRows = assignSkus(variants, prefix, startSeq);
      const created = await txx.product.create({ data: productData(input, variantRows) });
      return { id: created.id };
    });
  };

  try {
    return await attempt();
  } catch (e) {
    if (isUniqueViolation(e)) return attempt();
    throw e;
  }
}

export async function updateProduct(id: string, input: ProductClean, deps: CreateProductDeps): Promise<{ id: string }> {
  const clash = await deps.db.product.findFirst({ where: { slug: input.slug, id: { not: id }, deletedAt: null } });
  if (clash) throw new Error(`Ya existe otro producto con el enlace "${input.slug}". Cambiá el slug.`);

  const prefix = await resolvePrefix(deps.db, input.categoryId);
  const variants = ensureVariants(input.variants);

  const attempt = async (): Promise<{ id: string }> => {
    return deps.db.$transaction(async (tx) => {
      const txx = tx as unknown as {
        productVariant: {
          findMany: (args: { where: { sku: { startsWith: string } }; select: { sku: true } }) => Promise<Array<{ sku: string }>>;
          deleteMany: (args: { where: { productId: string } }) => Promise<{ count: number }>;
        };
        product: { update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{ id: string }> };
      };
      await txx.productVariant.deleteMany({ where: { productId: id } });
      const rows = await txx.productVariant.findMany({ where: { sku: { startsWith: `${prefix}-` } }, select: { sku: true } });
      const startSeq = nextSkuSequence(rows.map((r) => r.sku));
      const variantRows = assignSkus(variants, prefix, startSeq);
      const updated = await txx.product.update({ where: { id }, data: productData(input, variantRows) });
      return { id: updated.id };
    });
  };

  try {
    return await attempt();
  } catch (e) {
    if (isUniqueViolation(e)) return attempt();
    throw e;
  }
}

export async function softDeleteProduct(id: string, deps: CreateProductDeps): Promise<{ id: string }> {
  const now = deps.now ?? new Date();
  await deps.db.product.update({ where: { id }, data: { deletedAt: now, active: false } });
  return { id };
}
```

- [ ] **Step 4: Run (PASS)**
  - Run: `pnpm test -- tests/integration/admin/products-service.test.ts`
  - Expected: PASS (all tests green).

- [ ] **Step 5: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (no errors).

- [ ] **Step 6: Commit**
  - Run:
    ```
    git add src/lib/admin/products/service.ts tests/integration/admin/products-service.test.ts
    git commit -m "$(cat <<'EOF'
feat(m3): servicio de productos con auto-Único, SKU autogenerado y retry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task PRODUCTS-3: Subida de imágenes a Supabase Storage

**Files**
- Create `src/lib/admin/products/images.ts`

- [ ] **Step 1: Implementar el helper de subida**

Crear `src/lib/admin/products/images.ts`:

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PRODUCT_IMAGES_BUCKET = "product-images";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB, igual al límite del bucket

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface UploadResult {
  path: string;
}

/**
 * Sube un archivo al bucket `product-images` con service-role y devuelve el path guardado.
 * Valida tipo y tamaño. El path es estable (uuid) para guardarlo en `product.images[]`
 * o `variant.image`.
 */
export async function uploadProductImage(file: File): Promise<UploadResult> {
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error("Formato no permitido. Subí PNG, JPG, WEBP o AVIF.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("La imagen supera el límite de 5 MB.");
  }

  const ext = EXT_BY_MIME[file.type];
  const path = `products/${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);

  return { path };
}

/** URL pública del path guardado (el bucket es público). */
export function productImagePublicUrl(path: string): string {
  const supabase = createAdminClient();
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}
```

- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (no errors). Lógica de I/O pura sin test unitario (se ejerce vía la action y el e2e).

- [ ] **Step 3: Commit**
  - Run:
    ```
    git add src/lib/admin/products/images.ts
    git commit -m "$(cat <<'EOF'
feat(m3): subida de imágenes de producto a Supabase Storage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task PRODUCTS-4: Server actions de productos

**Files**
- Create `src/app/admin/(panel)/productos/actions.ts`

- [ ] **Step 1: Implementar las actions**

Crear `src/app/admin/(panel)/productos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { validateProduct, type ProductFormInput } from "@/lib/admin/products/validation";
import { createProduct, updateProduct, softDeleteProduct, defaultProductDeps } from "@/lib/admin/products/service";
import { uploadProductImage } from "@/lib/admin/products/images";

export async function createProductAction(input: ProductFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateProduct(input);
    if (!v.ok) return { ok: false, error: v.error };
    const { id } = await createProduct(v.value, defaultProductDeps());
    revalidatePath("/admin/productos");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el producto." };
  }
}

export async function updateProductAction(id: string, input: ProductFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateProduct(input);
    if (!v.ok) return { ok: false, error: v.error };
    const res = await updateProduct(id, v.value, defaultProductDeps());
    revalidatePath("/admin/productos");
    revalidatePath(`/admin/productos/${id}`);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el producto." };
  }
}

export async function deleteProductAction(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    await softDeleteProduct(id, defaultProductDeps());
    revalidatePath("/admin/productos");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo eliminar el producto." };
  }
}

export interface UploadImageResult extends AdminResult {
  path?: string;
}

export async function uploadProductImageAction(formData: FormData): Promise<UploadImageResult> {
  try {
    await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí una imagen para subir." };
    const { path } = await uploadProductImage(file);
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo subir la imagen." };
  }
}

export async function createAndRedirectProductAction(input: ProductFormInput): Promise<AdminResult> {
  const res = await createProductAction(input);
  if (res.ok) redirect("/admin/productos");
  return res;
}
```

- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (no errors).

- [ ] **Step 3: Commit**
  - Run:
    ```
    git add "src/app/admin/(panel)/productos/actions.ts"
    git commit -m "$(cat <<'EOF'
feat(m3): server actions de productos (crear, editar, soft-delete, subir imagen)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task PRODUCTS-5: Image uploader y variant fields (client components)

**Files**
- Create `src/app/admin/(panel)/productos/image-uploader.tsx`
- Create `src/app/admin/(panel)/productos/variant-fields.tsx`

- [ ] **Step 1: Implementar `image-uploader.tsx`**

Crear `src/app/admin/(panel)/productos/image-uploader.tsx`:

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { uploadProductImageAction } from "@/app/admin/(panel)/productos/actions";

interface Props {
  value: string[];
  onChange: (paths: string[]) => void;
  publicBase: string; // base pública del bucket, ej. https://xxx.supabase.co/storage/v1/object/public/product-images/
  max?: number;
  className?: string;
}

export function ImageUploader({ value, onChange, publicBase, max = 6, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = max - value.length;
    const selected = Array.from(files).slice(0, Math.max(0, remaining));
    startUpload(async () => {
      const next: string[] = [];
      for (const file of selected) {
        const fd = new FormData();
        fd.set("file", file);
        const r = await uploadProductImageAction(fd);
        if (r.ok && r.path) next.push(r.path);
        else setError(r.error ?? "No se pudo subir una imagen.");
      }
      if (next.length > 0) onChange([...value, ...next]);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const remove = (path: string) => onChange(value.filter((p) => p !== path));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-3">
        {value.map((path) => (
          <div key={path} className="relative size-24 overflow-hidden rounded-xl border border-border">
            <Image src={`${publicBase}${path}`} alt="Imagen del producto" fill sizes="96px" className="object-cover" />
            <button
              type="button"
              onClick={() => remove(path)}
              aria-label="Quitar imagen"
              className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-soft"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            aria-label="Agregar imagen"
            className="grid size-24 place-items-center rounded-xl border border-dashed border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        Hasta {max} imágenes. PNG, JPG, WEBP o AVIF, máximo 5 MB cada una.
      </p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {value.length >= max && (
        <Button type="button" variant="ghost" size="sm" disabled className="px-0">
          Llegaste al máximo de imágenes
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implementar `variant-fields.tsx`**

Crear `src/app/admin/(panel)/productos/variant-fields.tsx`:

```tsx
"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { VariantFormInput } from "@/lib/admin/products/validation";

export function emptyVariant(order: number): VariantFormInput {
  return {
    name: "",
    swatchHex: null,
    sku: "",
    stock: 0,
    lowStockThreshold: 3,
    priceOverride: null,
    weightGrOverride: null,
    image: null,
    active: true,
    order,
  };
}

interface Props {
  variants: VariantFormInput[];
  onChange: (variants: VariantFormInput[]) => void;
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function VariantFields({ variants, onChange }: Props) {
  const update = (i: number, patch: Partial<VariantFormInput>) => {
    onChange(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };
  const add = () => onChange([...variants, emptyVariant(variants.length)]);
  const remove = (i: number) => onChange(variants.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg">Variantes</h3>
          <p className="text-sm text-muted-foreground">
            Cada tono o color es una variante. Si no agregás ninguna, creamos una llamada &quot;Único&quot;.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" aria-hidden /> Agregar variante
        </Button>
      </div>

      {variants.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sin variantes: se creará una sola llamada &quot;Único&quot; con stock 0.
        </p>
      )}

      <div className="space-y-4">
        {variants.map((v, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Variante {i + 1}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Quitar variante">
                <Trash2 className="size-4" aria-hidden /> Quitar
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`v-name-${i}`}>Nombre del tono</Label>
                <Input id={`v-name-${i}`} value={v.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Rojo Pasión / Único" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-sku-${i}`}>SKU (se autogenera si lo dejás vacío)</Label>
                <Input id={`v-sku-${i}`} value={v.sku} onChange={(e) => update(i, { sku: e.target.value.toUpperCase() })} placeholder="LAB-0007" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-stock-${i}`}>Stock</Label>
                <Input id={`v-stock-${i}`} type="number" inputMode="numeric" min={0} value={v.stock} onChange={(e) => update(i, { stock: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-low-${i}`}>Aviso de bajo stock</Label>
                <Input id={`v-low-${i}`} type="number" inputMode="numeric" min={0} value={v.lowStockThreshold} onChange={(e) => update(i, { lowStockThreshold: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-price-${i}`}>Precio especial (opcional)</Label>
                <Input id={`v-price-${i}`} type="number" inputMode="decimal" min={0} step="0.01" value={v.priceOverride ?? ""} onChange={(e) => update(i, { priceOverride: numOrNull(e.target.value) })} placeholder="Usa el precio base si lo dejás vacío" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-weight-${i}`}>Peso especial en gramos (opcional)</Label>
                <Input id={`v-weight-${i}`} type="number" inputMode="numeric" min={0} value={v.weightGrOverride ?? ""} onChange={(e) => update(i, { weightGrOverride: numOrNull(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`v-hex-${i}`}>Color del tono (hex, opcional)</Label>
                <Input id={`v-hex-${i}`} value={v.swatchHex ?? ""} onChange={(e) => update(i, { swatchHex: e.target.value.trim() === "" ? null : e.target.value })} placeholder="#FF2E93" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch id={`v-active-${i}`} checked={v.active} onCheckedChange={(checked) => update(i, { active: checked })} />
                <Label htmlFor={`v-active-${i}`}>Variante activa</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (no errors). Verificar en app: las filas de variantes se agregan/quitan y la zona de imágenes sube y muestra miniaturas.

- [ ] **Step 4: Commit**
  - Run:
    ```
    git add "src/app/admin/(panel)/productos/image-uploader.tsx" "src/app/admin/(panel)/productos/variant-fields.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): componentes cliente de variantes e imágenes de producto

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task PRODUCTS-6: Formulario principal de producto (client component)

**Files**
- Create `src/app/admin/(panel)/productos/product-form.tsx`

- [ ] **Step 1: Implementar `product-form.tsx`**

Crear `src/app/admin/(panel)/productos/product-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import type { ProductFormInput, VariantFormInput } from "@/lib/admin/products/validation";
import { VariantFields } from "@/app/admin/(panel)/productos/variant-fields";
import { ImageUploader } from "@/app/admin/(panel)/productos/image-uploader";
import { createProductAction, updateProductAction } from "@/app/admin/(panel)/productos/actions";

export interface CategoryOption { id: string; name: string }

interface Props {
  categories: CategoryOption[];
  publicBase: string;
  productId?: string;
  initial?: ProductFormInput;
}

function blank(): ProductFormInput {
  return {
    name: "",
    slug: "",
    description: null,
    categoryId: "",
    basePrice: 0,
    compareAtPrice: null,
    cost: 0,
    weightGr: 0,
    images: [],
    isFeatured: false,
    heroRank: null,
    tags: [],
    seoTitle: null,
    seoDescription: null,
    active: true,
    variants: [],
  };
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function ProductForm({ categories, publicBase, productId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormInput>(initial ?? blank());
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(", "));
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProductFormInput>(key: K, value: ProductFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setVariants = (variants: VariantFormInput[]) => setForm((f) => ({ ...f, variants }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: ProductFormInput = {
      ...form,
      tags: tagsText.split(",").map((t) => t.trim()).filter((t) => t !== ""),
    };
    startSubmit(async () => {
      const r = productId
        ? await updateProductAction(productId, payload)
        : await createProductAction(payload);
      if (r.ok) router.push("/admin/productos");
      else setError(r.error ?? "No se pudo guardar el producto.");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg">Datos básicos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Labial Mate Larga Duración" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Enlace (slug)</Label>
            <Input id="slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="Se genera solo si lo dejás vacío" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category">Categoría</Label>
            <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
              <SelectTrigger id="category"><SelectValue placeholder="Elegí una categoría" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="active" checked={form.active} onCheckedChange={(checked) => set("active", checked)} />
            <Label htmlFor="active">Producto activo (visible en la tienda)</Label>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Descripción</Label>
          <Textarea id="description" value={form.description ?? ""} onChange={(e) => set("description", e.target.value === "" ? null : e.target.value)} placeholder="Contale a la clienta de qué se trata" rows={4} />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg">Precio y peso</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="basePrice">Precio (ARS)</Label>
            <Input id="basePrice" type="number" inputMode="decimal" min={0} step="0.01" value={form.basePrice} onChange={(e) => set("basePrice", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="compareAtPrice">Precio anterior / oferta (opcional, mayor al actual)</Label>
            <Input id="compareAtPrice" type="number" inputMode="decimal" min={0} step="0.01" value={form.compareAtPrice ?? ""} onChange={(e) => set("compareAtPrice", numOrNull(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cost">Costo (ARS)</Label>
            <Input id="cost" type="number" inputMode="decimal" min={0} step="0.01" value={form.cost} onChange={(e) => set("cost", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weightGr">Peso en gramos</Label>
            <Input id="weightGr" type="number" inputMode="numeric" min={0} value={form.weightGr} onChange={(e) => set("weightGr", Number(e.target.value))} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg">Imágenes</h2>
        <ImageUploader value={form.images} onChange={(paths) => set("images", paths)} publicBase={publicBase} />
      </section>

      <section className="space-y-4 rounded-2xl border border-border p-5">
        <VariantFields variants={form.variants} onChange={setVariants} />
      </section>

      <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="font-display text-lg">Destacado y SEO</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Switch id="isFeatured" checked={form.isFeatured} onCheckedChange={(checked) => set("isFeatured", checked)} />
            <Label htmlFor="isFeatured">Destacar en portada</Label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="heroRank">Orden en portada (opcional)</Label>
            <Input id="heroRank" type="number" inputMode="numeric" min={1} value={form.heroRank ?? ""} onChange={(e) => set("heroRank", numOrNull(e.target.value))} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
            <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="mate, larga duración, vegano" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seoTitle">Título SEO (opcional)</Label>
            <Input id="seoTitle" value={form.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value === "" ? null : e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seoDescription">Descripción SEO (opcional)</Label>
            <Input id="seoDescription" value={form.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value === "" ? null : e.target.value)} />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {productId ? "Guardar cambios" : "Crear producto"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.push("/admin/productos")} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (no errors). Verificar en app: el form crea/edita y redirige a la lista.

- [ ] **Step 3: Commit**
  - Run:
    ```
    git add "src/app/admin/(panel)/productos/product-form.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): formulario de alta/edición de producto

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task PRODUCTS-7: Páginas de alta y edición (Server Components)

**Files**
- Create `src/app/admin/(panel)/productos/nuevo/page.tsx`
- Create `src/app/admin/(panel)/productos/[id]/page.tsx`

- [ ] **Step 1: Implementar `nuevo/page.tsx`**

Crear `src/app/admin/(panel)/productos/nuevo/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm, type CategoryOption } from "@/app/admin/(panel)/productos/product-form";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/admin/products/images";

function publicBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
}

export default async function NuevoProductoPage() {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const options: CategoryOption[] = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo producto" subtitle="Cargá un producto con sus variantes, stock y fotos." />
      <ProductForm categories={options} publicBase={publicBase()} />
    </div>
  );
}
```

- [ ] **Step 2: Implementar `[id]/page.tsx`**

Crear `src/app/admin/(panel)/productos/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm, type CategoryOption } from "@/app/admin/(panel)/productos/product-form";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/admin/products/images";
import type { ProductFormInput } from "@/lib/admin/products/validation";

function publicBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
}

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { variants: { orderBy: { order: "asc" } } },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  const options: CategoryOption[] = categories.map((c) => ({ id: c.id, name: c.name }));

  const initial: ProductFormInput = {
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId,
    basePrice: toNumber(product.basePrice),
    compareAtPrice: product.compareAtPrice != null ? toNumber(product.compareAtPrice) : null,
    cost: toNumber(product.cost),
    weightGr: product.weightGr,
    images: product.images,
    isFeatured: product.isFeatured,
    heroRank: product.heroRank,
    tags: product.tags,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    active: product.active,
    variants: product.variants.map((v) => ({
      name: v.name,
      swatchHex: v.swatchHex,
      sku: v.sku,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      priceOverride: v.priceOverride != null ? toNumber(v.priceOverride) : null,
      weightGrOverride: v.weightGrOverride,
      image: v.image,
      active: v.active,
      order: v.order,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Editar: ${product.name}`} subtitle="Cambiá datos, precios, stock o variantes." />
      <ProductForm categories={options} publicBase={publicBase()} productId={product.id} initial={initial} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (no errors). Verificar en app: `/admin/productos/nuevo` y `/admin/productos/<id>` cargan el form (vacío y precargado).

- [ ] **Step 4: Commit**
  - Run:
    ```
    git add "src/app/admin/(panel)/productos/nuevo/page.tsx" "src/app/admin/(panel)/productos/[id]/page.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): páginas de alta y edición de producto

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task PRODUCTS-8: Lista de productos con búsqueda y filtros (Server Component)

**Files**
- Create `src/app/admin/(panel)/productos/page.tsx`

- [ ] **Step 1: Implementar `page.tsx`**

Crear `src/app/admin/(panel)/productos/page.tsx`:

```tsx
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";
import { toNumber } from "@/lib/catalog/pricing";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface SearchParams {
  q?: string;
  categoria?: string;
  activo?: string;
  bajostock?: string;
}

export default async function ProductosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const categoriaId = (sp.categoria ?? "").trim();
  const activo = sp.activo ?? "";
  const lowStock = sp.bajostock === "1";

  const where: {
    deletedAt: null;
    active?: boolean;
    categoryId?: string;
    OR?: Array<{ name: { contains: string; mode: "insensitive" } } | { variants: { some: { sku: { contains: string; mode: "insensitive" } } } }>;
  } = { deletedAt: null };
  if (activo === "1") where.active = true;
  if (activo === "0") where.active = false;
  if (categoriaId) where.categoryId = categoriaId;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: { category: { select: { name: true } }, variants: { select: { stock: true, lowStockThreshold: true, sku: true } } },
      take: 200,
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const rows = products
    .map((p) => {
      const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0);
      const isLow = p.variants.some((v) => v.stock <= v.lowStockThreshold);
      const firstSku = p.variants[0]?.sku ?? "—";
      return { p, totalStock, isLow, firstSku };
    })
    .filter((r) => (lowStock ? r.isLow : true));

  return (
    <div className="space-y-6">
      <PageHeader title="Productos" subtitle="Acá ves, creás y editás todo lo que vendés.">
        <Button asChild>
          <Link href="/admin/productos/nuevo">
            <Plus className="size-4" aria-hidden /> Nuevo producto
          </Link>
        </Button>
      </PageHeader>

      <form className="flex flex-wrap items-end gap-3" action="/admin/productos" method="get">
        <div className="relative grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o SKU"
            aria-label="Buscar producto"
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-base md:text-sm"
          />
        </div>
        <select name="categoria" defaultValue={categoriaId} aria-label="Categoría" className="h-11 rounded-xl border border-border bg-background px-3 text-sm">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="activo" defaultValue={activo} aria-label="Estado" className="h-11 rounded-xl border border-border bg-background px-3 text-sm">
          <option value="">Activos e inactivos</option>
          <option value="1">Solo activos</option>
          <option value="0">Solo inactivos</option>
        </select>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm">
          <input type="checkbox" name="bajostock" value="1" defaultChecked={lowStock} /> Bajo stock
        </label>
        <Button type="submit" variant="outline">Filtrar</Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-display text-lg">Todavía no hay productos para mostrar</p>
          <p className="mt-1 text-sm text-muted-foreground">Creá tu primer producto para empezar a vender.</p>
          <Button asChild className="mt-4">
            <Link href="/admin/productos/nuevo">
              <Plus className="size-4" aria-hidden /> Nuevo producto
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ p, totalStock, isLow, firstSku }) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/admin/productos/${p.id}`} className="font-semibold text-primary hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.category.name}</TableCell>
                <TableCell className="tabular-nums">{firstSku}</TableCell>
                <TableCell className="text-right tabular-nums">{formatARS(toNumber(p.basePrice))}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {totalStock}{isLow && <Badge variant="destructive" className="ml-2">Bajo</Badge>}
                </TableCell>
                <TableCell>
                  {p.active ? <Badge variant="secondary">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (no errors). Verificar en app: `/admin/productos` lista con búsqueda, filtros y empty state guiado. (`Table`/`Badge` provienen de FOUNDATIONS; `Badge` variants `secondary`/`outline`/`destructive` deben existir allí.)

- [ ] **Step 3: Commit**
  - Run:
    ```
    git add "src/app/admin/(panel)/productos/page.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): lista de productos con búsqueda y filtros (categoría, estado, bajo stock)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```


---


## COMBOS — Combos CRUD (panel admin)

Módulo para que la dueña arme combos: un pack de varias variantes a un precio fijo. Lógica pura de validación (`validateCombo`) con test unit, servicio transaccional con `deps.db` mockeable (create/update reemplazan items en una tx, unicidad de slug; delete) con test integration, y páginas del panel (lista, alta, edición, form cliente, server actions).

Depende de FOUNDATIONS (`slugify` en `@/lib/admin/slug`, `AdminResult` en `@/lib/admin/result`, primitivos `Table`/`Badge`/`Switch`/`Label`/`Textarea`, `PageHeader`, `ConfirmDialog`) y de AUTH (`requireAdmin` en `@/lib/admin/auth`). No los redefinas; importalos.

**Files**
- Create: `src/lib/admin/combos/validation.ts`
- Create: `src/lib/admin/combos/service.ts`
- Create: `src/app/admin/(panel)/combos/page.tsx`
- Create: `src/app/admin/(panel)/combos/nuevo/page.tsx`
- Create: `src/app/admin/(panel)/combos/[id]/page.tsx`
- Create: `src/app/admin/(panel)/combos/combo-form.tsx`
- Create: `src/app/admin/(panel)/combos/actions.ts`
- Test: `tests/unit/admin/combos-validation.test.ts`
- Test: `tests/integration/admin/combos-service.test.ts`

---

### Task COMBOS-1: Validación pura `validateCombo`

**Files**
- Create: `src/lib/admin/combos/validation.ts`
- Test: `tests/unit/admin/combos-validation.test.ts`

- [ ] **Step 1: Escribir el test que falla** — crear `tests/unit/admin/combos-validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateCombo, type ComboFormInput } from "@/lib/admin/combos/validation";

const base: ComboFormInput = {
  name: "  Combo Glow  ",
  slug: "",
  description: "  dos labiales  ",
  comboPrice: 4999.5,
  images: ["combos/glow.webp", ""],
  active: true,
  validFrom: null,
  validTo: null,
  items: [
    { variantId: "v1", qty: 2 },
    { variantId: "v2", qty: 1 },
  ],
};

describe("validateCombo", () => {
  it("normaliza name/description, deriva slug del name y redondea el precio", () => {
    const r = validateCombo(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe("Combo Glow");
    expect(r.value.slug).toBe("combo-glow");
    expect(r.value.description).toBe("dos labiales");
    expect(r.value.comboPrice).toBe(4999.5);
    expect(r.value.images).toEqual(["combos/glow.webp"]); // descarta vacíos
    expect(r.value.items).toEqual([
      { variantId: "v1", qty: 2 },
      { variantId: "v2", qty: 1 },
    ]);
  });

  it("respeta el slug provisto (normalizado) en vez de derivarlo", () => {
    const r = validateCombo({ ...base, slug: "  Combo VERANO  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.slug).toBe("combo-verano");
  });

  it("description vacía → null", () => {
    const r = validateCombo({ ...base, description: "   " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.description).toBeNull();
  });

  it("rechaza name vacío", () => {
    const r = validateCombo({ ...base, name: "   " });
    expect(r).toEqual({ ok: false, error: "Poné un nombre para el combo." });
  });

  it("rechaza precio <= 0", () => {
    expect(validateCombo({ ...base, comboPrice: 0 })).toEqual({ ok: false, error: "El precio del combo tiene que ser mayor a 0." });
    expect(validateCombo({ ...base, comboPrice: -10 })).toEqual({ ok: false, error: "El precio del combo tiene que ser mayor a 0." });
  });

  it("rechaza precio no numérico", () => {
    expect(validateCombo({ ...base, comboPrice: Number.NaN })).toEqual({ ok: false, error: "El precio del combo tiene que ser mayor a 0." });
  });

  it("rechaza combo sin items", () => {
    expect(validateCombo({ ...base, items: [] })).toEqual({ ok: false, error: "El combo tiene que tener al menos un producto." });
  });

  it("rechaza qty < 1 en algún item", () => {
    expect(validateCombo({ ...base, items: [{ variantId: "v1", qty: 0 }] })).toEqual({ ok: false, error: "Cada producto del combo tiene que llevar cantidad 1 o más." });
  });

  it("rechaza qty no entera", () => {
    expect(validateCombo({ ...base, items: [{ variantId: "v1", qty: 1.5 }] })).toEqual({ ok: false, error: "Cada producto del combo tiene que llevar cantidad 1 o más." });
  });

  it("rechaza item sin variantId", () => {
    expect(validateCombo({ ...base, items: [{ variantId: "  ", qty: 1 }] })).toEqual({ ok: false, error: "Elegí un producto para cada renglón del combo." });
  });

  it("rechaza variantes duplicadas", () => {
    expect(
      validateCombo({ ...base, items: [{ variantId: "v1", qty: 1 }, { variantId: "v1", qty: 2 }] }),
    ).toEqual({ ok: false, error: "No repitas el mismo producto en el combo; subí la cantidad." });
  });

  it("rechaza validTo anterior a validFrom", () => {
    const r = validateCombo({
      ...base,
      validFrom: new Date("2026-07-10T00:00:00Z"),
      validTo: new Date("2026-07-01T00:00:00Z"),
    });
    expect(r).toEqual({ ok: false, error: "La fecha de fin no puede ser anterior a la de inicio." });
  });

  it("acepta una sola fecha (from o to) sin error", () => {
    expect(validateCombo({ ...base, validFrom: new Date("2026-07-01T00:00:00Z"), validTo: null }).ok).toBe(true);
    expect(validateCombo({ ...base, validFrom: null, validTo: new Date("2026-07-01T00:00:00Z") }).ok).toBe(true);
  });
});
```
- [ ] **Step 2: Correr el test (rojo)**
  - Run: `pnpm test -- tests/unit/admin/combos-validation.test.ts`
  - Expected: FAIL — `Cannot find module '@/lib/admin/combos/validation'` (el archivo todavía no existe).
- [ ] **Step 3: Implementar `validateCombo`** — crear `src/lib/admin/combos/validation.ts` con contenido completo:
```ts
import { round2 } from "@/lib/money";
import { slugify } from "@/lib/admin/slug";

export interface ComboItemInput {
  variantId: string;
  qty: number;
}
export interface ComboFormInput {
  name: string;
  slug: string;
  description: string;
  comboPrice: number;
  images: string[];
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  items: ComboItemInput[];
}
export interface ComboClean {
  name: string;
  slug: string;
  description: string | null;
  comboPrice: number;
  images: string[];
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  items: ComboItemInput[];
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateCombo(input: ComboFormInput): Validated<ComboClean> {
  const name = input.name.trim();
  if (name.length === 0) return { ok: false, error: "Poné un nombre para el combo." };

  const slugSource = input.slug.trim().length > 0 ? input.slug : name;
  const slug = slugify(slugSource);
  if (slug.length === 0) return { ok: false, error: "El combo necesita un slug válido (usá letras o números)." };

  const description = input.description.trim().length > 0 ? input.description.trim() : null;

  if (!Number.isFinite(input.comboPrice) || input.comboPrice <= 0) {
    return { ok: false, error: "El precio del combo tiene que ser mayor a 0." };
  }
  const comboPrice = round2(input.comboPrice);

  const images = input.images.map((i) => i.trim()).filter((i) => i.length > 0);

  if (input.items.length === 0) {
    return { ok: false, error: "El combo tiene que tener al menos un producto." };
  }
  const seen = new Set<string>();
  const items: ComboItemInput[] = [];
  for (const raw of input.items) {
    const variantId = raw.variantId.trim();
    if (variantId.length === 0) return { ok: false, error: "Elegí un producto para cada renglón del combo." };
    if (!Number.isInteger(raw.qty) || raw.qty < 1) {
      return { ok: false, error: "Cada producto del combo tiene que llevar cantidad 1 o más." };
    }
    if (seen.has(variantId)) {
      return { ok: false, error: "No repitas el mismo producto en el combo; subí la cantidad." };
    }
    seen.add(variantId);
    items.push({ variantId, qty: raw.qty });
  }

  if (input.validFrom && input.validTo && input.validTo < input.validFrom) {
    return { ok: false, error: "La fecha de fin no puede ser anterior a la de inicio." };
  }

  return {
    ok: true,
    value: { name, slug, description, comboPrice, images, active: input.active, validFrom: input.validFrom, validTo: input.validTo, items },
  };
}
```
- [ ] **Step 4: Correr el test (verde)**
  - Run: `pnpm test -- tests/unit/admin/combos-validation.test.ts`
  - Expected: PASS — todos los casos en verde.
- [ ] **Step 5: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (sin errores).
- [ ] **Step 6: Commit**
  - Run:
    ```bash
    git add src/lib/admin/combos/validation.ts tests/unit/admin/combos-validation.test.ts
    git commit -m "$(cat <<'EOF'
test(m3): validación pura de combos (validateCombo)

Reglas: nombre obligatorio, slug auto/normalizado, precio > 0,
≥1 item, qty entera ≥1, sin variantes duplicadas, validFrom ≤ validTo.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task COMBOS-2: Servicio `createCombo` / `updateCombo` / `deleteCombo`

**Files**
- Create: `src/lib/admin/combos/service.ts`
- Test: `tests/integration/admin/combos-service.test.ts`

- [ ] **Step 1: Escribir el test que falla** — crear `tests/integration/admin/combos-service.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import {
  createCombo,
  updateCombo,
  deleteCombo,
  type ComboDb,
  type CreateComboDeps,
} from "@/lib/admin/combos/service";
import type { ComboClean } from "@/lib/admin/combos/validation";

const clean = (over: Partial<ComboClean> = {}): ComboClean => ({
  name: "Combo Glow",
  slug: "combo-glow",
  description: "dos labiales",
  comboPrice: 4999.5,
  images: ["combos/glow.webp"],
  active: true,
  validFrom: null,
  validTo: null,
  items: [
    { variantId: "v1", qty: 2 },
    { variantId: "v2", qty: 1 },
  ],
  ...over,
});

function makeDeps(over: { existingSlug?: { id: string } | null } = {}): { deps: CreateComboDeps; tx: any; db: any } {
  const tx = {
    combo: {
      create: vi.fn(async ({ data }: any) => ({ id: "cmb-1", ...data })),
      update: vi.fn(async () => ({ id: "cmb-9" })),
    },
    comboItem: {
      deleteMany: vi.fn(async () => ({ count: 2 })),
      createMany: vi.fn(async () => ({ count: 2 })),
    },
  };
  const db: ComboDb = {
    combo: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.slug !== undefined ? (over.existingSlug ?? null) : null,
      ),
      delete: vi.fn(async () => ({ id: "cmb-9" })),
    },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  } as any;
  return { deps: { db }, tx, db };
}

describe("createCombo", () => {
  it("crea el combo con sus items en una tx", async () => {
    const { deps, tx } = makeDeps();
    const r = await createCombo(clean(), deps);
    expect(r.id).toBe("cmb-1");
    const data = tx.combo.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      slug: "combo-glow",
      name: "Combo Glow",
      comboPrice: 4999.5,
      active: true,
    });
    expect(data.items.create).toEqual([
      { variantId: "v1", qty: 2 },
      { variantId: "v2", qty: 1 },
    ]);
  });

  it("rechaza slug duplicado antes de crear", async () => {
    const { deps, tx } = makeDeps({ existingSlug: { id: "otro" } });
    await expect(createCombo(clean(), deps)).rejects.toThrow("Ya existe un combo con ese slug.");
    expect(tx.combo.create).not.toHaveBeenCalled();
  });
});

describe("updateCombo", () => {
  it("reemplaza los items (deleteMany + createMany) y actualiza campos", async () => {
    const { deps, tx } = makeDeps();
    const r = await updateCombo("cmb-9", clean({ comboPrice: 5200 }), deps);
    expect(r.id).toBe("cmb-9");
    expect(tx.comboItem.deleteMany).toHaveBeenCalledWith({ where: { comboId: "cmb-9" } });
    expect(tx.comboItem.createMany).toHaveBeenCalledWith({
      data: [
        { comboId: "cmb-9", variantId: "v1", qty: 2 },
        { comboId: "cmb-9", variantId: "v2", qty: 1 },
      ],
    });
    const data = tx.combo.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ comboPrice: 5200, slug: "combo-glow" });
    expect(tx.combo.update.mock.calls[0][0].where).toEqual({ id: "cmb-9" });
  });

  it("rechaza si el slug ya pertenece a otro combo", async () => {
    const { deps } = makeDeps({ existingSlug: { id: "otro" } });
    await expect(updateCombo("cmb-9", clean(), deps)).rejects.toThrow("Ya existe un combo con ese slug.");
  });

  it("permite el mismo slug si pertenece al combo que se edita", async () => {
    const { deps, tx } = makeDeps({ existingSlug: { id: "cmb-9" } });
    const r = await updateCombo("cmb-9", clean(), deps);
    expect(r.id).toBe("cmb-9");
    expect(tx.combo.update).toHaveBeenCalled();
  });
});

describe("deleteCombo", () => {
  it("borra el combo por id (los items caen por cascade)", async () => {
    const { deps, db } = makeDeps();
    await deleteCombo("cmb-9", deps);
    expect(db.combo.delete).toHaveBeenCalledWith({ where: { id: "cmb-9" } });
  });
});
```
- [ ] **Step 2: Correr el test (rojo)**
  - Run: `pnpm test -- tests/integration/admin/combos-service.test.ts`
  - Expected: FAIL — `Cannot find module '@/lib/admin/combos/service'`.
- [ ] **Step 3: Implementar el servicio** — crear `src/lib/admin/combos/service.ts` con contenido completo:
```ts
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import type { ComboClean } from "@/lib/admin/combos/validation";

/** Superficie mínima de DB que usa el servicio (para inyectar fakes en tests). */
export interface ComboDb {
  combo: {
    findUnique: (args: { where: { slug: string }; select: { id: true } }) => Promise<{ id: string } | null>;
    delete: (args: { where: { id: string } }) => Promise<{ id: string }>;
  };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}
export interface CreateComboDeps {
  db: ComboDb;
}

export function defaultComboDeps(): CreateComboDeps {
  return { db: prisma as unknown as ComboDb };
}

/** Lanza si el slug ya está tomado por OTRO combo (o cualquiera, si ignoreId es undefined). */
async function assertSlugFree(db: ComboDb, slug: string, ignoreId?: string): Promise<void> {
  const existing = await db.combo.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== ignoreId) {
    throw new Error("Ya existe un combo con ese slug.");
  }
}

export async function createCombo(input: ComboClean, deps: CreateComboDeps): Promise<{ id: string }> {
  await assertSlugFree(deps.db, input.slug);
  const created = await deps.db.$transaction(async (tx) => {
    return tx.combo.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        comboPrice: input.comboPrice,
        images: input.images,
        active: input.active,
        validFrom: input.validFrom,
        validTo: input.validTo,
        items: { create: input.items.map((i) => ({ variantId: i.variantId, qty: i.qty })) },
      },
    });
  });
  return { id: created.id };
}

export async function updateCombo(id: string, input: ComboClean, deps: CreateComboDeps): Promise<{ id: string }> {
  await assertSlugFree(deps.db, input.slug, id);
  const updated = await deps.db.$transaction(async (tx) => {
    const combo = await tx.combo.update({
      where: { id },
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        comboPrice: input.comboPrice,
        images: input.images,
        active: input.active,
        validFrom: input.validFrom,
        validTo: input.validTo,
      },
    });
    await tx.comboItem.deleteMany({ where: { comboId: id } });
    await tx.comboItem.createMany({
      data: input.items.map((i) => ({ comboId: id, variantId: i.variantId, qty: i.qty })),
    });
    return combo;
  });
  return { id: updated.id };
}

export async function deleteCombo(id: string, deps: CreateComboDeps): Promise<void> {
  await deps.db.combo.delete({ where: { id } });
}
```
- [ ] **Step 4: Correr el test (verde)**
  - Run: `pnpm test -- tests/integration/admin/combos-service.test.ts`
  - Expected: PASS — create/update/delete y los chequeos de slug en verde.
- [ ] **Step 5: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes.
- [ ] **Step 6: Commit**
  - Run:
    ```bash
    git add src/lib/admin/combos/service.ts tests/integration/admin/combos-service.test.ts
    git commit -m "$(cat <<'EOF'
feat(m3): servicio de combos (create/update/delete) con tx e items

createCombo/updateCombo reemplazan items en una tx y verifican unicidad
de slug contra la DB; deleteCombo borra por id (items por cascade).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task COMBOS-3: Server actions de combos

**Files**
- Create: `src/app/admin/(panel)/combos/actions.ts`

- [ ] **Step 1: Implementar las actions** — crear `src/app/admin/(panel)/combos/actions.ts` con contenido completo. Orquestan `requireAdmin` → `validateCombo` → servicio → `revalidatePath`, devolviendo `AdminResult`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { validateCombo, type ComboFormInput } from "@/lib/admin/combos/validation";
import { createCombo, updateCombo, deleteCombo, defaultComboDeps } from "@/lib/admin/combos/service";

/** Payload serializable desde el form cliente (fechas como ISO string o null). */
export interface ComboActionInput {
  name: string;
  slug: string;
  description: string;
  comboPrice: number;
  images: string[];
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  items: { variantId: string; qty: number }[];
}

function toFormInput(input: ComboActionInput): ComboFormInput {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description,
    comboPrice: input.comboPrice,
    images: input.images,
    active: input.active,
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validTo: input.validTo ? new Date(input.validTo) : null,
    items: input.items,
  };
}

export async function createComboAction(input: ComboActionInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCombo(toFormInput(input));
    if (!v.ok) return { ok: false, error: v.error };
    const { id } = await createCombo(v.value, defaultComboDeps());
    revalidatePath("/admin/combos");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el combo." };
  }
}

export async function updateComboAction(id: string, input: ComboActionInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCombo(toFormInput(input));
    if (!v.ok) return { ok: false, error: v.error };
    const res = await updateCombo(id, v.value, defaultComboDeps());
    revalidatePath("/admin/combos");
    revalidatePath(`/admin/combos/${id}`);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el combo." };
  }
}

export async function deleteComboAction(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    await deleteCombo(id, defaultComboDeps());
    revalidatePath("/admin/combos");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo borrar el combo." };
  }
}
```
- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes. (Verificar que `requireAdmin` y `AdminResult` ya existan desde AUTH/FOUNDATIONS; si esos módulos aún no están en la rama, esta tarea se ejecuta después de ellos.)
- [ ] **Step 3: Commit**
  - Run:
    ```bash
    git add "src/app/admin/(panel)/combos/actions.ts"
    git commit -m "$(cat <<'EOF'
feat(m3): server actions de combos (crear/editar/borrar)

requireAdmin → validateCombo → servicio → revalidatePath; devuelven AdminResult.
Convierte fechas ISO del form a Date antes de validar.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task COMBOS-4: Formulario cliente `combo-form.tsx`

**Files**
- Create: `src/app/admin/(panel)/combos/combo-form.tsx`

- [ ] **Step 1: Implementar el form cliente** — crear `src/app/admin/(panel)/combos/combo-form.tsx`. Cliente; permite elegir variantes (por producto → variante) y qty, fija nombre/slug/precio/fechas/activo, y llama a la action correspondiente. Contenido completo:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createComboAction, updateComboAction, type ComboActionInput } from "./actions";

/** Variante seleccionable: aplanada como producto → variante para el picker. */
export interface VariantOption {
  id: string;
  label: string; // "Labial Mate — Rojo Pasión (LAB-0001)"
}

export interface ComboFormItem {
  variantId: string;
  qty: number;
}

export interface ComboFormInitial {
  id?: string;
  name: string;
  slug: string;
  description: string;
  comboPrice: number;
  active: boolean;
  validFrom: string | null; // "YYYY-MM-DD" para <input type=date>
  validTo: string | null;
  images: string[];
  items: ComboFormItem[];
}

interface ComboFormProps {
  variantOptions: VariantOption[];
  initial?: ComboFormInitial;
}

const empty: ComboFormInitial = {
  name: "",
  slug: "",
  description: "",
  comboPrice: 0,
  active: true,
  validFrom: null,
  validTo: null,
  images: [],
  items: [{ variantId: "", qty: 1 }],
};

export function ComboForm({ variantOptions, initial }: ComboFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const start = initial ?? empty;

  const [name, setName] = useState(start.name);
  const [slug, setSlug] = useState(start.slug);
  const [description, setDescription] = useState(start.description);
  const [comboPrice, setComboPrice] = useState(String(start.comboPrice || ""));
  const [active, setActive] = useState(start.active);
  const [validFrom, setValidFrom] = useState(start.validFrom ?? "");
  const [validTo, setValidTo] = useState(start.validTo ?? "");
  const [items, setItems] = useState<ComboFormItem[]>(start.items.length > 0 ? start.items : [{ variantId: "", qty: 1 }]);

  const addItem = () => setItems((prev) => [...prev, { variantId: "", qty: 1 }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const setVariant = (idx: number, variantId: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, variantId } : it)));
  const setQty = (idx: number, qty: number) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty } : it)));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const payload: ComboActionInput = {
      name,
      slug,
      description,
      comboPrice: Number(comboPrice),
      images: start.images,
      active,
      validFrom: validFrom ? new Date(`${validFrom}T00:00:00.000Z`).toISOString() : null,
      validTo: validTo ? new Date(`${validTo}T00:00:00.000Z`).toISOString() : null,
      items: items.map((it) => ({ variantId: it.variantId, qty: it.qty })),
    };
    startTransition(async () => {
      const res = initial?.id
        ? await updateComboAction(initial.id, payload)
        : await createComboAction(payload);
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar el combo.");
        return;
      }
      router.push("/admin/combos");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="combo-name">Nombre del combo</Label>
        <Input id="combo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Combo Glow" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="combo-slug">Slug (link)</Label>
        <Input id="combo-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="se arma solo desde el nombre" />
        <p className="text-sm text-muted-foreground">Si lo dejás vacío, se arma solo a partir del nombre.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="combo-desc">Descripción</Label>
        <Textarea id="combo-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué incluye el combo" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="combo-price">Precio del combo (ARS)</Label>
        <Input
          id="combo-price"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={comboPrice}
          onChange={(e) => setComboPrice(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="combo-from">Desde (opcional)</Label>
          <Input id="combo-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="combo-to">Hasta (opcional)</Label>
          <Input id="combo-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch id="combo-active" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="combo-active">Combo activo (se ve en la tienda)</Label>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-foreground">Productos del combo</legend>
        <p className="text-sm text-muted-foreground">Elegí qué variantes entran y cuántas de cada una.</p>
        {items.map((it, idx) => (
          <div key={idx} className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor={`item-variant-${idx}`}>Producto / variante</Label>
              <Select value={it.variantId} onValueChange={(v) => setVariant(idx, v)}>
                <SelectTrigger id={`item-variant-${idx}`}>
                  <SelectValue placeholder="Elegí una variante" />
                </SelectTrigger>
                <SelectContent>
                  {variantOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-2">
              <Label htmlFor={`item-qty-${idx}`}>Cantidad</Label>
              <Input
                id={`item-qty-${idx}`}
                type="number"
                min="1"
                step="1"
                value={it.qty}
                onChange={(e) => setQty(idx, Number(e.target.value))}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(idx)}
              disabled={items.length <= 1}
              aria-label="Quitar producto del combo"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addItem}>
          <Plus className="size-4" aria-hidden />
          Agregar producto
        </Button>
      </fieldset>

      {error ? (
        <p className={cn("rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive")} role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : initial?.id ? "Guardar cambios" : "Crear combo"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/combos")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
```
- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes. (Depende de `Label`, `Textarea`, `Switch` de FOUNDATIONS; ejecutar esta tarea después de que existan esos primitivos.)
  - Verificar en app: en `/admin/combos/nuevo` el form muestra nombre, slug, precio, fechas, switch activo y la lista de productos con su selector de variante + cantidad, botón "Agregar producto" suma renglones y "Crear combo" guarda y vuelve a la lista.
- [ ] **Step 3: Commit**
  - Run:
    ```bash
    git add "src/app/admin/(panel)/combos/combo-form.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): formulario de combos (cliente) con picker de variantes y qty

Campos nombre/slug/descripción/precio/fechas/activo + renglones de
producto→variante con cantidad; llama create/updateComboAction.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task COMBOS-5: Páginas lista / alta / edición

**Files**
- Create: `src/app/admin/(panel)/combos/page.tsx`
- Create: `src/app/admin/(panel)/combos/nuevo/page.tsx`
- Create: `src/app/admin/(panel)/combos/[id]/page.tsx`

- [ ] **Step 1: Helper de opciones de variante** — agregar al final de `src/app/admin/(panel)/combos/actions.ts` una función reutilizable (Server Component la usa para poblar el picker). Editar `src/app/admin/(panel)/combos/actions.ts` para añadir, después de las actions existentes:
```ts
import { prisma } from "@/lib/prisma";
import type { VariantOption } from "./combo-form";

/** Lista plana de variantes activas (de productos no borrados) para el picker del form. */
export async function listVariantOptions(): Promise<VariantOption[]> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      name: true,
      variants: {
        where: { active: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, sku: true },
      },
    },
  });
  const options: VariantOption[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      options.push({ id: v.id, label: `${p.name} — ${v.name} (${v.sku})` });
    }
  }
  return options;
}
```
- [ ] **Step 2: Página de lista** — crear `src/app/admin/(panel)/combos/page.tsx` (Server Component). Lista con título + "para qué sirve", tabla con nombre, precio, items, estado y vigencia; empty state guiado:
```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { formatARS } from "@/lib/money";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function CombosPage() {
  const combos = await prisma.combo.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      comboPrice: true,
      active: true,
      validFrom: true,
      validTo: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Combos" subtitle="Packs de varios productos a un precio fijo." />
        <Button asChild>
          <Link href="/admin/combos/nuevo">
            <Plus className="size-4" aria-hidden />
            Nuevo combo
          </Link>
        </Button>
      </div>

      {combos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-lg font-semibold text-foreground">Todavía no hay combos</p>
          <p className="mt-1 text-muted-foreground">Armá un pack de productos y poné un precio especial para vender más.</p>
          <Button asChild className="mt-4">
            <Link href="/admin/combos/nuevo">
              <Plus className="size-4" aria-hidden />
              Crear el primer combo
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Vigencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combos.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/admin/combos/${c.id}`} className="font-medium text-foreground hover:text-primary">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{formatARS(toNumber(c.comboPrice))}</TableCell>
                <TableCell>{c._count.items}</TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.validFrom || c.validTo
                    ? `${c.validFrom ? c.validFrom.toLocaleDateString("es-AR") : "—"} → ${c.validTo ? c.validTo.toLocaleDateString("es-AR") : "—"}`
                    : "Sin límite"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```
- [ ] **Step 3: Página de alta** — crear `src/app/admin/(panel)/combos/nuevo/page.tsx`:
```tsx
import { PageHeader } from "@/components/admin/page-header";
import { ComboForm } from "../combo-form";
import { listVariantOptions } from "../actions";

export const dynamic = "force-dynamic";

export default async function NuevoComboPage() {
  const variantOptions = await listVariantOptions();
  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo combo" subtitle="Elegí los productos del pack y poné el precio del combo." />
      <ComboForm variantOptions={variantOptions} />
    </div>
  );
}
```
- [ ] **Step 4: Página de edición** — crear `src/app/admin/(panel)/combos/[id]/page.tsx`. Carga el combo + items, mapea a `ComboFormInitial` (fechas a `YYYY-MM-DD`), 404 si no existe:
```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { PageHeader } from "@/components/admin/page-header";
import { ComboForm, type ComboFormInitial } from "../combo-form";
import { listVariantOptions } from "../actions";

export const dynamic = "force-dynamic";

function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export default async function EditarComboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [combo, variantOptions] = await Promise.all([
    prisma.combo.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        comboPrice: true,
        active: true,
        validFrom: true,
        validTo: true,
        images: true,
        items: { select: { variantId: true, qty: true } },
      },
    }),
    listVariantOptions(),
  ]);

  if (!combo) notFound();

  const initial: ComboFormInitial = {
    id: combo.id,
    name: combo.name,
    slug: combo.slug,
    description: combo.description ?? "",
    comboPrice: toNumber(combo.comboPrice),
    active: combo.active,
    validFrom: toDateInput(combo.validFrom),
    validTo: toDateInput(combo.validTo),
    images: combo.images,
    items: combo.items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Editar combo" subtitle="Cambiá productos, precio o vigencia del combo." />
      <ComboForm variantOptions={variantOptions} initial={initial} />
    </div>
  );
}
```
- [ ] **Step 5: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes. (Depende de `PageHeader`, `Table`, `Badge` de FOUNDATIONS; ejecutar después de esos primitivos.)
  - Verificar en app: `/admin/combos` muestra la tabla (o empty state guiado) con "Nuevo combo"; `/admin/combos/nuevo` y `/admin/combos/[id]` renderizan el form (edición precargada con sus items y fechas).
- [ ] **Step 6: Commit**
  - Run:
    ```bash
    git add "src/app/admin/(panel)/combos/page.tsx" "src/app/admin/(panel)/combos/nuevo/page.tsx" "src/app/admin/(panel)/combos/[id]/page.tsx" "src/app/admin/(panel)/combos/actions.ts"
    git commit -m "$(cat <<'EOF'
feat(m3): páginas de combos (lista, alta, edición) + picker de variantes

Lista con tabla/empty state, alta y edición precargada; listVariantOptions
aplana producto→variante activa para el selector del form.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```


---


## COUPONS — CRUD de cupones (admin)

Permite a la dueña crear, editar y desactivar cupones de descuento (porcentaje, monto fijo o envío gratis) con su alcance, vigencia y límites de uso. Validación pura en `validation.ts` (formato del código, reglas de `value` por tipo, rango de fechas, `scopeId` requerido si `scope ≠ all`), unicidad del código en el servicio contra la DB, y páginas list/crear/editar. El validador se llama `validateCouponInput` para no chocar con `validateCoupon` de `@/lib/coupons/apply`.

**Files**
- Create: `src/lib/admin/coupons/validation.ts`
- Create: `src/lib/admin/coupons/service.ts`
- Create: `src/app/admin/(panel)/cupones/page.tsx` (list — Server Component)
- Create: `src/app/admin/(panel)/cupones/nuevo/page.tsx` (crear — Server Component)
- Create: `src/app/admin/(panel)/cupones/[id]/page.tsx` (editar — Server Component)
- Create: `src/app/admin/(panel)/cupones/coupon-form.tsx` (`"use client"`)
- Create: `src/app/admin/(panel)/cupones/actions.ts` (`"use server"`)
- Test: `tests/unit/admin/coupons-validation.test.ts`
- Test: `tests/integration/admin/coupons-service.test.ts`

Notes: `AdminResult` (`@/lib/admin/result`), `requireAdmin` (`@/lib/admin/auth`), `PageHeader` / `AdminSidebar` (`@/components/admin/*`), `Table` / `Badge` / `Label` / `Switch` / `Textarea` (`@/components/ui/*`) and `slugify`/`sku` helpers come from FOUNDATIONS/AUTH sections — reference, do not redefine. `CouponType`, `CouponScope` enums already exist in `prisma/schema.prisma`.

---

### Task COUPONS-1: Validador puro `validateCouponInput`

**Files**
- Create: `src/lib/admin/coupons/validation.ts`
- Test: `tests/unit/admin/coupons-validation.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/admin/coupons-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateCouponInput, type CouponFormInput } from "@/lib/admin/coupons/validation";

const base: CouponFormInput = {
  code: "  glam10 ",
  type: "percentage",
  value: "10",
  scope: "all",
  scopeId: "",
  minSubtotal: "",
  maxUses: "",
  perCustomerLimit: "",
  validFrom: "",
  validTo: "",
  active: true,
};

describe("validateCouponInput", () => {
  it("normaliza el código a MAYÚSCULAS y trim", () => {
    const r = validateCouponInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.code).toBe("GLAM10");
  });

  it("acepta guiones y números en el código", () => {
    const r = validateCouponInput({ ...base, code: "VERANO-2026" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.code).toBe("VERANO-2026");
  });

  it("rechaza código vacío", () => {
    const r = validateCouponInput({ ...base, code: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/código/i);
  });

  it("rechaza código con caracteres inválidos", () => {
    const r = validateCouponInput({ ...base, code: "glam 10!" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/código/i);
  });

  it("percentage: rechaza value fuera de 1–100", () => {
    expect(validateCouponInput({ ...base, type: "percentage", value: "0" }).ok).toBe(false);
    expect(validateCouponInput({ ...base, type: "percentage", value: "101" }).ok).toBe(false);
    const ok = validateCouponInput({ ...base, type: "percentage", value: "100" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.value).toBe(100);
  });

  it("fixed: exige value > 0", () => {
    expect(validateCouponInput({ ...base, type: "fixed", value: "0" }).ok).toBe(false);
    const ok = validateCouponInput({ ...base, type: "fixed", value: "1500.5" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.value).toBe(1500.5);
  });

  it("free_shipping: fuerza value a 0 e ignora lo ingresado", () => {
    const r = validateCouponInput({ ...base, type: "free_shipping", value: "999" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.value).toBe(0);
  });

  it("scope distinto de all requiere scopeId", () => {
    expect(validateCouponInput({ ...base, scope: "category", scopeId: "" }).ok).toBe(false);
    const ok = validateCouponInput({ ...base, scope: "category", scopeId: "cat-1" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.scopeId).toBe("cat-1");
  });

  it("scope all fuerza scopeId a null aunque venga algo", () => {
    const r = validateCouponInput({ ...base, scope: "all", scopeId: "cat-1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.scopeId).toBeNull();
  });

  it("opcionales vacíos → null", () => {
    const r = validateCouponInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.minSubtotal).toBeNull();
      expect(r.value.maxUses).toBeNull();
      expect(r.value.perCustomerLimit).toBeNull();
      expect(r.value.validFrom).toBeNull();
      expect(r.value.validTo).toBeNull();
    }
  });

  it("minSubtotal negativo → error; positivo → number", () => {
    expect(validateCouponInput({ ...base, minSubtotal: "-5" }).ok).toBe(false);
    const ok = validateCouponInput({ ...base, minSubtotal: "20000" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.minSubtotal).toBe(20000);
  });

  it("maxUses / perCustomerLimit deben ser enteros ≥ 1", () => {
    expect(validateCouponInput({ ...base, maxUses: "0" }).ok).toBe(false);
    expect(validateCouponInput({ ...base, maxUses: "2.5" }).ok).toBe(false);
    expect(validateCouponInput({ ...base, perCustomerLimit: "-1" }).ok).toBe(false);
    const ok = validateCouponInput({ ...base, maxUses: "100", perCustomerLimit: "1" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.maxUses).toBe(100);
      expect(ok.value.perCustomerLimit).toBe(1);
    }
  });

  it("fechas: parsea y exige from ≤ to", () => {
    const bad = validateCouponInput({ ...base, validFrom: "2026-07-01", validTo: "2026-06-01" });
    expect(bad.ok).toBe(false);
    const ok = validateCouponInput({ ...base, validFrom: "2026-06-01", validTo: "2026-07-01" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.validFrom).toEqual(new Date("2026-06-01"));
      expect(ok.value.validTo).toEqual(new Date("2026-07-01"));
    }
  });

  it("rechaza fecha con formato inválido", () => {
    expect(validateCouponInput({ ...base, validFrom: "no-es-fecha" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `pnpm test -- tests/unit/admin/coupons-validation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/admin/coupons/validation'`.

- [ ] **Step 3: Implement the validator**

Create `src/lib/admin/coupons/validation.ts`:

```ts
import { round2 } from "@/lib/money";

export type CouponType = "percentage" | "fixed" | "free_shipping";
export type CouponScope = "all" | "category" | "product";

/** Lo que llega del form (todo string salvo `active`/enums) antes de validar. */
export interface CouponFormInput {
  code: string;
  type: CouponType;
  value: string;
  scope: CouponScope;
  scopeId: string;
  minSubtotal: string;
  maxUses: string;
  perCustomerLimit: string;
  validFrom: string;
  validTo: string;
  active: boolean;
}

/** Datos limpios listos para persistir. */
export interface CouponClean {
  code: string;
  type: CouponType;
  value: number;
  scope: CouponScope;
  scopeId: string | null;
  minSubtotal: number | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  active: boolean;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const CODE_RE = /^[A-Z0-9-]+$/;

function parseOptionalNumber(raw: string): { ok: true; value: number | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false };
  return { ok: true, value: n };
}

function parseOptionalInt(raw: string): { ok: true; value: number | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1) return { ok: false };
  return { ok: true, value: n };
}

function parseOptionalDate(raw: string): { ok: true; value: Date | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return { ok: false };
  return { ok: true, value: d };
}

/**
 * Valida y normaliza un cupón. Pura, sin DB.
 * NOTA: se llama `validateCouponInput` para no chocar con `validateCoupon` de `@/lib/coupons/apply`.
 * La unicidad del `code` se chequea en el servicio contra la DB.
 */
export function validateCouponInput(input: CouponFormInput): Validated<CouponClean> {
  const code = input.code.trim().toUpperCase();
  if (code === "") return { ok: false, error: "Poné un código para el cupón." };
  if (!CODE_RE.test(code)) {
    return { ok: false, error: "El código solo puede tener letras, números y guiones." };
  }

  // value según type
  let value: number;
  if (input.type === "free_shipping") {
    value = 0; // se ignora lo ingresado
  } else {
    const v = Number(input.value.trim());
    if (!Number.isFinite(v)) return { ok: false, error: "Poné un valor numérico para el descuento." };
    if (input.type === "percentage") {
      if (v < 1 || v > 100) return { ok: false, error: "El porcentaje tiene que estar entre 1 y 100." };
    } else {
      if (v <= 0) return { ok: false, error: "El monto fijo tiene que ser mayor a 0." };
    }
    value = round2(v);
  }

  // scope + scopeId
  let scopeId: string | null;
  if (input.scope === "all") {
    scopeId = null;
  } else {
    const id = input.scopeId.trim();
    if (id === "") {
      return { ok: false, error: "Elegí a qué categoría o producto aplica el cupón." };
    }
    scopeId = id;
  }

  const minRes = parseOptionalNumber(input.minSubtotal);
  if (!minRes.ok || (minRes.value != null && minRes.value < 0)) {
    return { ok: false, error: "El mínimo de compra tiene que ser un número ≥ 0." };
  }

  const maxUsesRes = parseOptionalInt(input.maxUses);
  if (!maxUsesRes.ok) return { ok: false, error: "El máximo de usos tiene que ser un número entero ≥ 1." };

  const perCustomerRes = parseOptionalInt(input.perCustomerLimit);
  if (!perCustomerRes.ok) {
    return { ok: false, error: "El límite por clienta tiene que ser un número entero ≥ 1." };
  }

  const fromRes = parseOptionalDate(input.validFrom);
  if (!fromRes.ok) return { ok: false, error: "La fecha de inicio no es válida." };
  const toRes = parseOptionalDate(input.validTo);
  if (!toRes.ok) return { ok: false, error: "La fecha de fin no es válida." };
  if (fromRes.value && toRes.value && fromRes.value > toRes.value) {
    return { ok: false, error: "La fecha de inicio no puede ser posterior a la de fin." };
  }

  return {
    ok: true,
    value: {
      code,
      type: input.type,
      value,
      scope: input.scope,
      scopeId,
      minSubtotal: minRes.value != null ? round2(minRes.value) : null,
      maxUses: maxUsesRes.value,
      perCustomerLimit: perCustomerRes.value,
      validFrom: fromRes.value,
      validTo: toRes.value,
      active: input.active,
    },
  };
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `pnpm test -- tests/unit/admin/coupons-validation.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: passes (no errors).

- [ ] **Step 6: Commit**

Run:
```
git add src/lib/admin/coupons/validation.ts tests/unit/admin/coupons-validation.test.ts
git commit -m "$(cat <<'EOF'
test(m3): validador puro de cupones (formato, value por tipo, scope, fechas)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task COUPONS-2: Servicio `createCoupon` / `updateCoupon` / `deleteCoupon` (deps + db inyectable)

**Files**
- Create: `src/lib/admin/coupons/service.ts`
- Test: `tests/integration/admin/coupons-service.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/admin/coupons-service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  createCoupon, updateCoupon, deleteCoupon,
  type CreateCouponDeps, type CouponDb,
} from "@/lib/admin/coupons/service";
import type { CouponClean } from "@/lib/admin/coupons/validation";

const clean = (over: Partial<CouponClean> = {}): CouponClean => ({
  code: "GLAM10",
  type: "percentage",
  value: 10,
  scope: "all",
  scopeId: null,
  minSubtotal: null,
  maxUses: null,
  perCustomerLimit: null,
  validFrom: null,
  validTo: null,
  active: true,
  ...over,
});

function makeDeps(over: Partial<{ existing: { id: string } | null }> = {}): { deps: CreateCouponDeps; db: CouponDb } {
  const db = {
    coupon: {
      findUnique: vi.fn(async () => ("existing" in over ? over.existing ?? null : null)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cp-1", ...data })),
      update: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
    },
  } as unknown as CouponDb;
  return { deps: { db }, db };
}

describe("createCoupon", () => {
  it("crea el cupón cuando el código es único", async () => {
    const { deps, db } = makeDeps();
    const r = await createCoupon(clean(), deps);
    expect(r.id).toBe("cp-1");
    expect(db.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "GLAM10" } });
    const data = (db.coupon.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.code).toBe("GLAM10");
    expect(data.type).toBe("percentage");
    expect(data.value).toBe(10);
    expect(data.scopeId).toBeNull();
  });

  it("rechaza código duplicado", async () => {
    const { deps } = makeDeps({ existing: { id: "otro" } });
    await expect(createCoupon(clean(), deps)).rejects.toThrow(/código/i);
  });

  it("persiste opcionales (minSubtotal, maxUses, fechas)", async () => {
    const { deps, db } = makeDeps();
    await createCoupon(
      clean({ minSubtotal: 20000, maxUses: 100, validFrom: new Date("2026-06-01"), validTo: new Date("2026-07-01") }),
      deps,
    );
    const data = (db.coupon.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.minSubtotal).toBe(20000);
    expect(data.maxUses).toBe(100);
    expect(data.validFrom).toEqual(new Date("2026-06-01"));
    expect(data.validTo).toEqual(new Date("2026-07-01"));
  });
});

describe("updateCoupon", () => {
  it("actualiza cuando el código no choca con otro cupón", async () => {
    const { deps, db } = makeDeps({ existing: null });
    const r = await updateCoupon("cp-9", clean({ code: "GLAM20", value: 20 }), deps);
    expect(r.id).toBe("cp-9");
    const data = (db.coupon.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.code).toBe("GLAM20");
    expect(data.value).toBe(20);
  });

  it("permite mantener el mismo código si pertenece al mismo cupón", async () => {
    const { deps } = makeDeps({ existing: { id: "cp-9" } });
    const r = await updateCoupon("cp-9", clean({ code: "GLAM10" }), deps);
    expect(r.id).toBe("cp-9");
  });

  it("rechaza si el código pertenece a otro cupón", async () => {
    const { deps } = makeDeps({ existing: { id: "cp-otro" } });
    await expect(updateCoupon("cp-9", clean({ code: "GLAM10" }), deps)).rejects.toThrow(/código/i);
  });
});

describe("deleteCoupon", () => {
  it("borra el cupón por id", async () => {
    const { deps, db } = makeDeps();
    const r = await deleteCoupon("cp-3", deps);
    expect(r.id).toBe("cp-3");
    expect(db.coupon.delete).toHaveBeenCalledWith({ where: { id: "cp-3" } });
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `pnpm test -- tests/integration/admin/coupons-service.test.ts`
Expected: FAIL — `Cannot find module '@/lib/admin/coupons/service'`.

- [ ] **Step 3: Implement the service**

Create `src/lib/admin/coupons/service.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { CouponClean } from "@/lib/admin/coupons/validation";

/** Superficie mínima de DB que usa el servicio (para inyectar fakes en tests). */
export interface CouponDb {
  coupon: {
    findUnique: (args: { where: { code: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: CouponData }) => Promise<{ id: string }>;
    update: (args: { where: { id: string }; data: CouponData }) => Promise<{ id: string }>;
    delete: (args: { where: { id: string } }) => Promise<{ id: string }>;
  };
}

export interface CreateCouponDeps {
  db: CouponDb;
}

export function defaultCouponDeps(): CreateCouponDeps {
  return { db: prisma as unknown as CouponDb };
}

/** Payload de persistencia (mapea 1:1 al modelo Coupon de Prisma). */
interface CouponData {
  code: string;
  type: CouponClean["type"];
  value: number;
  scope: CouponClean["scope"];
  scopeId: string | null;
  minSubtotal: number | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  active: boolean;
}

function toData(input: CouponClean): CouponData {
  return {
    code: input.code,
    type: input.type,
    value: input.value,
    scope: input.scope,
    scopeId: input.scopeId,
    minSubtotal: input.minSubtotal,
    maxUses: input.maxUses,
    perCustomerLimit: input.perCustomerLimit,
    validFrom: input.validFrom,
    validTo: input.validTo,
    active: input.active,
  };
}

/** Crea un cupón. Lanza si el código ya existe (la unicidad va acá, no en el validador). */
export async function createCoupon(input: CouponClean, deps: CreateCouponDeps): Promise<{ id: string }> {
  const existing = await deps.db.coupon.findUnique({ where: { code: input.code } });
  if (existing) throw new Error("Ya existe un cupón con ese código.");
  const created = await deps.db.coupon.create({ data: toData(input) });
  return { id: created.id };
}

/** Actualiza un cupón. El código solo puede chocar consigo mismo. */
export async function updateCoupon(id: string, input: CouponClean, deps: CreateCouponDeps): Promise<{ id: string }> {
  const existing = await deps.db.coupon.findUnique({ where: { code: input.code } });
  if (existing && existing.id !== id) throw new Error("Ya existe otro cupón con ese código.");
  const updated = await deps.db.coupon.update({ where: { id }, data: toData(input) });
  return { id: updated.id };
}

/** Borra un cupón por id. */
export async function deleteCoupon(id: string, deps: CreateCouponDeps): Promise<{ id: string }> {
  const deleted = await deps.db.coupon.delete({ where: { id } });
  return { id: deleted.id };
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `pnpm test -- tests/integration/admin/coupons-service.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: passes (no errors).

- [ ] **Step 6: Commit**

Run:
```
git add src/lib/admin/coupons/service.ts tests/integration/admin/coupons-service.test.ts
git commit -m "$(cat <<'EOF'
test(m3): servicio de cupones (create/update/delete con unicidad de código)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task COUPONS-3: Server actions (`requireAdmin` → validate → service → revalidate)

**Files**
- Create: `src/app/admin/(panel)/cupones/actions.ts`

- [ ] **Step 1: Implement the actions**

Create `src/app/admin/(panel)/cupones/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { validateCouponInput, type CouponFormInput } from "@/lib/admin/coupons/validation";
import { createCoupon, updateCoupon, deleteCoupon, defaultCouponDeps } from "@/lib/admin/coupons/service";

export async function createCouponAction(input: CouponFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCouponInput(input);
    if (!v.ok) return { ok: false, error: v.error };
    const { id } = await createCoupon(v.value, defaultCouponDeps());
    revalidatePath("/admin/cupones");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el cupón." };
  }
}

export async function updateCouponAction(id: string, input: CouponFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const v = validateCouponInput(input);
    if (!v.ok) return { ok: false, error: v.error };
    const res = await updateCoupon(id, v.value, defaultCouponDeps());
    revalidatePath("/admin/cupones");
    revalidatePath(`/admin/cupones/${id}`);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el cupón." };
  }
}

export async function deleteCouponAction(id: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    const res = await deleteCoupon(id, defaultCouponDeps());
    revalidatePath("/admin/cupones");
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo eliminar el cupón." };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes (no errors).

Verify in app: las acciones se invocan desde `coupon-form.tsx` (Task COUPONS-4) y desde el botón de eliminar de la lista (Task COUPONS-5); no tienen UI propia.

- [ ] **Step 3: Commit**

Run:
```
git add "src/app/admin/(panel)/cupones/actions.ts"
git commit -m "$(cat <<'EOF'
feat(m3): server actions de cupones (crear/editar/eliminar con requireAdmin)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task COUPONS-4: Formulario cliente `coupon-form.tsx`

**Files**
- Create: `src/app/admin/(panel)/cupones/coupon-form.tsx`

- [ ] **Step 1: Implement the client form**

Create `src/app/admin/(panel)/cupones/coupon-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CouponFormInput } from "@/lib/admin/coupons/validation";
import { createCouponAction, updateCouponAction } from "@/app/admin/(panel)/cupones/actions";

type CouponType = CouponFormInput["type"];
type CouponScope = CouponFormInput["scope"];

interface Props {
  /** Si viene, el form edita ese cupón; si no, crea uno nuevo. */
  couponId?: string;
  initial?: CouponFormInput;
}

const EMPTY: CouponFormInput = {
  code: "",
  type: "percentage",
  value: "",
  scope: "all",
  scopeId: "",
  minSubtotal: "",
  maxUses: "",
  perCustomerLimit: "",
  validFrom: "",
  validTo: "",
  active: true,
};

export function CouponForm({ couponId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CouponFormInput>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof CouponFormInput>(key: K, value: CouponFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startSaving(async () => {
      const r = couponId
        ? await updateCouponAction(couponId, form)
        : await createCouponAction(form);
      if (r.ok) {
        router.push("/admin/cupones");
        router.refresh();
      } else {
        setError(r.error ?? "No se pudo guardar el cupón.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="code">Código</Label>
        <Input
          id="code"
          value={form.code}
          onChange={(e) => set("code", e.target.value.toUpperCase())}
          placeholder="Ej: GLAM10"
          autoCapitalize="characters"
        />
        <p className="text-xs text-muted-foreground">Es lo que escribe la clienta al pagar. Solo letras, números y guiones.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo de descuento</Label>
          <select
            id="type"
            value={form.type}
            onChange={(e) => set("type", e.target.value as CouponType)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto fijo ($)</option>
            <option value="free_shipping">Envío gratis</option>
          </select>
        </div>

        {form.type !== "free_shipping" && (
          <div className="space-y-2">
            <Label htmlFor="value">{form.type === "percentage" ? "Porcentaje (1 a 100)" : "Monto en $"}</Label>
            <Input
              id="value"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              inputMode="decimal"
              placeholder={form.type === "percentage" ? "10" : "1500"}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scope">Aplica a</Label>
          <select
            id="scope"
            value={form.scope}
            onChange={(e) => set("scope", e.target.value as CouponScope)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="all">Todo el carrito</option>
            <option value="category">Una categoría</option>
            <option value="product">Un producto</option>
          </select>
        </div>

        {form.scope !== "all" && (
          <div className="space-y-2">
            <Label htmlFor="scopeId">{form.scope === "category" ? "ID de la categoría" : "ID del producto"}</Label>
            <Input
              id="scopeId"
              value={form.scopeId}
              onChange={(e) => set("scopeId", e.target.value)}
              placeholder="Pegá el ID"
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="minSubtotal">Mínimo de compra ($)</Label>
          <Input id="minSubtotal" value={form.minSubtotal} onChange={(e) => set("minSubtotal", e.target.value)} inputMode="decimal" placeholder="Opcional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxUses">Máximo de usos</Label>
          <Input id="maxUses" value={form.maxUses} onChange={(e) => set("maxUses", e.target.value)} inputMode="numeric" placeholder="Opcional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="perCustomerLimit">Usos por clienta</Label>
          <Input id="perCustomerLimit" value={form.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value)} inputMode="numeric" placeholder="Opcional" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="validFrom">Válido desde</Label>
          <Input id="validFrom" type="date" value={form.validFrom} onChange={(e) => set("validFrom", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="validTo">Válido hasta</Label>
          <Input id="validTo" type="date" value={form.validTo} onChange={(e) => set("validTo", e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch id="active" checked={form.active} onCheckedChange={(c) => set("active", c)} />
        <Label htmlFor="active">Cupón activo</Label>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {couponId ? "Guardar cambios" : "Crear cupón"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/cupones")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes (no errors). (Depends on `Label` y `Switch` de FOUNDATIONS; si todavía no existen, esta tarea se ejecuta después de FOUNDATIONS.)

Verify in app: en `/admin/cupones/nuevo` el form muestra el campo de valor solo para porcentaje/monto fijo, y el campo de `scopeId` solo cuando "Aplica a" no es "Todo el carrito".

- [ ] **Step 3: Commit**

Run:
```
git add "src/app/admin/(panel)/cupones/coupon-form.tsx"
git commit -m "$(cat <<'EOF'
feat(m3): formulario de cupones (campos condicionales por tipo y scope)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task COUPONS-5: Página lista `/admin/cupones`

**Files**
- Create: `src/app/admin/(panel)/cupones/page.tsx`

- [ ] **Step 1: Implement the list page (Server Component)**

Create `src/app/admin/(panel)/cupones/page.tsx`:

```tsx
import Link from "next/link";
import { Plus, Ticket } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { formatARS } from "@/lib/money";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  percentage: "Porcentaje",
  fixed: "Monto fijo",
  free_shipping: "Envío gratis",
};

function valueLabel(type: string, value: number): string {
  if (type === "percentage") return `${value}%`;
  if (type === "fixed") return formatARS(value);
  return "Envío gratis";
}

function dateLabel(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function CuponesPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Cupones" subtitle="Crea y administra los códigos de descuento para tus clientas." />
        <Button asChild>
          <Link href="/admin/cupones/nuevo">
            <Plus className="size-4" />
            Nuevo cupón
          </Link>
        </Button>
      </div>

      {coupons.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
          <Ticket className="size-8 text-muted-foreground" />
          <p className="font-display text-lg">Todavía no tenés cupones</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Un cupón es un código que tus clientas escriben al pagar para llevarse un descuento o el envío gratis.
          </p>
          <Button asChild>
            <Link href="/admin/cupones/nuevo">
              <Plus className="size-4" />
              Crear el primero
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo / Valor</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-semibold">{c.code}</TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{TYPE_LABEL[c.type]}</span>{" "}
                  <span className="font-medium">{valueLabel(c.type, toNumber(c.value))}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {dateLabel(c.validFrom)} → {dateLabel(c.validTo)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {c.usedCount}
                  {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                </TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/cupones/${c.id}`}>Editar</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes (no errors). (Depende de `Table`/`Badge`/`PageHeader` de FOUNDATIONS.)

Verify in app: en `/admin/cupones` con la DB vacía aparece el empty state guiado; con cupones seedeados se ve la tabla con código, tipo/valor, vigencia, usos y estado.

- [ ] **Step 3: Commit**

Run:
```
git add "src/app/admin/(panel)/cupones/page.tsx"
git commit -m "$(cat <<'EOF'
feat(m3): lista de cupones con tabla, vigencia, usos y empty state guiado

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task COUPONS-6: Páginas crear `/admin/cupones/nuevo` y editar `/admin/cupones/[id]`

**Files**
- Create: `src/app/admin/(panel)/cupones/nuevo/page.tsx`
- Create: `src/app/admin/(panel)/cupones/[id]/page.tsx`

- [ ] **Step 1: Implement the create page (Server Component)**

Create `src/app/admin/(panel)/cupones/nuevo/page.tsx`:

```tsx
import { PageHeader } from "@/components/admin/page-header";
import { CouponForm } from "@/app/admin/(panel)/cupones/coupon-form";

export default function NuevoCuponPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo cupón" subtitle="Crea un código de descuento para que tus clientas paguen menos." />
      <CouponForm />
    </div>
  );
}
```

- [ ] **Step 2: Implement the edit page (Server Component)**

Create `src/app/admin/(panel)/cupones/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { PageHeader } from "@/components/admin/page-header";
import { CouponForm } from "@/app/admin/(panel)/cupones/coupon-form";
import type { CouponFormInput } from "@/lib/admin/coupons/validation";

export const dynamic = "force-dynamic";

/** YYYY-MM-DD para <input type="date"> (UTC, sin desfase de zona). */
function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function numToInput(n: number | null): string {
  return n == null ? "" : String(n);
}

export default async function EditarCuponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) notFound();

  const initial: CouponFormInput = {
    code: coupon.code,
    type: coupon.type,
    value: coupon.type === "free_shipping" ? "" : String(toNumber(coupon.value)),
    scope: coupon.scope,
    scopeId: coupon.scopeId ?? "",
    minSubtotal: numToInput(coupon.minSubtotal != null ? toNumber(coupon.minSubtotal) : null),
    maxUses: numToInput(coupon.maxUses),
    perCustomerLimit: numToInput(coupon.perCustomerLimit),
    validFrom: toDateInput(coupon.validFrom),
    validTo: toDateInput(coupon.validTo),
    active: coupon.active,
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Editar cupón ${coupon.code}`} subtitle="Cambiá las condiciones del descuento. El conteo de usos no se puede editar." />
      <CouponForm couponId={coupon.id} initial={initial} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: passes (no errors).

Verify in app: `/admin/cupones/nuevo` muestra el form vacío; abrir un cupón existente desde la lista precarga sus valores (incluyendo fechas en formato `YYYY-MM-DD`) y guardar redirige a la lista.

- [ ] **Step 4: Commit**

Run:
```
git add "src/app/admin/(panel)/cupones/nuevo/page.tsx" "src/app/admin/(panel)/cupones/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(m3): páginas crear y editar cupón (precarga de valores y fechas)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```


---


## DASHBOARD — Dashboard (fechas ART, estadísticas, queries, página)

Estadísticas básicas para la dueña (blueprint 03 §4): ventas hoy/semana/mes, pedidos pendientes de acción, ticket promedio, top productos y stock crítico. Toda la matemática de fechas usa ART = UTC−3 fija (Argentina sin DST). Las funciones de fecha y de agregación son **puras** (reciben filas + `now`); el Server Component sólo hace los fetch de Prisma y renderiza.

**Files**
- Create: `src/lib/admin/dashboard/dates.ts` — límites de día/semana/mes en ART devueltos como `Date` UTC.
- Create: `src/lib/admin/dashboard/stats.ts` — agregaciones puras desde filas.
- Create: `src/lib/admin/dashboard/queries.ts` — fetch Prisma que alimenta las funciones puras.
- Create: `src/app/admin/(panel)/page.tsx` — dashboard (Server Component) → `/admin`.
- Create: `src/components/admin/stat-card.tsx` — card de número grande (Lucide icon + título + valor + subtítulo).
- Test: `tests/unit/admin/dashboard-dates.test.ts` — límites ART.
- Test: `tests/unit/admin/dashboard-stats.test.ts` — agregaciones.

> Depende de FOUNDATIONS: `PageHeader` (`@/components/admin/page-header`) y la card base `Card`/`CardContent` (`@/components/ui/card`) ya existen — se referencian, no se redefinen. `requireAdmin` lo aplica el layout `(panel)` de AUTH; la página no lo vuelve a llamar.

---

### Task DASHBOARD-1: Límites de fecha ART (puras, TDD)

**Files**
- Create: `src/lib/admin/dashboard/dates.ts`
- Test: `tests/unit/admin/dashboard-dates.test.ts`

- [ ] **Step 1: Escribir el test que falla** — crear `tests/unit/admin/dashboard-dates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  ART_OFFSET_MS,
  startOfDayART,
  startOfWeekART,
  startOfMonthART,
} from "@/lib/admin/dashboard/dates";

describe("dashboard/dates (ART = UTC−3 fija)", () => {
  // 2026-06-05T01:30:00Z = 2026-06-04 22:30 ART (miércoles→jueves cruzando medianoche)
  const now = new Date("2026-06-05T01:30:00Z");

  it("ART_OFFSET_MS son 3 horas en ms", () => {
    expect(ART_OFFSET_MS).toBe(3 * 60 * 60 * 1000);
  });

  it("startOfDayART = medianoche ART del día local, en UTC", () => {
    // 2026-06-04 00:00 ART = 2026-06-04T03:00:00Z
    expect(startOfDayART(now).toISOString()).toBe("2026-06-04T03:00:00.000Z");
  });

  it("startOfDayART respeta el día ART cuando UTC ya pasó a otro día", () => {
    // 2026-06-05T12:00:00Z = 2026-06-05 09:00 ART
    const midday = new Date("2026-06-05T12:00:00Z");
    expect(startOfDayART(midday).toISOString()).toBe("2026-06-05T03:00:00.000Z");
  });

  it("startOfWeekART = lunes 00:00 ART, en UTC", () => {
    // 2026-06-04 ART es jueves → lunes de esa semana = 2026-06-01 00:00 ART = 2026-06-01T03:00:00Z
    expect(startOfWeekART(now).toISOString()).toBe("2026-06-01T03:00:00.000Z");
  });

  it("startOfWeekART trata el domingo como fin de semana (lunes anterior)", () => {
    // 2026-06-07 ART es domingo → lunes = 2026-06-01 00:00 ART
    const sunday = new Date("2026-06-07T15:00:00Z"); // 12:00 ART domingo
    expect(startOfWeekART(sunday).toISOString()).toBe("2026-06-01T03:00:00.000Z");
  });

  it("startOfMonthART = día 1 00:00 ART, en UTC", () => {
    expect(startOfMonthART(now).toISOString()).toBe("2026-06-01T03:00:00.000Z");
  });

  it("startOfMonthART usa el mes ART, no el UTC", () => {
    // 2026-07-01T01:00:00Z = 2026-06-30 22:00 ART → mes ART es junio
    const cross = new Date("2026-07-01T01:00:00Z");
    expect(startOfMonthART(cross).toISOString()).toBe("2026-06-01T03:00:00.000Z");
  });
});
```
- [ ] **Step 2: Correr el test (debe fallar)**
  - Run: `pnpm test -- tests/unit/admin/dashboard-dates.test.ts`
  - Expected: FAIL — `Cannot find module '@/lib/admin/dashboard/dates'`.
- [ ] **Step 3: Implementar `dates.ts`** — crear `src/lib/admin/dashboard/dates.ts`:
```ts
/**
 * Límites de fecha en zona horaria de Argentina (ART = UTC−3 fija, sin DST).
 * Todas las funciones devuelven un `Date` que representa ese instante en UTC,
 * listo para comparar contra `createdAt` (UTC en DB).
 */

/** Offset de ART respecto a UTC, en milisegundos (UTC−3 → 3 horas). */
export const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Componentes de calendario en hora ART para un instante dado. */
function artParts(now: Date): { year: number; month: number; day: number; weekday: number } {
  const shifted = new Date(now.getTime() - ART_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0–11
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), // 0 = domingo … 6 = sábado
  };
}

/** Convierte una medianoche ART (año/mes/día) al instante UTC equivalente. */
function artMidnightToUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) + ART_OFFSET_MS);
}

/** Inicio del día ART (00:00 hora Argentina) que contiene a `now`, como `Date` UTC. */
export function startOfDayART(now: Date): Date {
  const { year, month, day } = artParts(now);
  return artMidnightToUtc(year, month, day);
}

/** Inicio de la semana ART (lunes 00:00 hora Argentina) que contiene a `now`, como `Date` UTC. */
export function startOfWeekART(now: Date): Date {
  const { year, month, day, weekday } = artParts(now);
  // Días desde el lunes: domingo (0) está a 6 días del lunes; resto = weekday − 1.
  const daysSinceMonday = (weekday + 6) % 7;
  return artMidnightToUtc(year, month, day - daysSinceMonday);
}

/** Inicio del mes ART (día 1 00:00 hora Argentina) que contiene a `now`, como `Date` UTC. */
export function startOfMonthART(now: Date): Date {
  const { year, month } = artParts(now);
  return artMidnightToUtc(year, month, 1);
}
```
- [ ] **Step 4: Correr el test (debe pasar)**
  - Run: `pnpm test -- tests/unit/admin/dashboard-dates.test.ts`
  - Expected: PASS (7 tests).
- [ ] **Step 5: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (sin errores).
- [ ] **Step 6: Commit**
  - Run: `git add src/lib/admin/dashboard/dates.ts tests/unit/admin/dashboard-dates.test.ts`
  - Run:
```
git commit -m "$(cat <<'EOF'
feat(m3): límites de fecha ART para el dashboard (puras + tests)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task DASHBOARD-2: Agregaciones puras de estadísticas (TDD)

**Files**
- Create: `src/lib/admin/dashboard/stats.ts`
- Test: `tests/unit/admin/dashboard-stats.test.ts`

- [ ] **Step 1: Escribir el test que falla** — crear `tests/unit/admin/dashboard-stats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  PAID_PLUS_STATUSES,
  sumSalesInRange,
  computeSalesBuckets,
  countPendingActions,
  averageTicket,
  topProducts,
  criticalStock,
  type DashboardOrderRow,
  type DashboardOrderItemRow,
  type DashboardVariantRow,
} from "@/lib/admin/dashboard/stats";

const order = (over: Partial<DashboardOrderRow> = {}): DashboardOrderRow => ({
  total: 1000,
  status: "paid",
  createdAt: new Date("2026-06-05T12:00:00Z"),
  ...over,
});

describe("PAID_PLUS_STATUSES", () => {
  it("son los estados que alcanzaron pago", () => {
    expect(PAID_PLUS_STATUSES).toEqual(["paid", "preparing", "shipped", "delivered"]);
  });
});

describe("sumSalesInRange", () => {
  it("suma total de pedidos paid+ con createdAt >= from", () => {
    const from = new Date("2026-06-05T03:00:00Z");
    const rows = [
      order({ total: 1000, createdAt: new Date("2026-06-05T12:00:00Z") }), // dentro
      order({ total: 500, createdAt: new Date("2026-06-04T12:00:00Z") }),  // antes de from
      order({ total: 2000, status: "delivered", createdAt: new Date("2026-06-05T20:00:00Z") }), // dentro
    ];
    expect(sumSalesInRange(rows, from)).toBe(3000);
  });

  it("ignora pedidos que no alcanzaron pago", () => {
    const from = new Date("2026-06-05T03:00:00Z");
    const rows = [
      order({ total: 1000, status: "pending_payment" }),
      order({ total: 1000, status: "cancelled" }),
      order({ total: 1000, status: "refunded" }),
    ];
    expect(sumSalesInRange(rows, from)).toBe(0);
  });

  it("normaliza montos en string (Decimal)", () => {
    const from = new Date("2026-06-05T03:00:00Z");
    const rows = [order({ total: "1500.50" as unknown as number })];
    expect(sumSalesInRange(rows, from)).toBe(1500.5);
  });
});

describe("computeSalesBuckets", () => {
  it("calcula ventas de hoy, semana y mes desde un único set de filas", () => {
    const now = new Date("2026-06-05T12:00:00Z"); // viernes 09:00 ART
    const rows = [
      order({ total: 1000, createdAt: new Date("2026-06-05T13:00:00Z") }), // hoy
      order({ total: 2000, createdAt: new Date("2026-06-02T13:00:00Z") }), // esta semana (martes), no hoy
      order({ total: 4000, createdAt: new Date("2026-05-20T13:00:00Z") }), // este mes, no esta semana
      order({ total: 8000, createdAt: new Date("2026-04-10T13:00:00Z") }), // mes anterior
    ];
    const b = computeSalesBuckets(rows, now);
    expect(b.today).toBe(1000);
    expect(b.week).toBe(3000); // hoy + martes
    expect(b.month).toBe(7000); // hoy + martes + 20/05
  });
});

describe("countPendingActions", () => {
  it("cuenta paid (a preparar) y preparing (a despachar)", () => {
    const rows = [
      order({ status: "paid" }),
      order({ status: "paid" }),
      order({ status: "preparing" }),
      order({ status: "shipped" }),
      order({ status: "pending_payment" }),
    ];
    expect(countPendingActions(rows)).toEqual({ toPrepare: 2, toDispatch: 1 });
  });
});

describe("averageTicket", () => {
  it("promedia total de pedidos paid+ con createdAt >= from", () => {
    const from = new Date("2026-06-01T03:00:00Z");
    const rows = [
      order({ total: 1000, createdAt: new Date("2026-06-05T12:00:00Z") }),
      order({ total: 3000, createdAt: new Date("2026-06-06T12:00:00Z") }),
      order({ total: 9999, status: "cancelled", createdAt: new Date("2026-06-06T12:00:00Z") }),
    ];
    expect(averageTicket(rows, from)).toBe(2000);
  });

  it("0 cuando no hay pedidos en el rango", () => {
    expect(averageTicket([], new Date("2026-06-01T03:00:00Z"))).toBe(0);
  });

  it("redondea a 2 decimales", () => {
    const from = new Date("2026-06-01T03:00:00Z");
    const rows = [order({ total: 1000 }), order({ total: 1000 }), order({ total: 1001 })];
    expect(averageTicket(rows, from)).toBe(1000.33);
  });
});

describe("topProducts", () => {
  const item = (over: Partial<DashboardOrderItemRow> = {}): DashboardOrderItemRow => ({
    productNameSnapshot: "Labial Mate",
    variantNameSnapshot: "Rojo",
    qty: 1,
    ...over,
  });

  it("suma qty por nombre de producto+variante y ordena desc", () => {
    const rows = [
      item({ productNameSnapshot: "Labial Mate", variantNameSnapshot: "Rojo", qty: 2 }),
      item({ productNameSnapshot: "Labial Mate", variantNameSnapshot: "Rojo", qty: 3 }),
      item({ productNameSnapshot: "Rubor", variantNameSnapshot: null, qty: 10 }),
    ];
    const top = topProducts(rows, 5);
    expect(top[0]).toEqual({ label: "Rubor", qty: 10 });
    expect(top[1]).toEqual({ label: "Labial Mate — Rojo", qty: 5 });
  });

  it("respeta el límite", () => {
    const rows = [
      item({ productNameSnapshot: "A", variantNameSnapshot: null, qty: 3 }),
      item({ productNameSnapshot: "B", variantNameSnapshot: null, qty: 2 }),
      item({ productNameSnapshot: "C", variantNameSnapshot: null, qty: 1 }),
    ];
    expect(topProducts(rows, 2)).toHaveLength(2);
  });
});

describe("criticalStock", () => {
  const variant = (over: Partial<DashboardVariantRow> = {}): DashboardVariantRow => ({
    id: "v1",
    productName: "Labial Mate",
    variantName: "Rojo",
    sku: "LAB-0001",
    stock: 1,
    lowStockThreshold: 3,
    ...over,
  });

  it("incluye variantes con stock <= umbral, ordenadas por stock asc", () => {
    const rows = [
      variant({ id: "a", stock: 3, lowStockThreshold: 3 }),
      variant({ id: "b", stock: 0, lowStockThreshold: 3 }),
      variant({ id: "c", stock: 5, lowStockThreshold: 3 }), // fuera (5 > 3)
    ];
    const crit = criticalStock(rows);
    expect(crit.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("vacío cuando todo está por encima del umbral", () => {
    expect(criticalStock([variant({ stock: 10, lowStockThreshold: 3 })])).toEqual([]);
  });
});
```
- [ ] **Step 2: Correr el test (debe fallar)**
  - Run: `pnpm test -- tests/unit/admin/dashboard-stats.test.ts`
  - Expected: FAIL — `Cannot find module '@/lib/admin/dashboard/stats'`.
- [ ] **Step 3: Implementar `stats.ts`** — crear `src/lib/admin/dashboard/stats.ts`:
```ts
import type { OrderStatus } from "@prisma/client";
import { toNumber } from "@/lib/catalog/pricing";
import { round2 } from "@/lib/money";
import { startOfDayART, startOfWeekART, startOfMonthART } from "@/lib/admin/dashboard/dates";

/** Estados que ya alcanzaron pago (cuentan como venta). */
export const PAID_PLUS_STATUSES: OrderStatus[] = ["paid", "preparing", "shipped", "delivered"];

function isPaidPlus(status: OrderStatus): boolean {
  return PAID_PLUS_STATUSES.includes(status);
}

/** Fila mínima de pedido para las agregaciones. */
export interface DashboardOrderRow {
  total: number | string;
  status: OrderStatus;
  createdAt: Date;
}

/** Fila mínima de ítem de pedido (snapshots). */
export interface DashboardOrderItemRow {
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  qty: number;
}

/** Fila mínima de variante para stock crítico. */
export interface DashboardVariantRow {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
}

export interface SalesBuckets {
  today: number;
  week: number;
  month: number;
}

export interface PendingActions {
  toPrepare: number;
  toDispatch: number;
}

export interface TopProduct {
  label: string;
  qty: number;
}

export interface CriticalStockEntry {
  id: string;
  label: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
}

/** Suma `total` de pedidos paid+ con `createdAt >= from`. */
export function sumSalesInRange(rows: DashboardOrderRow[], from: Date): number {
  let sum = 0;
  for (const r of rows) {
    if (isPaidPlus(r.status) && r.createdAt.getTime() >= from.getTime()) {
      sum += toNumber(r.total);
    }
  }
  return round2(sum);
}

/** Ventas de hoy / semana / mes (ART) a partir de un único set de pedidos. */
export function computeSalesBuckets(rows: DashboardOrderRow[], now: Date): SalesBuckets {
  return {
    today: sumSalesInRange(rows, startOfDayART(now)),
    week: sumSalesInRange(rows, startOfWeekART(now)),
    month: sumSalesInRange(rows, startOfMonthART(now)),
  };
}

/** Conteo de pedidos pendientes de acción: paid (a preparar) y preparing (a despachar). */
export function countPendingActions(rows: DashboardOrderRow[]): PendingActions {
  let toPrepare = 0;
  let toDispatch = 0;
  for (const r of rows) {
    if (r.status === "paid") toPrepare += 1;
    else if (r.status === "preparing") toDispatch += 1;
  }
  return { toPrepare, toDispatch };
}

/** Ticket promedio: promedio de `total` de pedidos paid+ con `createdAt >= from`. */
export function averageTicket(rows: DashboardOrderRow[], from: Date): number {
  let sum = 0;
  let count = 0;
  for (const r of rows) {
    if (isPaidPlus(r.status) && r.createdAt.getTime() >= from.getTime()) {
      sum += toNumber(r.total);
      count += 1;
    }
  }
  if (count === 0) return 0;
  return round2(sum / count);
}

/** Top productos por qty vendida (nombre producto + variante), orden desc, limitado. */
export function topProducts(items: DashboardOrderItemRow[], limit: number): TopProduct[] {
  const byLabel = new Map<string, number>();
  for (const it of items) {
    const label = it.variantNameSnapshot
      ? `${it.productNameSnapshot} — ${it.variantNameSnapshot}`
      : it.productNameSnapshot;
    byLabel.set(label, (byLabel.get(label) ?? 0) + it.qty);
  }
  return [...byLabel.entries()]
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

/** Variantes con stock crítico (stock <= umbral), ordenadas por stock ascendente. */
export function criticalStock(rows: DashboardVariantRow[]): CriticalStockEntry[] {
  return rows
    .filter((r) => r.stock <= r.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock)
    .map((r) => ({
      id: r.id,
      label: r.variantName ? `${r.productName} — ${r.variantName}` : r.productName,
      sku: r.sku,
      stock: r.stock,
      lowStockThreshold: r.lowStockThreshold,
    }));
}
```
- [ ] **Step 4: Correr el test (debe pasar)**
  - Run: `pnpm test -- tests/unit/admin/dashboard-stats.test.ts`
  - Expected: PASS (todas las suites verdes).
- [ ] **Step 5: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes.
- [ ] **Step 6: Commit**
  - Run: `git add src/lib/admin/dashboard/stats.ts tests/unit/admin/dashboard-stats.test.ts`
  - Run:
```
git commit -m "$(cat <<'EOF'
feat(m3): agregaciones puras del dashboard (ventas, pendientes, ticket, top, stock)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task DASHBOARD-3: Queries Prisma que alimentan las puras

**Files**
- Create: `src/lib/admin/dashboard/queries.ts`

> Sin test propio: es I/O fino sobre Prisma que delega toda la lógica a las funciones puras ya testeadas. La verificación es `pnpm typecheck`.

- [ ] **Step 1: Implementar `queries.ts`** — crear `src/lib/admin/dashboard/queries.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { startOfMonthART } from "@/lib/admin/dashboard/dates";
import {
  PAID_PLUS_STATUSES,
  computeSalesBuckets,
  countPendingActions,
  averageTicket,
  topProducts,
  criticalStock,
  type DashboardOrderRow,
  type DashboardOrderItemRow,
  type DashboardVariantRow,
  type SalesBuckets,
  type PendingActions,
  type TopProduct,
  type CriticalStockEntry,
} from "@/lib/admin/dashboard/stats";

export interface DashboardData {
  sales: SalesBuckets;
  pending: PendingActions;
  averageTicketMonth: number;
  topProductsMonth: TopProduct[];
  criticalStock: CriticalStockEntry[];
}

const TOP_PRODUCTS_LIMIT = 5;
const CRITICAL_STOCK_LIMIT = 20;

/** Reúne todos los datos del dashboard. `now` permite testear/forzar el instante de referencia. */
export async function getDashboardData(now: Date = new Date()): Promise<DashboardData> {
  const monthStart = startOfMonthART(now);

  // Pedidos del mes en curso (cubre hoy/semana/mes: todos los buckets caen dentro del mes ART).
  const monthOrders = await prisma.order.findMany({
    where: { createdAt: { gte: monthStart } },
    select: { total: true, status: true, createdAt: true },
  });
  const orderRows: DashboardOrderRow[] = monthOrders.map((o) => ({
    total: toNumber(o.total),
    status: o.status,
    createdAt: o.createdAt,
  }));

  // Pendientes de acción: estado puntual, no acotado por fecha.
  const pendingOrders = await prisma.order.findMany({
    where: { status: { in: ["paid", "preparing"] } },
    select: { total: true, status: true, createdAt: true },
  });
  const pendingRows: DashboardOrderRow[] = pendingOrders.map((o) => ({
    total: toNumber(o.total),
    status: o.status,
    createdAt: o.createdAt,
  }));

  // Ítems de pedidos paid+ del mes, para top productos.
  const items = await prisma.orderItem.findMany({
    where: {
      order: { status: { in: PAID_PLUS_STATUSES }, createdAt: { gte: monthStart } },
    },
    select: { productNameSnapshot: true, variantNameSnapshot: true, qty: true },
  });
  const itemRows: DashboardOrderItemRow[] = items.map((i) => ({
    productNameSnapshot: i.productNameSnapshot,
    variantNameSnapshot: i.variantNameSnapshot,
    qty: i.qty,
  }));

  // Variantes activas con stock crítico (stock <= umbral), filtrado fino en SQL.
  const variants = await prisma.productVariant.findMany({
    where: { active: true, product: { deletedAt: null, active: true } },
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      lowStockThreshold: true,
      product: { select: { name: true } },
    },
  });
  const variantRows: DashboardVariantRow[] = variants.map((v) => ({
    id: v.id,
    productName: v.product.name,
    variantName: v.name,
    sku: v.sku,
    stock: v.stock,
    lowStockThreshold: v.lowStockThreshold,
  }));

  return {
    sales: computeSalesBuckets(orderRows, now),
    pending: countPendingActions(pendingRows),
    averageTicketMonth: averageTicket(orderRows, monthStart),
    topProductsMonth: topProducts(itemRows, TOP_PRODUCTS_LIMIT),
    criticalStock: criticalStock(variantRows).slice(0, CRITICAL_STOCK_LIMIT),
  };
}
```
- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (sin errores; los `select` de Prisma coinciden con el schema).
- [ ] **Step 3: Commit**
  - Run: `git add src/lib/admin/dashboard/queries.ts`
  - Run:
```
git commit -m "$(cat <<'EOF'
feat(m3): queries Prisma del dashboard alimentando las puras

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task DASHBOARD-4: Componente `StatCard` (UI)

**Files**
- Create: `src/components/admin/stat-card.tsx`

> Componente de presentación, sin lógica → verificación por `pnpm typecheck`.

- [ ] **Step 1: Implementar `stat-card.tsx`** — crear `src/components/admin/stat-card.tsx`:
```tsx
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  /** Título corto, ej. "Ventas de hoy". */
  title: string;
  /** Valor grande, ya formateado (ej. "$ 12.500,00" o "3"). */
  value: string;
  /** Línea de ayuda en lenguaje simple. */
  hint?: string;
  /** Ícono Lucide (sin emojis). */
  icon: LucideIcon;
  className?: string;
}

/** Card de número grande para el dashboard de la dueña. */
export function StatCard({ title, value, hint, icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex items-start gap-4 p-5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="font-display text-2xl font-semibold leading-tight text-foreground">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
```
- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: la card muestra ícono Lucide + título + número grande, fondo rosa suave (`bg-primary/10`), touch target del ícono 44px (`size-11`).
- [ ] **Step 3: Commit**
  - Run: `git add src/components/admin/stat-card.tsx`
  - Run:
```
git commit -m "$(cat <<'EOF'
feat(m3): componente StatCard para el dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task DASHBOARD-5: Página del dashboard (`/admin`, Server Component)

**Files**
- Create: `src/app/admin/(panel)/page.tsx`

> Server Component que hace el fetch (`getDashboardData`) y renderiza cards + listas con empty states guiados. Verificación por `pnpm typecheck`. `requireAdmin` lo aplica `(panel)/layout.tsx` (AUTH).

- [ ] **Step 1: Implementar la página** — crear `src/app/admin/(panel)/page.tsx`:
```tsx
import Link from "next/link";
import {
  DollarSign,
  CalendarRange,
  CalendarDays,
  PackageCheck,
  Truck,
  Receipt,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardData } from "@/lib/admin/dashboard/queries";
import { formatARS } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inicio"
        subtitle="Un vistazo rápido a tus ventas y a lo que tenés que hacer hoy."
      />

      {/* Ventas */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Ventas</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Ventas de hoy"
            value={formatARS(data.sales.today)}
            hint="Lo que vendiste desde la medianoche."
            icon={DollarSign}
          />
          <StatCard
            title="Ventas de la semana"
            value={formatARS(data.sales.week)}
            hint="Desde el lunes hasta ahora."
            icon={CalendarRange}
          />
          <StatCard
            title="Ventas del mes"
            value={formatARS(data.sales.month)}
            hint="Desde el día 1 del mes."
            icon={CalendarDays}
          />
        </div>
      </section>

      {/* Pendientes + ticket */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Para hacer</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Pedidos a preparar"
            value={String(data.pending.toPrepare)}
            hint="Ya pagados, esperando que los armes."
            icon={PackageCheck}
          />
          <StatCard
            title="Pedidos a despachar"
            value={String(data.pending.toDispatch)}
            hint="Armados, listos para enviar."
            icon={Truck}
          />
          <StatCard
            title="Ticket promedio (mes)"
            value={formatARS(data.averageTicketMonth)}
            hint="Cuánto gasta en promedio cada clienta."
            icon={Receipt}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top productos */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <TrendingUp className="size-5 text-primary" aria-hidden />
            Más vendidos del mes
          </h2>
          <Card>
            <CardContent className="p-0">
              {data.topProductsMonth.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Todavía no hay ventas este mes. Cuando vendas, acá vas a ver tus productos más pedidos.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.topProductsMonth.map((p) => (
                    <li key={p.label} className="flex items-center justify-between gap-4 px-5 py-3">
                      <span className="min-w-0 truncate text-sm">{p.label}</span>
                      <span className="shrink-0 text-sm font-semibold">{p.qty} u.</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Stock crítico */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <AlertTriangle className="size-5 text-primary" aria-hidden />
            Stock bajo
          </h2>
          <Card>
            <CardContent className="p-0">
              {data.criticalStock.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Todo en orden: ningún producto está por debajo de su stock mínimo.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.criticalStock.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <Link
                        href="/admin/productos"
                        className="min-w-0 truncate text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {v.label}
                        <span className="ml-2 text-xs text-muted-foreground">{v.sku}</span>
                      </Link>
                      <span className="shrink-0 text-sm font-semibold text-destructive">
                        {v.stock} en stock
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
```
- [ ] **Step 2: Typecheck**
  - Run: `pnpm typecheck`
  - Expected: passes (los íconos existen en `lucide-react`; `PageHeader` viene de FOUNDATIONS).
  - Verify in app: con `pnpm dev`, entrar a `/admin` (logueada como admin) muestra las 6 cards de números grandes + listas de más vendidos y stock bajo; con datos vacíos aparecen los empty states guiados en español simple.
- [ ] **Step 3: Commit**
  - Run: `git add src/app/admin/\(panel\)/page.tsx`
  - Run:
```
git commit -m "$(cat <<'EOF'
feat(m3): página del dashboard /admin (Server Component, cards y empty states)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```


---


## ORDERS — Pedidos y Envíos (cambio de estado, cancelación + reposición de stock, tracking)

Gestión de pedidos para la dueña: lista con chips de estado y búsqueda, detalle con snapshots (items, contacto, dirección, envío, pagos MP), cambio de estado guiado por la máquina de estados, cancelación con reposición de stock dentro de la transacción, y carga de tracking (upsert de `Shipment`) que mueve el pedido a `shipped`.

Depende de FOUNDATIONS/AUTH (`requireAdmin` de `@/lib/admin/auth`, `AdminResult` de `@/lib/admin/result`, `PageHeader`, `ConfirmDialog`, primitivos `Badge`/`Table` de shadcn) y `Button`/`cn` existentes. No redefinir nada de eso. Reusa `canTransition` (`@/lib/orders/state-machine`), `computeStockDecrements` (`@/lib/orders/stock`), `round2`/`formatARS` (`@/lib/money`), `toNumber` (`@/lib/catalog/pricing`).

**Files**
- Create: `src/lib/admin/orders/service.ts` — `changeOrderStatus`, `cancelOrder` (+ deps).
- Create: `src/lib/admin/shipments/service.ts` — `upsertShipment` (+ deps).
- Create: `tests/integration/admin/orders-service.test.ts`.
- Create: `tests/integration/admin/shipments-service.test.ts`.
- Create: `src/app/admin/(panel)/pedidos/page.tsx` — lista (Server Component) con chips + búsqueda.
- Create: `src/app/admin/(panel)/pedidos/[id]/page.tsx` — detalle (Server Component).
- Create: `src/app/admin/(panel)/pedidos/order-status-control.tsx` — `"use client"`.
- Create: `src/app/admin/(panel)/pedidos/shipment-form.tsx` — `"use client"`.
- Create: `src/app/admin/(panel)/pedidos/actions.ts` — server actions (`requireAdmin`).
- Test: `tests/integration/admin/orders-service.test.ts`, `tests/integration/admin/shipments-service.test.ts`.

---

### Task ORDERS-1: Servicio de pedidos — `changeOrderStatus` con guard de transición (TDD)

**Files**
- Create: `src/lib/admin/orders/service.ts`
- Create: `tests/integration/admin/orders-service.test.ts`

- [ ] **Step 1: Escribir el test de la guard de transición (rojo)**. Crear `tests/integration/admin/orders-service.test.ts` con la primera suite. El fake `db` se construye con `vi.fn()` y `$transaction: vi.fn(async (fn) => fn(tx))`, igual que `tests/integration/checkout-service.test.ts`.

```ts
import { describe, it, expect, vi } from "vitest";
import { changeOrderStatus, cancelOrder, type OrdersDeps, type AdminOrder } from "@/lib/admin/orders/service";

const variantOrder = (over: Partial<AdminOrder> = {}): AdminOrder => ({
  id: "ord-1",
  status: "paid",
  couponId: null,
  items: [
    { id: "oi-1", variantId: "v1", comboId: null, qty: 2, combo: null },
  ],
  ...over,
});

function makeDeps(order: AdminOrder | null) {
  const tx = {
    order: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
    productVariant: { update: vi.fn(async () => ({})) },
  };
  const deps: OrdersDeps = {
    db: {
      order: { findUnique: vi.fn(async () => order) },
      $transaction: vi.fn(async (fn) => fn(tx as never)),
    } as never,
    now: new Date("2026-06-05T12:00:00Z"),
  };
  return { deps, tx };
}

describe("changeOrderStatus", () => {
  it("aplica una transición válida (paid → preparing)", async () => {
    const { deps, tx } = makeDeps(variantOrder({ status: "paid" }));
    const r = await changeOrderStatus("ord-1", "preparing", deps);
    expect(r.id).toBe("ord-1");
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "ord-1" }, data: { status: "preparing" } });
  });

  it("rechaza una transición inválida (delivered → preparing) con error claro", async () => {
    const { deps } = makeDeps(variantOrder({ status: "delivered" }));
    await expect(changeOrderStatus("ord-1", "preparing", deps)).rejects.toThrow(/no se puede pasar/i);
  });

  it("rechaza si el pedido no existe", async () => {
    const { deps } = makeDeps(null);
    await expect(changeOrderStatus("ord-x", "paid", deps)).rejects.toThrow(/no existe/i);
  });
});
```

- [ ] **Step 2: Correr el test (rojo)**.
  - Run: `pnpm test -- tests/integration/admin/orders-service.test.ts`
  - Expected: FAIL — `Cannot find module "@/lib/admin/orders/service"` (el archivo aún no existe).

- [ ] **Step 3: Implementar `src/lib/admin/orders/service.ts`**. Mirroreá el seam deps de `@/lib/orders/checkout-service` y reusá `canTransition`, `computeStockDecrements`, y la misma conversión `orderItem → CartLine` que el webhook (combo expandido a componentes).

```ts
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { canTransition } from "@/lib/orders/state-machine";
import { computeStockDecrements } from "@/lib/orders/stock";
import type { CartLine } from "@/lib/cart/types";
import type { OrderStatus } from "@prisma/client";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

/** Item mínimo del pedido para recomputar stock (combo expandido a componentes). */
export interface AdminOrderItem {
  id: string;
  variantId: string | null;
  comboId: string | null;
  qty: number;
  combo: { items: Array<{ variantId: string; qty: number }> } | null;
}
/** Superficie mínima del pedido que el servicio necesita. */
export interface AdminOrder {
  id: string;
  status: OrderStatus;
  couponId: string | null;
  items: AdminOrderItem[];
}

/** Superficie mínima de DB (para inyectar fakes en tests). */
export interface OrdersDb {
  order: { findUnique: (args: { where: { id: string }; include?: unknown }) => Promise<AdminOrder | null> };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}
export interface OrdersDeps {
  db: OrdersDb;
  now?: Date;
}
export function defaultOrdersDeps(): OrdersDeps {
  return { db: prisma as unknown as OrdersDb };
}

/** include para cargar el pedido con lo necesario para restock. */
const orderInclude = { items: { include: { combo: { include: { items: true } } } } } as const;

/** Convierte un OrderItem a CartLine para computar decrementos/incrementos de stock. */
function orderItemToLine(it: AdminOrderItem): CartLine {
  if (it.comboId && it.combo) {
    return { id: it.id, kind: "combo", refId: it.comboId, unitPrice: 0, qty: it.qty, weightGr: 0, components: it.combo.items.map((ci) => ({ variantId: ci.variantId, qty: ci.qty })) };
  }
  return { id: it.id, kind: "variant", refId: it.variantId ?? "", unitPrice: 0, qty: it.qty, weightGr: 0 };
}

/** Cambia el estado del pedido validando la transición (blueprint 04 §3). Lanza con mensaje claro si es inválida. */
export async function changeOrderStatus(orderId: string, to: OrderStatus, deps: OrdersDeps): Promise<{ id: string }> {
  const order = await deps.db.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw new Error("El pedido no existe.");
  if (order.status === to) return { id: order.id };
  if (!canTransition(order.status, to)) {
    throw new Error(`No se puede pasar de "${STATUS_LABELS[order.status]}" a "${STATUS_LABELS[to]}".`);
  }
  await deps.db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: to } });
  });
  return { id: order.id };
}

/**
 * Cancela el pedido. Si el estado previo descontó stock (paid/preparing/shipped),
 * repone el stock de las variantes/combos en la misma transacción.
 */
export async function cancelOrder(orderId: string, deps: OrdersDeps): Promise<{ id: string }> {
  const order = await deps.db.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw new Error("El pedido no existe.");
  if (order.status === "cancelled") return { id: order.id };
  if (!canTransition(order.status, "cancelled")) {
    throw new Error(`No se puede cancelar un pedido en estado "${STATUS_LABELS[order.status]}".`);
  }
  const shouldRestock = order.status === "paid" || order.status === "preparing" || order.status === "shipped";
  await deps.db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    if (shouldRestock) {
      const decrements = computeStockDecrements(order.items.map(orderItemToLine));
      for (const [variantId, qty] of decrements) {
        if (variantId && qty > 0) {
          await tx.productVariant.update({ where: { id: variantId }, data: { stock: { increment: qty } } });
        }
      }
    }
  });
  return { id: order.id };
}

export { STATUS_LABELS };
```

- [ ] **Step 4: Correr el test (verde)**.
  - Run: `pnpm test -- tests/integration/admin/orders-service.test.ts`
  - Expected: PASS (las 3 specs de `changeOrderStatus`).

- [ ] **Step 5: Typecheck**.
  - Run: `pnpm typecheck`
  - Expected: passes.

- [ ] **Step 6: Commit**.
  - Run:
    ```
    git add src/lib/admin/orders/service.ts tests/integration/admin/orders-service.test.ts
    git commit -m "$(cat <<'EOF'
test(m3): changeOrderStatus con guard de transición + servicio de pedidos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task ORDERS-2: Cancelación con reposición de stock (TDD)

**Files**
- Modify: `tests/integration/admin/orders-service.test.ts`
- Modify: `src/lib/admin/orders/service.ts` (ya implementado en ORDERS-1; acá solo se cubre con tests)

- [ ] **Step 1: Agregar el test de restock-on-cancel (rojo si `cancelOrder` no repusiera)**. Anexar al final de `tests/integration/admin/orders-service.test.ts` (antes del cierre del archivo, después del `describe("changeOrderStatus", …)`).

```ts
describe("cancelOrder", () => {
  it("repone stock de variantes y componentes de combo al cancelar un pedido pagado", async () => {
    const order: AdminOrder = {
      id: "ord-2",
      status: "paid",
      couponId: null,
      items: [
        { id: "oi-1", variantId: "v1", comboId: null, qty: 2, combo: null },
        { id: "oi-2", variantId: null, comboId: "cmb-1", qty: 1, combo: { items: [{ variantId: "v2", qty: 3 }, { variantId: "v1", qty: 1 }] } },
      ],
    };
    const tx = {
      order: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
      productVariant: { update: vi.fn(async () => ({})) },
    };
    const deps: OrdersDeps = {
      db: { order: { findUnique: vi.fn(async () => order) }, $transaction: vi.fn(async (fn) => fn(tx as never)) } as never,
    };
    const r = await cancelOrder("ord-2", deps);
    expect(r.id).toBe("ord-2");
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "ord-2" }, data: { status: "cancelled" } });
    // v1: 2 (línea) + 1 (combo×1) = 3 ; v2: 3 (combo×1) = 3
    expect(tx.productVariant.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { stock: { increment: 3 } } });
    expect(tx.productVariant.update).toHaveBeenCalledWith({ where: { id: "v2" }, data: { stock: { increment: 3 } } });
    expect(tx.productVariant.update).toHaveBeenCalledTimes(2);
  });

  it("NO repone stock si el pedido estaba en pending_payment (stock nunca descontado)", async () => {
    const order: AdminOrder = {
      id: "ord-3", status: "pending_payment", couponId: null,
      items: [{ id: "oi-1", variantId: "v1", comboId: null, qty: 2, combo: null }],
    };
    const tx = {
      order: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
      productVariant: { update: vi.fn(async () => ({})) },
    };
    const deps: OrdersDeps = {
      db: { order: { findUnique: vi.fn(async () => order) }, $transaction: vi.fn(async (fn) => fn(tx as never)) } as never,
    };
    await cancelOrder("ord-3", deps);
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "ord-3" }, data: { status: "cancelled" } });
    expect(tx.productVariant.update).not.toHaveBeenCalled();
  });

  it("rechaza cancelar un pedido ya entregado", async () => {
    const order: AdminOrder = {
      id: "ord-4", status: "delivered", couponId: null,
      items: [{ id: "oi-1", variantId: "v1", comboId: null, qty: 1, combo: null }],
    };
    const deps: OrdersDeps = {
      db: { order: { findUnique: vi.fn(async () => order) }, $transaction: vi.fn(async (fn) => fn({} as never)) } as never,
    };
    await expect(cancelOrder("ord-4", deps)).rejects.toThrow(/no se puede cancelar/i);
  });
});
```

- [ ] **Step 2: Correr el test (verde — la implementación de ORDERS-1 ya lo cubre)**.
  - Run: `pnpm test -- tests/integration/admin/orders-service.test.ts`
  - Expected: PASS (specs de `changeOrderStatus` + las 3 nuevas de `cancelOrder`).

- [ ] **Step 3: Typecheck**.
  - Run: `pnpm typecheck`
  - Expected: passes.

- [ ] **Step 4: Commit**.
  - Run:
    ```
    git add tests/integration/admin/orders-service.test.ts
    git commit -m "$(cat <<'EOF'
test(m3): cancelOrder repone stock (variantes + combos) y respeta el guard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task ORDERS-3: Servicio de envíos — `upsertShipment` mueve el pedido a `shipped` (TDD)

**Files**
- Create: `src/lib/admin/shipments/service.ts`
- Create: `tests/integration/admin/shipments-service.test.ts`

- [ ] **Step 1: Escribir el test (rojo)**. Crear `tests/integration/admin/shipments-service.test.ts`.

```ts
import { describe, it, expect, vi } from "vitest";
import { upsertShipment, type ShipmentsDeps, type ShipmentInput } from "@/lib/admin/shipments/service";

const baseInput: ShipmentInput = {
  service: "Clásico",
  trackingNumber: "CA123456789AR",
  labelUrl: null,
  cost: 2500,
  status: "dispatched",
};

function makeDeps(over: { orderStatus?: string; existingShipment?: { id: string } | null } = {}) {
  const tx = {
    shipment: {
      findUnique: vi.fn(async () => over.existingShipment ?? null),
      create: vi.fn(async ({ data }: { data: unknown }) => ({ id: "shp-1", ...(data as object) })),
      update: vi.fn(async () => ({ id: "shp-1" })),
    },
    order: { update: vi.fn(async () => ({})) },
  };
  const deps: ShipmentsDeps = {
    db: {
      order: { findUnique: vi.fn(async () => ({ id: "ord-1", status: over.orderStatus ?? "preparing" })) },
      $transaction: vi.fn(async (fn) => fn(tx as never)),
    } as never,
  };
  return { deps, tx };
}

describe("upsertShipment", () => {
  it("crea el shipment y, con tracking, mueve el pedido a shipped (desde preparing)", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "preparing", existingShipment: null });
    const r = await upsertShipment("ord-1", baseInput, deps);
    expect(r.id).toBe("ord-1");
    expect(tx.shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: "ord-1", carrier: "correo_argentino", trackingNumber: "CA123456789AR", cost: 2500 }) }),
    );
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "ord-1" }, data: { status: "shipped" } });
  });

  it("actualiza el shipment existente (upsert) sin duplicar", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "shipped", existingShipment: { id: "shp-1" } });
    await upsertShipment("ord-1", baseInput, deps);
    expect(tx.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: "ord-1" }, data: expect.objectContaining({ trackingNumber: "CA123456789AR" }) }),
    );
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });

  it("sin trackingNumber NO mueve el pedido a shipped", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "preparing", existingShipment: null });
    await upsertShipment("ord-1", { ...baseInput, trackingNumber: null }, deps);
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("no mueve a shipped si la transición no es válida (pedido pending_payment)", async () => {
    const { deps, tx } = makeDeps({ orderStatus: "pending_payment", existingShipment: null });
    await upsertShipment("ord-1", baseInput, deps);
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("rechaza si el pedido no existe", async () => {
    const deps: ShipmentsDeps = {
      db: { order: { findUnique: vi.fn(async () => null) }, $transaction: vi.fn(async (fn) => fn({} as never)) } as never,
    };
    await expect(upsertShipment("ord-x", baseInput, deps)).rejects.toThrow(/no existe/i);
  });
});
```

- [ ] **Step 2: Correr el test (rojo)**.
  - Run: `pnpm test -- tests/integration/admin/shipments-service.test.ts`
  - Expected: FAIL — `Cannot find module "@/lib/admin/shipments/service"`.

- [ ] **Step 3: Implementar `src/lib/admin/shipments/service.ts`**. Carga el pedido, hace upsert manual (find → create/update) y, si hay `trackingNumber` y la transición `current → shipped` es válida, mueve el pedido.

```ts
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { canTransition } from "@/lib/orders/state-machine";
import type { ShipmentStatus, ShipmentCarrier, OrderStatus } from "@prisma/client";

/** Datos de envío que carga la admin en el detalle del pedido. */
export interface ShipmentInput {
  service: string | null;
  trackingNumber: string | null;
  labelUrl: string | null;
  cost: number;
  status: ShipmentStatus;
  carrier?: ShipmentCarrier;
}

export interface ShipmentsDb {
  order: { findUnique: (args: { where: { id: string } }) => Promise<{ id: string; status: OrderStatus } | null> };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}
export interface ShipmentsDeps {
  db: ShipmentsDb;
  now?: Date;
}
export function defaultShipmentsDeps(): ShipmentsDeps {
  return { db: prisma as unknown as ShipmentsDb };
}

/**
 * Crea o actualiza el Shipment del pedido (Order 0..1 Shipment, orderId @unique).
 * Si se carga trackingNumber y la transición a `shipped` es válida, mueve el pedido a `shipped`.
 * Todo dentro de una misma transacción.
 */
export async function upsertShipment(orderId: string, input: ShipmentInput, deps: ShipmentsDeps): Promise<{ id: string }> {
  const order = await deps.db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("El pedido no existe.");

  const data = {
    carrier: input.carrier ?? ("correo_argentino" as ShipmentCarrier),
    service: input.service,
    trackingNumber: input.trackingNumber,
    labelUrl: input.labelUrl,
    cost: input.cost,
    status: input.status,
  };

  await deps.db.$transaction(async (tx) => {
    const existing = await tx.shipment.findUnique({ where: { orderId } });
    if (existing) {
      await tx.shipment.update({ where: { orderId }, data });
    } else {
      await tx.shipment.create({ data: { orderId, ...data } });
    }
    // Cargar tracking mueve el pedido a shipped (guardado por la máquina de estados).
    if (input.trackingNumber && order.status !== "shipped" && canTransition(order.status, "shipped")) {
      await tx.order.update({ where: { id: orderId }, data: { status: "shipped" } });
    }
  });

  return { id: orderId };
}
```

- [ ] **Step 4: Correr el test (verde)**.
  - Run: `pnpm test -- tests/integration/admin/shipments-service.test.ts`
  - Expected: PASS (las 5 specs de `upsertShipment`).

- [ ] **Step 5: Typecheck**.
  - Run: `pnpm typecheck`
  - Expected: passes.

- [ ] **Step 6: Commit**.
  - Run:
    ```
    git add src/lib/admin/shipments/service.ts tests/integration/admin/shipments-service.test.ts
    git commit -m "$(cat <<'EOF'
test(m3): upsertShipment crea/actualiza envío y mueve el pedido a shipped

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task ORDERS-4: Server actions de pedidos (`requireAdmin` + revalidate)

**Files**
- Create: `src/app/admin/(panel)/pedidos/actions.ts`

- [ ] **Step 1: Implementar `src/app/admin/(panel)/pedidos/actions.ts`**. Orquesta `requireAdmin` → servicio → `revalidatePath`, devolviendo `AdminResult`, envuelto en try/catch (mismo patrón que `src/app/(storefront)/actions.ts`). Usa los servicios de ORDERS-1/2/3 con sus `default*Deps()`.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { AdminResult } from "@/lib/admin/result";
import { changeOrderStatus, cancelOrder, defaultOrdersDeps } from "@/lib/admin/orders/service";
import { upsertShipment, defaultShipmentsDeps } from "@/lib/admin/shipments/service";
import type { OrderStatus, ShipmentStatus, ShipmentCarrier } from "@prisma/client";

export async function changeOrderStatusAction(orderId: string, to: OrderStatus): Promise<AdminResult> {
  try {
    await requireAdmin();
    const r = await changeOrderStatus(orderId, to, defaultOrdersDeps());
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cambiar el estado del pedido." };
  }
}

export async function cancelOrderAction(orderId: string): Promise<AdminResult> {
  try {
    await requireAdmin();
    const r = await cancelOrder(orderId, defaultOrdersDeps());
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cancelar el pedido." };
  }
}

export interface ShipmentFormInput {
  service?: string;
  trackingNumber?: string;
  labelUrl?: string;
  cost: number;
  status: ShipmentStatus;
  carrier?: ShipmentCarrier;
}

export async function upsertShipmentAction(orderId: string, input: ShipmentFormInput): Promise<AdminResult> {
  try {
    await requireAdmin();
    const r = await upsertShipment(
      orderId,
      {
        service: input.service?.trim() ? input.service.trim() : null,
        trackingNumber: input.trackingNumber?.trim() ? input.trackingNumber.trim() : null,
        labelUrl: input.labelUrl?.trim() ? input.labelUrl.trim() : null,
        cost: input.cost,
        status: input.status,
        carrier: input.carrier,
      },
      defaultShipmentsDeps(),
    );
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el envío." };
  }
}
```

- [ ] **Step 2: Typecheck**.
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: las actions se importan desde los componentes cliente de ORDERS-6 (no hay test unitario para actions; quedan cubiertas por los servicios y el e2e).

- [ ] **Step 3: Commit**.
  - Run:
    ```
    git add "src/app/admin/(panel)/pedidos/actions.ts"
    git commit -m "$(cat <<'EOF'
feat(m3): server actions de pedidos (cambiar estado, cancelar, envío) con requireAdmin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task ORDERS-5: Lista de pedidos (Server Component) con chips de estado + búsqueda

**Files**
- Create: `src/app/admin/(panel)/pedidos/page.tsx`

- [ ] **Step 1: Implementar `src/app/admin/(panel)/pedidos/page.tsx`**. Server Component: lee `searchParams` (estado + búsqueda), consulta Prisma (filtro por `status` y `OR` por `orderNumber`/`contactName`/`contactEmail`), muestra tabla con chips de color (`Badge`) y empty state guiado. Usa `PageHeader` (FOUNDATIONS), `Table`/`Badge` (FOUNDATIONS), `formatARS`, `cn`, y `STATUS_LABELS` del servicio.

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatARS } from "@/lib/money";
import { toNumber } from "@/lib/catalog/pricing";
import { STATUS_LABELS } from "@/lib/admin/orders/service";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  preparing: "bg-sky-100 text-sky-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-rose-100 text-rose-800",
  refunded: "bg-zinc-200 text-zinc-700",
};

const FILTERS: Array<{ value: OrderStatus | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "paid", label: "Pagados" },
  { value: "preparing", label: "Preparando" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregados" },
  { value: "cancelled", label: "Cancelados" },
];

const ART_FMT = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

function isStatus(v: string | undefined): v is OrderStatus {
  return v != null && Object.prototype.hasOwnProperty.call(STATUS_LABELS, v);
}

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const estado = sp.estado;

  const orders = await prisma.order.findMany({
    where: {
      ...(isStatus(estado) ? { status: estado } : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q, mode: "insensitive" as const } },
              { contactName: { contains: q, mode: "insensitive" as const } },
              { contactEmail: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, orderNumber: true, contactName: true, total: true, status: true, createdAt: true,
      payments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos" subtitle="Mirá los pedidos, cambiá su estado y cargá el seguimiento del envío." />

      <form className="flex flex-wrap items-center gap-2" action="/admin/pedidos" method="get">
        {estado && estado !== "todos" ? <input type="hidden" name="estado" value={estado} /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por número, nombre o email"
          className="h-11 min-w-[16rem] flex-1 rounded-xl border border-border px-4 text-base"
          aria-label="Buscar pedidos"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (estado ?? "todos") === f.value;
          const href = f.value === "todos" ? "/admin/pedidos" : `/admin/pedidos?estado=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
              className={cn(
                "inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
          <p className="text-lg font-semibold text-foreground">Todavía no hay pedidos para mostrar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando entre un pedido va a aparecer acá. Probá quitar el filtro o la búsqueda.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/admin/pedidos/${o.id}`} className="font-semibold text-primary hover:underline">
                      {o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ART_FMT.format(o.createdAt)}</TableCell>
                  <TableCell>{o.contactName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatARS(toNumber(o.total))}</TableCell>
                  <TableCell>
                    <Badge className={cn("font-semibold", STATUS_CHIP[o.status])}>{STATUS_LABELS[o.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**.
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: `pnpm dev` → `/admin/pedidos` muestra la lista, los chips filtran por estado y el buscador filtra por número/nombre/email; el empty state aparece sin resultados.

- [ ] **Step 3: Commit**.
  - Run:
    ```
    git add "src/app/admin/(panel)/pedidos/page.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): lista de pedidos con chips de estado, búsqueda y empty state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task ORDERS-6: Controles cliente — `order-status-control.tsx` y `shipment-form.tsx`

**Files**
- Create: `src/app/admin/(panel)/pedidos/order-status-control.tsx`
- Create: `src/app/admin/(panel)/pedidos/shipment-form.tsx`

- [ ] **Step 1: Implementar `src/app/admin/(panel)/pedidos/order-status-control.tsx`**. Cliente: botones con los próximos estados válidos (vía `canTransition`) + botón "Cancelar pedido" envuelto en `ConfirmDialog` (FOUNDATIONS). Llama las actions de ORDERS-4 con `useTransition`.

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { canTransition } from "@/lib/orders/state-machine";
import { changeOrderStatusAction, cancelOrderAction } from "./actions";
import type { OrderStatus } from "@prisma/client";

const NEXT_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Marcar pendiente de pago",
  paid: "Marcar como pagado",
  preparing: "Pasar a preparando",
  shipped: "Marcar como enviado",
  delivered: "Marcar como entregado",
  cancelled: "Cancelar pedido",
  refunded: "Marcar reembolsado",
};

const ALL: OrderStatus[] = ["pending_payment", "paid", "preparing", "shipped", "delivered", "cancelled", "refunded"];

export function OrderStatusControl({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Próximos estados válidos, excluyendo cancelled (tiene su propio flujo con confirmación).
  const nextStates = ALL.filter((s) => s !== "cancelled" && canTransition(status, s));
  const canCancel = canTransition(status, "cancelled");

  const change = (to: OrderStatus) => {
    setError(null);
    startTransition(async () => {
      const r = await changeOrderStatusAction(orderId, to);
      if (!r.ok) setError(r.error ?? "No se pudo cambiar el estado.");
      else router.refresh();
    });
  };

  const cancel = () => {
    setError(null);
    startTransition(async () => {
      const r = await cancelOrderAction(orderId);
      if (!r.ok) setError(r.error ?? "No se pudo cancelar.");
      else router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {nextStates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este pedido no tiene próximos estados disponibles.</p>
        ) : (
          nextStates.map((s) => (
            <Button key={s} type="button" onClick={() => change(s)} disabled={pending}>
              {NEXT_LABELS[s]}
            </Button>
          ))
        )}
        {canCancel ? (
          <ConfirmDialog
            title="¿Cancelar este pedido?"
            description="Si el pedido ya estaba pagado, se va a reponer el stock de los productos. Esta acción no se puede deshacer."
            confirmLabel="Sí, cancelar pedido"
            onConfirm={cancel}
            trigger={
              <Button type="button" variant="destructive" disabled={pending}>
                Cancelar pedido
              </Button>
            }
          />
        ) : null}
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Implementar `src/app/admin/(panel)/pedidos/shipment-form.tsx`**. Cliente: form de envío (service, trackingNumber, labelUrl, cost, status) que llama `upsertShipmentAction`. Usa `Label`/`Textarea` no son necesarios; campos simples + `Button`.

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { upsertShipmentAction } from "./actions";
import type { ShipmentStatus } from "@prisma/client";

const SHIPMENT_STATES: Array<{ value: ShipmentStatus; label: string }> = [
  { value: "pending", label: "Pendiente" },
  { value: "ready", label: "Listo para despachar" },
  { value: "dispatched", label: "Despachado" },
  { value: "in_transit", label: "En camino" },
  { value: "delivered", label: "Entregado" },
  { value: "returned", label: "Devuelto" },
];

export interface ShipmentDefaults {
  service: string;
  trackingNumber: string;
  labelUrl: string;
  cost: number;
  status: ShipmentStatus;
}

export function ShipmentForm({ orderId, defaults }: { orderId: string; defaults: ShipmentDefaults }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    const fd = new FormData(e.currentTarget);
    const input = {
      service: String(fd.get("service") ?? ""),
      trackingNumber: String(fd.get("trackingNumber") ?? ""),
      labelUrl: String(fd.get("labelUrl") ?? ""),
      cost: Number(fd.get("cost") ?? 0),
      status: String(fd.get("status") ?? "pending") as ShipmentStatus,
    };
    startTransition(async () => {
      const r = await upsertShipmentAction(orderId, input);
      if (!r.ok) setError(r.error ?? "No se pudo guardar el envío.");
      else {
        setOk(true);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="service">Servicio</Label>
        <input id="service" name="service" defaultValue={defaults.service} placeholder="Clásico, Expreso…" className="h-11 rounded-xl border border-border px-4 text-base" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="trackingNumber">Número de seguimiento</Label>
        <input id="trackingNumber" name="trackingNumber" defaultValue={defaults.trackingNumber} placeholder="Ej: CA123456789AR" className="h-11 rounded-xl border border-border px-4 text-base" />
        <p className="text-xs text-muted-foreground">Al cargar el seguimiento, el pedido pasa a “Enviado”.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="labelUrl">Link de la etiqueta (opcional)</Label>
        <input id="labelUrl" name="labelUrl" type="url" defaultValue={defaults.labelUrl} placeholder="https://…" className="h-11 rounded-xl border border-border px-4 text-base" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cost">Costo del envío (ARS)</Label>
        <input id="cost" name="cost" type="number" min="0" step="0.01" defaultValue={defaults.cost} className="h-11 rounded-xl border border-border px-4 text-base tabular-nums" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="status">Estado del envío</Label>
        <select id="status" name="status" defaultValue={defaults.status} className="h-11 rounded-xl border border-border px-4 text-base">
          {SHIPMENT_STATES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm font-medium text-emerald-700">Envío guardado.</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar envío"}</Button>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck**.
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: ambos componentes se montan en el detalle (ORDERS-7); el cambio de estado refresca la página y la cancelación abre el `ConfirmDialog`.

- [ ] **Step 4: Commit**.
  - Run:
    ```
    git add "src/app/admin/(panel)/pedidos/order-status-control.tsx" "src/app/admin/(panel)/pedidos/shipment-form.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): controles cliente de pedido (cambio de estado + cancelar) y form de envío

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```

---

### Task ORDERS-7: Detalle del pedido (Server Component) — snapshots, contacto, dirección, envío y pagos MP

**Files**
- Create: `src/app/admin/(panel)/pedidos/[id]/page.tsx`

- [ ] **Step 1: Implementar `src/app/admin/(panel)/pedidos/[id]/page.tsx`**. Server Component: carga el pedido con items, payments y shipment; renderiza snapshots, dirección (`shippingAddress` Json), pagos MP y monta `OrderStatusControl` + `ShipmentForm`. `notFound()` si no existe.

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { formatARS } from "@/lib/money";
import { toNumber } from "@/lib/catalog/pricing";
import { STATUS_LABELS } from "@/lib/admin/orders/service";
import { OrderStatusControl } from "../order-status-control";
import { ShipmentForm, type ShipmentDefaults } from "../shipment-form";
import type { ShipmentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado",
  in_process: "En proceso", refunded: "Reembolsado", cancelled: "Cancelado",
};

const ART_FMT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

interface AddressSnapshot {
  cp?: string; province?: string | null; street?: string; number?: string;
  floorApt?: string | null; city?: string; notes?: string | null;
}

export default async function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      shipment: true,
    },
  });
  if (!order) notFound();

  const addr = (order.shippingAddress ?? {}) as AddressSnapshot;
  const shipmentDefaults: ShipmentDefaults = {
    service: order.shipment?.service ?? "",
    trackingNumber: order.shipment?.trackingNumber ?? "",
    labelUrl: order.shipment?.labelUrl ?? "",
    cost: order.shipment ? toNumber(order.shipment.cost) : toNumber(order.shippingCost),
    status: (order.shipment?.status ?? "pending") as ShipmentStatus,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pedido ${order.orderNumber}`}
        subtitle="Mirá el detalle, cambiá el estado del pedido y cargá el seguimiento del envío."
      />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Estado actual:</span>
        <Badge className="font-semibold">{STATUS_LABELS[order.status]}</Badge>
      </div>

      <section className="rounded-2xl border border-border p-5">
        <h2 className="mb-3 text-lg font-semibold">Cambiar estado</h2>
        <OrderStatusControl orderId={order.id} status={order.status} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border p-5">
          <h2 className="mb-3 text-lg font-semibold">Productos</h2>
          <ul className="divide-y divide-border">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{it.productNameSnapshot}</p>
                  {it.variantNameSnapshot ? <p className="text-sm text-muted-foreground">{it.variantNameSnapshot}</p> : null}
                  {it.skuSnapshot ? <p className="text-xs text-muted-foreground">SKU {it.skuSnapshot}</p> : null}
                  <p className="text-sm text-muted-foreground">{it.qty} × {formatARS(toNumber(it.unitPriceSnapshot))}</p>
                </div>
                <p className="shrink-0 tabular-nums font-semibold">{formatARS(toNumber(it.lineTotal))}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatARS(toNumber(order.subtotal))}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Envío</dt><dd className="tabular-nums">{formatARS(toNumber(order.shippingCost))}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Descuento</dt><dd className="tabular-nums">−{formatARS(toNumber(order.discountTotal))}</dd></div>
            <div className="flex justify-between border-t border-border pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatARS(toNumber(order.total))}</dd></div>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border p-5">
            <h2 className="mb-3 text-lg font-semibold">Contacto</h2>
            <p className="font-medium">{order.contactName}</p>
            <p className="text-sm text-muted-foreground">{order.contactEmail}</p>
            <p className="text-sm text-muted-foreground">{order.contactPhone}</p>
            <p className="mt-2 text-sm text-muted-foreground">Recibido: {ART_FMT.format(order.createdAt)}</p>
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h2 className="mb-3 text-lg font-semibold">Entrega</h2>
            <p className="text-sm">Método: {order.shippingMethod === "domicilio" ? "Envío a domicilio" : "Retiro en sucursal"}</p>
            {order.shippingMethod === "domicilio" ? (
              <address className="mt-1 not-italic text-sm text-muted-foreground">
                {[addr.street, addr.number].filter(Boolean).join(" ")}{addr.floorApt ? `, ${addr.floorApt}` : ""}<br />
                {[addr.city, addr.province].filter(Boolean).join(", ")} {addr.cp ? `(CP ${addr.cp})` : ""}
                {addr.notes ? <><br />Nota: {addr.notes}</> : null}
              </address>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">CP de referencia: {addr.cp ?? "—"}</p>
            )}
          </section>

          <section className="rounded-2xl border border-border p-5">
            <h2 className="mb-3 text-lg font-semibold">Pagos (Mercado Pago)</h2>
            {order.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
            ) : (
              <ul className="space-y-2">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span>{PAYMENT_LABELS[p.status] ?? p.status}{p.mpPaymentId ? ` · #${p.mpPaymentId}` : ""}</span>
                    <span className="tabular-nums font-medium">{formatARS(toNumber(p.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-border p-5">
        <h2 className="mb-3 text-lg font-semibold">Envío y seguimiento</h2>
        <ShipmentForm orderId={order.id} defaults={shipmentDefaults} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**.
  - Run: `pnpm typecheck`
  - Expected: passes.
  - Verify in app: `pnpm dev` → `/admin/pedidos/<id>` muestra items con snapshots, totales, contacto, dirección, pagos MP; el control de estado aplica transiciones válidas y cancela con confirmación; cargar tracking pasa el pedido a “Enviado”.

- [ ] **Step 3: Commit**.
  - Run:
    ```
    git add "src/app/admin/(panel)/pedidos/[id]/page.tsx"
    git commit -m "$(cat <<'EOF'
feat(m3): detalle de pedido (snapshots, contacto, dirección, pagos MP, envío)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
    ```


---


## E2E_HOUSEKEEPING — Flujo e2e DoD + seed/TODO + verificación final

Cierra M3: un test e2e Playwright que ejecuta el DoD completo (login → crear producto con variante+stock → crear cupón → abrir un pedido y cambiarle el estado), el seed de un pedido `paid` de muestra para que el e2e tenga algo que gestionar, la documentación del prerequisito e2e, la actualización de `TODO.md` con los diferidos de M3, y una tarea final de verificación total (`typecheck` + `test` + `test:e2e`).

**Depende de** (no redefinir, ya entregados por otras secciones): `scripts/create-admin.ts` y el script `admin:create` (AUTH); `pnpm db:seed` (FOUNDATIONS/seed); rutas `/admin/login`, `/admin/productos/nuevo`, `/admin/cupones/nuevo`, `/admin/pedidos`, `/admin/pedidos/[id]` (AUTH/PRODUCTS/COUPONS/ORDERS).

### Files

- **Create:** `tests/e2e/admin.spec.ts` — flujo e2e DoD de admin (Playwright).
- **Modify:** `prisma/seed.ts` — agrega `upsertE2eOrder()` (pedido `paid` de muestra idempotente por `orderNumber` fijo).
- **Modify:** `playwright.config.ts` — pasa `ADMIN_EMAIL`/`ADMIN_PASSWORD` al `webServer` (env) para que el server e2e los vea.
- **Modify:** `TODO.md` — sección "Diferidos de M3 (panel admin)".
- **Modify:** `SETUP.md` — documenta el prerequisito e2e del panel (`admin:create` + `db:seed`).
- **No tocar:** `package.json` (`test:e2e` ya existe). El script `admin:create` lo agrega la sección AUTH.

---

### Task E2E_HOUSEKEEPING-1: Seed de un pedido `paid` de muestra para el e2e

**Files:** `prisma/seed.ts` (Modify)

- [ ] **Step 1: Agregar `upsertE2eOrder()` a `prisma/seed.ts`.** Insertá esta función **justo antes** de `async function main()` (después de `upsertCombo`). Es idempotente: usa un `orderNumber` fijo (`GLM-E2E001`) como clave de upsert y recrea su único `OrderItem`. Tomá la primera variante con stock del producto del seed para snapshots reales.

```ts
// ---- M3: pedido de muestra para el e2e del panel admin (idempotente) ----

const E2E_ORDER_NUMBER = "GLM-E2E001";

async function upsertE2eOrder(): Promise<void> {
  // Variante real del seed para snapshots coherentes.
  const variant = await prisma.productVariant.findFirst({
    where: { product: { slug: "labial-mate-larga-duracion" }, stock: { gt: 0 } },
    orderBy: { order: "asc" },
    include: { product: true },
  });
  if (!variant) {
    console.warn("⚠️  Pedido e2e no creado: falta variante con stock.");
    return;
  }

  const unitPrice = Number(variant.priceOverride ?? variant.product.basePrice);
  const qty = 1;
  const subtotal = unitPrice * qty;
  const shippingCost = 2500;
  const total = subtotal + shippingCost;

  const existing = await prisma.order.findUnique({ where: { orderNumber: E2E_ORDER_NUMBER } });

  const order = existing
    ? await prisma.order.update({
        where: { orderNumber: E2E_ORDER_NUMBER },
        data: {
          contactName: "Clienta E2E",
          contactEmail: "e2e@example.com",
          contactPhone: "1100000000",
          shippingAddress: {
            recipientName: "Clienta E2E", phone: "1100000000",
            street: "Calle Falsa", number: "123", city: "CABA",
            province: "CABA", postalCode: "1414", notes: null,
          },
          shippingMethod: "domicilio",
          subtotal, shippingCost, discountTotal: 0, total,
          status: "paid",
        },
      })
    : await prisma.order.create({
        data: {
          orderNumber: E2E_ORDER_NUMBER,
          contactName: "Clienta E2E",
          contactEmail: "e2e@example.com",
          contactPhone: "1100000000",
          shippingAddress: {
            recipientName: "Clienta E2E", phone: "1100000000",
            street: "Calle Falsa", number: "123", city: "CABA",
            province: "CABA", postalCode: "1414", notes: null,
          },
          shippingMethod: "domicilio",
          subtotal, shippingCost, discountTotal: 0, total,
          status: "paid",
        },
      });

  // Recrear el único item (snapshots) de forma idempotente.
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      variantId: variant.id,
      productNameSnapshot: variant.product.name,
      variantNameSnapshot: variant.name,
      skuSnapshot: variant.sku,
      unitPriceSnapshot: unitPrice,
      qty,
      lineTotal: subtotal,
    },
  });

  // Pago aprobado de muestra (idempotente por orderId; recreamos).
  await prisma.payment.deleteMany({ where: { orderId: order.id } });
  await prisma.payment.create({
    data: { orderId: order.id, provider: "mercadopago", status: "approved", amount: total },
  });
}
```

- [ ] **Step 2: Llamar `upsertE2eOrder()` desde `main()`.** Reemplazá el bloque de `main()` que llama a los upserts y cuenta, por esta versión que agrega la llamada al pedido e2e tras `upsertCombo()`:

```ts
async function main(): Promise<void> {
  console.log("🌱 Seeding catálogo Glamify Makeup…");
  const idBySlug = await upsertCategories();
  await upsertProducts(idBySlug);
  await upsertSettings();
  await upsertZones();
  await upsertCoupons();
  await upsertCombo();
  await upsertE2eOrder();
  const [cats, prods, vars, coups, zones, orders] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.coupon.count(),
    prisma.shippingZone.count(),
    prisma.order.count(),
  ]);
  console.log(`✅ Seed listo: ${cats} categorías, ${prods} productos, ${vars} variantes, ${coups} cupones, ${zones} zonas, ${orders} pedidos.`);
}
```

- [ ] **Step 3: Verificar que el seed corre y crea el pedido.** El seed requiere `.env`/`.env.local` con `DATABASE_URL` (ver memoria "Worktree env files": en worktree la CLI de Prisma + tsx necesitan `.env`).
  - **Run:** `pnpm db:seed`
  - **Expected:** termina con `✅ Seed listo: ... pedidos.` donde el conteo de pedidos es ≥ 1 (sin error). Reejecutarlo no duplica `GLM-E2E001` (sigue siendo 1 pedido e2e).

- [ ] **Step 4: Commit.**
  - **Run:**
    ```bash
    git add prisma/seed.ts
    git commit -m "feat(m3): seed de pedido paid de muestra para e2e del panel

Pedido GLM-E2E001 idempotente (upsert por orderNumber) con item snapshot
y pago aprobado, para que el e2e del admin tenga un pedido que gestionar.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
    ```

---

### Task E2E_HOUSEKEEPING-2: Pasar credenciales de admin al webServer de Playwright

**Files:** `playwright.config.ts` (Modify)

- [ ] **Step 1: Inyectar `ADMIN_EMAIL`/`ADMIN_PASSWORD` en el `webServer`.** El test los lee de `process.env` (del proceso de Playwright) y el server e2e (`pnpm build && pnpm start`) los necesita disponibles también. Reemplazá el archivo completo por:

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
    env: {
      ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "",
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "",
    },
  },
});
```

- [ ] **Step 2: Verificar tipos.**
  - **Run:** `pnpm typecheck`
  - **Expected:** pasa sin errores.

- [ ] **Step 3: Commit.**
  - **Run:**
    ```bash
    git add playwright.config.ts
    git commit -m "chore(m3): pasar ADMIN_EMAIL/ADMIN_PASSWORD al webServer e2e

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
    ```

---

### Task E2E_HOUSEKEEPING-3: Test e2e del DoD del panel admin

**Files:** `tests/e2e/admin.spec.ts` (Create)

- [ ] **Step 1: Escribir el spec e2e del DoD.** Sigue el estilo de `tests/e2e/checkout.spec.ts` (`getByRole`, navegación directa por URL). Hace login con las credenciales de admin (de env), crea un producto con variante+stock, crea un cupón con código único por corrida, y abre el pedido seedeado (`GLM-E2E001`) para cambiarle el estado de `paid` a `preparing`. Usa un sufijo random para no colisionar slug/código entre corridas. Crear `tests/e2e/admin.spec.ts` con:

```ts
import { test, expect } from "@playwright/test";

// Credenciales del admin (creadas con `pnpm admin:create`, ver SETUP.md).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// Pedido de muestra seedeado por `pnpm db:seed` (estado `paid`).
const E2E_ORDER_NUMBER = "GLM-E2E001";

// Sufijo único por corrida para no colisionar slug de producto / código de cupón.
const RUN = Date.now().toString(36).slice(-5).toUpperCase();

test.describe("Panel admin — DoD M3", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Definí ADMIN_EMAIL y ADMIN_PASSWORD (corré `pnpm admin:create`).");

  test("login → crear producto con variante+stock → crear cupón → cambiar estado de pedido", async ({ page }) => {
    // 1) Login.
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/contraseña/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /ingresar/i }).click();

    // Tras login válido se redirige a /admin (dashboard).
    await expect(page).toHaveURL(/\/admin(\/)?$/, { timeout: 15000 });

    // 2) Crear producto con variante + stock.
    await page.goto("/admin/productos/nuevo");
    await page.getByLabel(/nombre/i).first().fill(`Producto E2E ${RUN}`);
    // Categoría: primera opción real del select.
    await page.getByLabel(/categoría/i).selectOption({ index: 1 });
    await page.getByLabel(/precio/i).first().fill("3500");
    // Variante (al menos stock; si no se nombra, el server crea "Único").
    await page.getByLabel(/stock/i).first().fill("7");

    await page.getByRole("button", { name: /guardar|crear/i }).click();

    // Volvemos a la lista de productos y vemos el nuevo producto.
    await expect(page).toHaveURL(/\/admin\/productos/, { timeout: 15000 });
    await expect(page.getByText(`Producto E2E ${RUN}`)).toBeVisible({ timeout: 15000 });

    // 3) Crear cupón.
    await page.goto("/admin/cupones/nuevo");
    const code = `E2E${RUN}`;
    await page.getByLabel(/código/i).fill(code);
    // Tipo porcentaje + valor 10.
    await page.getByLabel(/tipo/i).selectOption("percentage");
    await page.getByLabel(/valor/i).fill("10");

    await page.getByRole("button", { name: /guardar|crear/i }).click();

    await expect(page).toHaveURL(/\/admin\/cupones/, { timeout: 15000 });
    await expect(page.getByText(code)).toBeVisible({ timeout: 15000 });

    // 4) Abrir el pedido seedeado y cambiarle el estado (paid → preparing).
    await page.goto("/admin/pedidos");
    await page.getByRole("link", { name: new RegExp(E2E_ORDER_NUMBER, "i") }).click();

    // Detalle del pedido visible.
    await expect(page.getByRole("heading", { name: new RegExp(E2E_ORDER_NUMBER, "i") })).toBeVisible({ timeout: 15000 });

    // Cambiar estado a "preparing" (a preparar) y confirmar.
    await page.getByLabel(/estado del pedido|cambiar estado/i).selectOption("preparing");
    await page.getByRole("button", { name: /guardar|cambiar|actualizar/i }).click();

    // El estado nuevo se refleja en la página.
    await expect(page.getByText(/preparando|a despachar|preparing/i).first()).toBeVisible({ timeout: 15000 });
  });
});
```

- [ ] **Step 2: Verificar tipos del spec.**
  - **Run:** `pnpm typecheck`
  - **Expected:** pasa sin errores.

- [ ] **Step 3: Correr el e2e con prerequisitos.** Requiere admin creado (`pnpm admin:create`, ver SETUP.md) y datos seedeados (`pnpm db:seed`), y `ADMIN_EMAIL`/`ADMIN_PASSWORD` en el entorno.
  - **Run:** `pnpm admin:create; pnpm db:seed; pnpm test:e2e -- admin.spec.ts`
  - **Expected:** `1 passed` para `Panel admin — DoD M3`. (Si faltan credenciales, el test queda `skipped`, no falla; definir env para ejecutarlo de verdad.)

> Nota: los `getByLabel`/`getByRole`/`selectOption` deben coincidir con los labels y controles reales que entregan AUTH (login), PRODUCTS (form de producto/variante), COUPONS (form de cupón) y ORDERS (`order-status-control`). Si un selector no engancha, ajustar el `name`/`label` del test al texto exacto que renderiza esa sección (no cambiar el comportamiento de la app por el test).

- [ ] **Step 4: Commit.**
  - **Run:**
    ```bash
    git add tests/e2e/admin.spec.ts
    git commit -m "test(m3): e2e DoD del panel — login, producto, cupón, estado de pedido

Flujo completo: login admin → crear producto con variante+stock → crear
cupón → abrir pedido seedeado y cambiar su estado (paid → preparing).
Se saltea si faltan ADMIN_EMAIL/ADMIN_PASSWORD.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
    ```

---

### Task E2E_HOUSEKEEPING-4: Documentar prerequisito e2e en SETUP.md

**Files:** `SETUP.md` (Modify)

- [ ] **Step 1: Agregar sección de prerequisitos del e2e del panel.** Añadí al final de `SETUP.md` esta sección (el `admin:create` lo documenta la sección AUTH; acá se documenta el flujo e2e que lo consume):

```markdown
## E2E del panel de administración (M3)

El test `tests/e2e/admin.spec.ts` ejecuta el DoD de M3: login → crear producto
con variante+stock → crear cupón → abrir un pedido y cambiarle el estado.

Prerequisitos (una vez por entorno):

1. Crear el admin (idempotente):
   ```bash
   ADMIN_EMAIL=owner@glamify.test ADMIN_PASSWORD=una-clave-fuerte pnpm admin:create
   ```
2. Seedear catálogo + pedido de muestra (`GLM-E2E001`, estado `paid`):
   ```bash
   pnpm db:seed
   ```
3. Correr el e2e con las mismas credenciales en el entorno:
   ```bash
   ADMIN_EMAIL=owner@glamify.test ADMIN_PASSWORD=una-clave-fuerte pnpm test:e2e -- admin.spec.ts
   ```

Si `ADMIN_EMAIL`/`ADMIN_PASSWORD` no están definidas, el test se **saltea**
(no falla), para no romper CI en entornos sin admin configurado.
```

- [ ] **Step 2: Verificar (lectura).** Abrir `SETUP.md` y confirmar que la sección quedó al final, bien formateada (los bloques de código de adentro usan indentación de 3 espacios bajo cada item, como arriba). No hay test automatizado.
  - **Run:** `pnpm typecheck`
  - **Expected:** pasa (no afecta tipos; es doc).

- [ ] **Step 3: Commit.**
  - **Run:**
    ```bash
    git add SETUP.md
    git commit -m "docs(m3): documentar prerequisitos del e2e del panel admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
    ```

---

### Task E2E_HOUSEKEEPING-5: Actualizar TODO.md con diferidos de M3

**Files:** `TODO.md` (Modify)

- [ ] **Step 1: Agregar la sección de diferidos de M3.** Insertá esta sección **inmediatamente después** del encabezado y la cita de intro (antes de `## Infra / notificaciones`), para que los diferidos de M3 queden visibles arriba:

```markdown
## Diferidos de M3 (panel admin)
> Decididos fuera del scope de M3 (ver spec `docs/superpowers/specs/2026-06-05-m3-panel-admin-design.md`). No son olvidos.
- [ ] **Reseñas (moderación):** aprobar/rechazar `Review` desde el panel — política depende de blueprint 06.
- [ ] **Ajustes / Settings page:** editar `Setting` (storeName, envío gratis, CP origen, redes) desde el panel.
- [ ] **ShippingZone CRUD:** alta/edición de zonas de envío desde el panel (hoy solo por seed).
- [ ] **Import CSV de catálogo:** carga masiva de productos/variantes (hoy carga manual).
- [ ] **Notificaciones WhatsApp** al cambiar estado de pedido (hoy: sin email automático en el cambio manual; el webhook de pago ya notifica).
- [ ] **Historial de movimientos de stock** (auditoría) — hoy solo cantidad + alerta de stock crítico.
- [ ] **Duplicar producto** (acelerar alta de variantes similares).
```

- [ ] **Step 2: Verificar contenido.** Confirmar que la sección quedó tras la cita de intro y que los 7 diferidos del contrato/spec están listados (Reseñas, Ajustes/Settings, ShippingZone CRUD, Import CSV, WhatsApp, Historial de stock, Duplicar producto). No hay test automatizado.
  - **Run:** `pnpm typecheck`
  - **Expected:** pasa (es doc, no afecta tipos).

- [ ] **Step 3: Commit.**
  - **Run:**
    ```bash
    git add TODO.md
    git commit -m "docs(m3): listar diferidos de M3 en TODO

Reseñas, Ajustes/Settings, ShippingZone CRUD, import CSV, WhatsApp,
historial de stock y duplicar producto quedan para fase siguiente.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
    ```

---

### Task E2E_HOUSEKEEPING-6: Verificación final de M3

**Files:** ninguno (solo verificación; no produce cambios salvo que un check falle).

- [ ] **Step 1: Typecheck de todo el repo.**
  - **Run:** `pnpm typecheck`
  - **Expected:** pasa sin errores (TypeScript strict, sin `any`).

- [ ] **Step 2: Suite unitaria + integración completa.**
  - **Run:** `pnpm test`
  - **Expected:** todos los tests en verde (incluye `tests/unit/admin/**` y `tests/integration/admin/**` de las demás secciones, más los existentes de M1/M2).

- [ ] **Step 3: Suite e2e completa (con prerequisitos).** Requiere admin creado y datos seedeados (ver SETUP.md), con `ADMIN_EMAIL`/`ADMIN_PASSWORD` en el entorno.
  - **Run:** `pnpm admin:create; pnpm db:seed; pnpm test:e2e`
  - **Expected:** todos los specs e2e pasan — `tests/e2e/checkout.spec.ts` (M2) y `tests/e2e/admin.spec.ts` (M3, DoD). Si las credenciales de admin no están definidas, el spec del panel queda `skipped` (no falla); para validar el DoD de M3 hay que ejecutarlo con env definido y verlo en `passed`.

- [ ] **Step 4: Lint (sanity final).**
  - **Run:** `pnpm lint`
  - **Expected:** sin errores.

- [ ] **Step 5: Commit (solo si algún paso requirió un fix).** Si todos los checks pasaron sin tocar nada, no hay nada que commitear y esta tarea queda como gate de verificación. Si un check falló y lo arreglaste:
  - **Run:**
    ```bash
    git add -A
    git commit -m "fix(m3): ajustes de verificación final (typecheck/test/e2e/lint)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
    ```
