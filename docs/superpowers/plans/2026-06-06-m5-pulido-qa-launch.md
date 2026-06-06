# M5 — Pulido, QA y Launch (código) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la mitad de código de M5 — páginas legales/contenido, Botón de Arrepentimiento con constancia, WhatsApp FAB, accesibilidad WCAG AA y performance (LCP/CLS) — dejando un runbook de ops para el lanzamiento.

**Architecture:** Server Components para páginas estáticas/legales que consumen un módulo único de datos del negocio con placeholders `[COMPLETAR]`. El arrepentimiento sigue el patrón del repo: validación pura + servicio con deps inyectables (`db`/`sendEmail`) + server action + client form con honeypot, persistiendo `RetractionRequest` y notificando a la dueña. A11y/perf se auditan con un workflow multi-agente (axe/Lighthouse vía chrome-devtools sobre `pnpm dev`) y se aplican fixes verificados.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Prisma + `@prisma/adapter-pg`, Vitest, Playwright + `@axe-core/playwright`, Tailwind/shadcn, Resend, chrome-devtools MCP.

**Restricciones (memoria):** en Windows no corren `build:worker`/standalone/Playwright local (EPERM) → verificar con `pnpm typecheck` + `pnpm test` + `pnpm dev` + Lighthouse/axe vía chrome-devtools; e2e corren en CI. Prisma CLI/scripts `tsx` necesitan `.env` en worktree.

---

## Mapa de archivos

**Datos negocio / launch-readiness**
- Create `src/lib/legal/business-info.ts` — fuente única de datos del negocio (placeholders `[COMPLETAR]`).
- Create `src/lib/legal/launch-readiness.ts` — `findIncompletePlaceholders()`.
- Test `tests/unit/legal/launch-readiness.test.ts`.

**Arrepentimiento (backend)**
- Modify `prisma/schema.prisma` — enum `RetractionStatus` + model `RetractionRequest`.
- Create `prisma/migrations/<ts>_retraction_request/migration.sql` (vía `prisma migrate dev`).
- Create `src/lib/legal/retraction/ticket.ts` — `formatRetractionTicket(seq)`.
- Test `tests/unit/legal/retraction-ticket.test.ts`.
- Create `src/lib/legal/retraction/validation.ts` — `validateRetraction(input)`.
- Test `tests/unit/legal/retraction-validation.test.ts`.
- Modify `src/lib/email/templates.ts` — `retractionAlertEmail(d)`.
- Test `tests/unit/email/retraction-template.test.ts`.
- Create `src/lib/legal/retraction/service.ts` — `createRetractionRequest(input, deps)`.
- Test `tests/integration/legal/retraction-service.test.ts`.

**Arrepentimiento (frontend)**
- Create `src/app/(storefront)/arrepentimiento/actions.ts` — `requestRetractionAction`.
- Create `src/app/(storefront)/arrepentimiento/retraction-form.tsx` — client form + honeypot + constancia.
- Create `src/app/(storefront)/arrepentimiento/page.tsx` — copy del derecho + form.

**Páginas legales/contenido**
- Create `src/components/legal/prose.tsx` — wrapper tipográfico accesible.
- Create `src/app/(storefront)/terminos/page.tsx`
- Create `src/app/(storefront)/privacidad/page.tsx`
- Create `src/app/(storefront)/contacto/page.tsx`
- Create `src/app/(storefront)/nosotras/page.tsx`
- Create `src/app/(storefront)/preguntas-frecuentes/page.tsx`
- Create `src/app/(storefront)/envios-y-pagos/page.tsx`

**Footer / sitemap**
- Modify `src/components/layout/site-footer.tsx`
- Modify `src/app/sitemap.ts`

**WhatsApp FAB**
- Create `src/components/layout/whatsapp-fab.tsx`
- Modify `src/app/(storefront)/layout.tsx` (FAB + skip-link + `id="main"`)

**A11y / perf**
- Modify `src/app/globals.css` (skip-link visible-on-focus, fixes de contraste si hace falta)
- Fixes puntuales en componentes según auditoría verificada.
- Test `tests/e2e/a11y.spec.ts` (axe, CI)
- Test `tests/e2e/legal.spec.ts` (legales + footer + arrepentimiento, CI)

**Runbook**
- Create `docs/LAUNCH.md`

---

## Fase 1 — Fundaciones (datos negocio + modelo)

### Task 1: `business-info.ts` + launch-readiness (TDD)

**Files:**
- Create: `src/lib/legal/business-info.ts`
- Create: `src/lib/legal/launch-readiness.ts`
- Test: `tests/unit/legal/launch-readiness.test.ts`

- [ ] **Step 1: Write `business-info.ts`**

```ts
/** Fuente única de datos del negocio para páginas legales/contenido.
 *  Completar los [COMPLETAR] antes del launch (ver docs/LAUNCH.md). */
export const PLACEHOLDER_PREFIX = "[COMPLETAR";

export const businessInfo = {
  legalName: "[COMPLETAR: razón social o nombre y apellido del/la titular]",
  taxId: "[COMPLETAR: CUIT/CUIL]",
  taxCondition: "[COMPLETAR: condición fiscal (ej. Monotributo)]",
  address: "[COMPLETAR: domicilio comercial/legal]",
  email: "[COMPLETAR: email de contacto]",
  whatsapp: "[COMPLETAR: WhatsApp con código país, ej. +54 9 11 ...]",
  jurisdiction: "[COMPLETAR: jurisdicción (ej. Tribunales Ordinarios de la Pcia. de Buenos Aires)]",
  retractionDays: 10,
  paymentMethods: "[COMPLETAR: medios de pago aceptados (ej. Mercado Pago: tarjetas y dinero en cuenta)]",
  consumerDefenseUrl: "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario",
} as const;

export type BusinessInfo = typeof businessInfo;
```

- [ ] **Step 2: Write failing test**

```ts
// tests/unit/legal/launch-readiness.test.ts
import { describe, it, expect } from "vitest";
import { findIncompletePlaceholders } from "@/lib/legal/launch-readiness";

describe("findIncompletePlaceholders", () => {
  it("detecta valores con [COMPLETAR", () => {
    const missing = findIncompletePlaceholders({ a: "[COMPLETAR: x]", b: "ok", c: 10 });
    expect(missing).toEqual(["a"]);
  });
  it("devuelve [] cuando no hay placeholders", () => {
    expect(findIncompletePlaceholders({ a: "Glamify", b: 5 })).toEqual([]);
  });
});
```

Run: `pnpm test -- launch-readiness` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement `launch-readiness.ts`**

```ts
import { PLACEHOLDER_PREFIX, businessInfo } from "./business-info";

/** Devuelve las claves cuyo valor string aún contiene un placeholder [COMPLETAR. */
export function findIncompletePlaceholders(
  info: Record<string, unknown> = businessInfo,
): string[] {
  return Object.entries(info)
    .filter(([, v]) => typeof v === "string" && v.includes(PLACEHOLDER_PREFIX))
    .map(([k]) => k);
}
```

- [ ] **Step 4: Run test** → `pnpm test -- launch-readiness` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/legal/business-info.ts src/lib/legal/launch-readiness.ts tests/unit/legal/launch-readiness.test.ts
git commit -m "feat(m5): datos del negocio (placeholders) + launch-readiness"
```

### Task 2: Modelo `RetractionRequest` + migración

**Files:**
- Modify: `prisma/schema.prisma` (agregar enum + model al final de la sección SISTEMA)

- [ ] **Step 1: Agregar al schema** (junto a los otros enums y al final de los models):

```prisma
enum RetractionStatus {
  pending
  processed
  rejected
}

model RetractionRequest {
  id           String           @id @default(uuid()) @db.Uuid
  seq          Int              @unique @default(autoincrement())
  orderNumber  String?
  contactName  String
  contactEmail String
  contactPhone String?
  reason       String?
  status       RetractionStatus @default(pending)
  createdAt    DateTime         @default(now())

  @@index([status])
}
```

- [ ] **Step 2: Crear migración** (worktree necesita `.env`; ver memoria):

Run: `pnpm exec prisma migrate dev --name retraction_request`
Expected: crea `prisma/migrations/<ts>_retraction_request/` y regenera el client. Si no hay DB accesible, generar SQL con `prisma migrate diff` y aplicar en CI/PROD (documentar en LAUNCH.md).

- [ ] **Step 3: Verificar tipos** → `pnpm typecheck` → Expected: PASS (tipo `RetractionRequest` disponible).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(m5): modelo RetractionRequest (botón de arrepentimiento)"
```

### Task 3: `formatRetractionTicket` (TDD)

**Files:**
- Create: `src/lib/legal/retraction/ticket.ts`
- Test: `tests/unit/legal/retraction-ticket.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatRetractionTicket } from "@/lib/legal/retraction/ticket";

describe("formatRetractionTicket", () => {
  it("formatea con padding ARR-000123", () => {
    expect(formatRetractionTicket(123)).toBe("ARR-000123");
    expect(formatRetractionTicket(1)).toBe("ARR-000001");
  });
  it("rechaza secuencias inválidas", () => {
    expect(() => formatRetractionTicket(0)).toThrow();
    expect(() => formatRetractionTicket(1.5)).toThrow();
  });
});
```

Run: `pnpm test -- retraction-ticket` → FAIL.

- [ ] **Step 2: Implement**

```ts
/** Constancia humana del botón de arrepentimiento: ARR-000123. */
export function formatRetractionTicket(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Secuencia inválida: ${seq}`);
  return `ARR-${String(seq).padStart(6, "0")}`;
}
```

- [ ] **Step 3: Run** → PASS. **Step 4: Commit**

```bash
git add src/lib/legal/retraction/ticket.ts tests/unit/legal/retraction-ticket.test.ts
git commit -m "feat(m5): formatRetractionTicket"
```

---

## Fase 2 — Arrepentimiento backend

### Task 4: Validación (TDD)

**Files:**
- Create: `src/lib/legal/retraction/validation.ts`
- Test: `tests/unit/legal/retraction-validation.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { validateRetraction } from "@/lib/legal/retraction/validation";

const ok = { contactName: "Ana Pérez", contactEmail: "ana@mail.com", website: "" };

describe("validateRetraction", () => {
  it("acepta input mínimo válido", () => {
    const r = validateRetraction(ok);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.contactEmail).toBe("ana@mail.com");
  });
  it("normaliza email a minúsculas y recorta", () => {
    const r = validateRetraction({ ...ok, contactEmail: "  ANA@Mail.com " });
    expect(r.ok && r.value.contactEmail).toBe("ana@mail.com");
  });
  it("rechaza email inválido", () => {
    expect(validateRetraction({ ...ok, contactEmail: "nope" }).ok).toBe(false);
  });
  it("rechaza nombre corto", () => {
    expect(validateRetraction({ ...ok, contactName: "A" }).ok).toBe(false);
  });
  it("rechaza honeypot completo (spam)", () => {
    expect(validateRetraction({ ...ok, website: "http://spam" }).ok).toBe(false);
  });
  it("acepta opcionales y los recorta", () => {
    const r = validateRetraction({ ...ok, orderNumber: " GLM-000001 ", contactPhone: " 11 ", reason: " test " });
    expect(r.ok && r.value.orderNumber).toBe("GLM-000001");
  });
});
```

Run: `pnpm test -- retraction-validation` → FAIL.

- [ ] **Step 2: Implement**

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RetractionInput {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  orderNumber?: string;
  reason?: string;
  website?: string; // honeypot
}
export interface ValidRetraction {
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  orderNumber: string | null;
  reason: string | null;
}
export type ValidationResult =
  | { ok: true; value: ValidRetraction }
  | { ok: false; error: string };

function clean(v: string | undefined, max: number): string | null {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

export function validateRetraction(input: RetractionInput): ValidationResult {
  if ((input.website ?? "").trim() !== "") return { ok: false, error: "No se pudo procesar la solicitud." };
  const contactName = (input.contactName ?? "").trim();
  if (contactName.length < 2 || contactName.length > 80) return { ok: false, error: "Ingresá tu nombre completo." };
  const contactEmail = (input.contactEmail ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(contactEmail)) return { ok: false, error: "Ingresá un email válido." };
  return {
    ok: true,
    value: {
      contactName,
      contactEmail,
      contactPhone: clean(input.contactPhone, 40),
      orderNumber: clean(input.orderNumber, 40),
      reason: clean(input.reason, 1000),
    },
  };
}
```

- [ ] **Step 3: Run** → PASS. **Step 4: Commit**

```bash
git add src/lib/legal/retraction/validation.ts tests/unit/legal/retraction-validation.test.ts
git commit -m "feat(m5): validación de solicitud de arrepentimiento"
```

### Task 5: Email a la dueña (TDD)

**Files:**
- Modify: `src/lib/email/templates.ts` (agregar al final)
- Test: `tests/unit/email/retraction-template.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { retractionAlertEmail } from "@/lib/email/templates";

describe("retractionAlertEmail", () => {
  const d = { ticket: "ARR-000001", contactName: "Ana", contactEmail: "ana@mail.com", contactPhone: "11", orderNumber: "GLM-000009", reason: "no me gustó" };
  it("incluye constancia y datos en subject/text", () => {
    const e = retractionAlertEmail(d);
    expect(e.subject).toContain("ARR-000001");
    expect(e.text).toContain("ana@mail.com");
    expect(e.text).toContain("GLM-000009");
    expect(e.html).toContain("Ana");
  });
  it("tolera opcionales ausentes", () => {
    const e = retractionAlertEmail({ ticket: "ARR-000002", contactName: "Bea", contactEmail: "bea@mail.com" });
    expect(e.html).toContain("ARR-000002");
  });
});
```

Run: `pnpm test -- retraction-template` → FAIL.

- [ ] **Step 2: Implement (append to `templates.ts`)**

```ts
export interface RetractionEmailData {
  ticket: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  orderNumber?: string | null;
  reason?: string | null;
}

/** Alerta a la dueña: nueva solicitud de arrepentimiento (Res. 424/2020). */
export function retractionAlertEmail(d: RetractionEmailData): EmailContent {
  const subject = `📨 Solicitud de arrepentimiento ${d.ticket}`;
  const row = (k: string, v?: string | null) => (v ? `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>` : "");
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1 style="color:#FF2E93">Solicitud de arrepentimiento ${d.ticket}</h1>
    <p>Un/a consumidor/a ejerció el derecho de arrepentimiento (art. 34 Ley 24.240). Contactalo/a para coordinar la devolución y el reintegro.</p>
    <table style="width:100%;border-collapse:collapse">
      ${row("Nombre", d.contactName)}${row("Email", d.contactEmail)}${row("Teléfono", d.contactPhone)}${row("Pedido", d.orderNumber)}${row("Motivo", d.reason)}
    </table>
  </div>`;
  const text = `Solicitud de arrepentimiento ${d.ticket}\nNombre: ${d.contactName}\nEmail: ${d.contactEmail}\nTeléfono: ${d.contactPhone ?? "-"}\nPedido: ${d.orderNumber ?? "-"}\nMotivo: ${d.reason ?? "-"}`;
  return { subject, html, text };
}
```

- [ ] **Step 3: Run** → PASS. **Step 4: Commit**

```bash
git add src/lib/email/templates.ts tests/unit/email/retraction-template.test.ts
git commit -m "feat(m5): email de alerta de arrepentimiento a la dueña"
```

### Task 6: Servicio (TDD, deps inyectables)

**Files:**
- Create: `src/lib/legal/retraction/service.ts`
- Test: `tests/integration/legal/retraction-service.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createRetractionRequest } from "@/lib/legal/retraction/service";

function makeDeps(seq = 7) {
  const create = vi.fn().mockResolvedValue({ seq });
  const sendEmail = vi.fn().mockResolvedValue({ id: null, logged: true });
  return { db: { retractionRequest: { create } }, sendEmail, ownerEmail: "owner@glamify.test", create };
}

describe("createRetractionRequest", () => {
  it("rechaza input inválido sin tocar DB", async () => {
    const d = makeDeps();
    const r = await createRetractionRequest({ contactName: "A", contactEmail: "x" }, d);
    expect(r.ok).toBe(false);
    expect(d.create).not.toHaveBeenCalled();
  });
  it("crea registro, devuelve constancia y notifica a la dueña", async () => {
    const d = makeDeps(7);
    const r = await createRetractionRequest(
      { contactName: "Ana Pérez", contactEmail: "ana@mail.com", website: "" },
      d,
    );
    expect(r).toEqual({ ok: true, ticket: "ARR-000007" });
    expect(d.create).toHaveBeenCalledWith({
      data: { contactName: "Ana Pérez", contactEmail: "ana@mail.com", contactPhone: null, orderNumber: null, reason: null },
      select: { seq: true },
    });
    expect(d.sendEmail).toHaveBeenCalledOnce();
    expect(d.sendEmail.mock.calls[0][0].to).toBe("owner@glamify.test");
    expect(d.sendEmail.mock.calls[0][0].subject).toContain("ARR-000007");
  });
  it("no falla la solicitud si el email a la dueña tira error", async () => {
    const d = makeDeps(8);
    d.sendEmail.mockRejectedValueOnce(new Error("resend down"));
    const r = await createRetractionRequest({ contactName: "Ana Pérez", contactEmail: "ana@mail.com" }, d);
    expect(r.ok).toBe(true);
  });
  it("no envía email si no hay ownerEmail", async () => {
    const d = makeDeps(9);
    d.ownerEmail = "";
    await createRetractionRequest({ contactName: "Ana Pérez", contactEmail: "ana@mail.com" }, { ...d });
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm test -- retraction-service` → FAIL.

- [ ] **Step 2: Implement**

```ts
import { validateRetraction, type RetractionInput } from "./validation";
import { formatRetractionTicket } from "./ticket";
import { retractionAlertEmail } from "@/lib/email/templates";
import { sendEmail as defaultSendEmail } from "@/lib/email/resend";

export interface RetractionDb {
  retractionRequest: {
    create(args: {
      data: { contactName: string; contactEmail: string; contactPhone: string | null; orderNumber: string | null; reason: string | null };
      select: { seq: true };
    }): Promise<{ seq: number }>;
  };
}
export interface RetractionDeps {
  db: RetractionDb;
  sendEmail?: typeof defaultSendEmail;
  ownerEmail?: string;
}
export type RetractionResult = { ok: true; ticket: string } | { ok: false; error: string };

export async function createRetractionRequest(input: RetractionInput, deps: RetractionDeps): Promise<RetractionResult> {
  const parsed = validateRetraction(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.value;
  const { seq } = await deps.db.retractionRequest.create({
    data: { contactName: v.contactName, contactEmail: v.contactEmail, contactPhone: v.contactPhone, orderNumber: v.orderNumber, reason: v.reason },
    select: { seq: true },
  });
  const ticket = formatRetractionTicket(seq);
  const send = deps.sendEmail ?? defaultSendEmail;
  const ownerEmail = deps.ownerEmail ?? process.env.RESEND_OWNER_EMAIL ?? "";
  if (ownerEmail) {
    try {
      const mail = retractionAlertEmail({ ticket, contactName: v.contactName, contactEmail: v.contactEmail, contactPhone: v.contactPhone, orderNumber: v.orderNumber, reason: v.reason });
      await send({ to: ownerEmail, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (err) {
      console.error("retraction owner email failed", err);
    }
  }
  return { ok: true, ticket };
}
```

- [ ] **Step 3: Run** → PASS. **Step 4: Commit**

```bash
git add src/lib/legal/retraction/service.ts tests/integration/legal/retraction-service.test.ts
git commit -m "feat(m5): servicio createRetractionRequest (registro + constancia + alerta)"
```

---

## Fase 3 — Arrepentimiento frontend

### Task 7: Server action

**Files:**
- Create: `src/app/(storefront)/arrepentimiento/actions.ts`

- [ ] **Step 1: Implement**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { createRetractionRequest } from "@/lib/legal/retraction/service";
import type { RetractionInput } from "@/lib/legal/retraction/validation";
import type { ActionResult } from "@/lib/forms/action-result";

export interface RetractionActionResult extends ActionResult {
  ticket?: string;
}

export async function requestRetractionAction(input: RetractionInput): Promise<RetractionActionResult> {
  const r = await createRetractionRequest(input, { db: prisma });
  return r.ok ? { ok: true, ticket: r.ticket } : { ok: false, error: r.error };
}
```

- [ ] **Step 2: Typecheck** → `pnpm typecheck` → PASS (verifica que `prisma` satisface `RetractionDb`).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(storefront)/arrepentimiento/actions.ts"
git commit -m "feat(m5): server action de arrepentimiento"
```

### Task 8: Client form (honeypot + constancia)

**Files:**
- Create: `src/app/(storefront)/arrepentimiento/retraction-form.tsx`

- [ ] **Step 1: Implement** (patrón de `review-form.tsx`)

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { requestRetractionAction } from "./actions";

export function RetractionForm() {
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await requestRetractionAction({
      contactName: String(fd.get("contactName") ?? ""),
      contactEmail: String(fd.get("contactEmail") ?? ""),
      contactPhone: String(fd.get("contactPhone") ?? ""),
      orderNumber: String(fd.get("orderNumber") ?? ""),
      reason: String(fd.get("reason") ?? ""),
      website: String(fd.get("website") ?? ""),
    });
    setPending(false);
    if (res.ok) setTicket(res.ticket ?? "—");
    else setError(res.error ?? "Error");
  }

  if (ticket) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-surface-alt p-4">
        <p className="font-medium text-primary">Recibimos tu solicitud de arrepentimiento.</p>
        <p className="mt-1 text-sm">Tu número de constancia es <strong>{ticket}</strong>. Te vamos a contactar por email para coordinar la devolución y el reintegro.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border p-4">
      <div className="space-y-1">
        <Label htmlFor="contactName">Nombre y apellido</Label>
        <Input id="contactName" name="contactName" required minLength={2} maxLength={80} autoComplete="name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="contactEmail">Email</Label>
        <Input id="contactEmail" name="contactEmail" type="email" required autoComplete="email" inputMode="email" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="contactPhone">Teléfono (opcional)</Label>
        <Input id="contactPhone" name="contactPhone" type="tel" maxLength={40} autoComplete="tel" inputMode="tel" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="orderNumber">Número de pedido (opcional)</Label>
        <Input id="orderNumber" name="orderNumber" maxLength={40} placeholder="GLM-000123" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reason">Motivo (opcional)</Label>
        <Textarea id="reason" name="reason" maxLength={1000} rows={3} />
      </div>
      {/* Honeypot anti-spam */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar solicitud"}</Button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(storefront)/arrepentimiento/retraction-form.tsx"
git commit -m "feat(m5): formulario de arrepentimiento (constancia + honeypot)"
```

### Task 9: Página `/arrepentimiento`

**Files:**
- Create: `src/app/(storefront)/arrepentimiento/page.tsx`

- [ ] **Step 1: Implement** (usa `Prose` de Task 10 — crear `Prose` antes o inline; este plan crea `Prose` en Task 10, así que esta página se finaliza tras Task 10). Estructura:

```tsx
import type { Metadata } from "next";
import { Prose } from "@/components/legal/prose";
import { businessInfo } from "@/lib/legal/business-info";
import { RetractionForm } from "./retraction-form";

export const metadata: Metadata = {
  title: "Botón de Arrepentimiento",
  description: "Ejercé tu derecho de arrepentimiento (art. 34 Ley 24.240). Tenés 10 días corridos para revocar tu compra sin costo.",
};

export default function ArrepentimientoPage() {
  return (
    <Prose>
      <h1>Botón de Arrepentimiento</h1>
      <p>De acuerdo con el art. 34 de la Ley 24.240 de Defensa del Consumidor y la Resolución 424/2020,
      podés revocar tu compra dentro de los <strong>{businessInfo.retractionDays} días corridos</strong> desde
      la recepción del producto, sin necesidad de justificar tu decisión y sin costo alguno.</p>
      <h2>Cómo funciona</h2>
      <ul>
        <li>Completá el formulario con tus datos y el número de pedido (si lo tenés a mano).</li>
        <li>Vas a recibir un <strong>número de constancia</strong> al enviar la solicitud.</li>
        <li>Te contactamos por email para coordinar la devolución del producto y el reintegro del importe.</li>
        <li>El producto debe devolverse en las condiciones recibidas. El reintegro se realiza una vez recibido.</li>
      </ul>
      <p>También podés iniciar un reclamo ante <a href={businessInfo.consumerDefenseUrl} target="_blank" rel="noopener">Defensa del Consumidor</a>.</p>
      <h2>Solicitud</h2>
      <RetractionForm />
    </Prose>
  );
}
```

- [ ] **Step 2: Commit** (tras Task 10 para que compile `Prose`)

```bash
git add "src/app/(storefront)/arrepentimiento/page.tsx"
git commit -m "feat(m5): página de botón de arrepentimiento"
```

---

## Fase 4 — Páginas legales/contenido

### Task 10: Componente `Prose`

**Files:**
- Create: `src/components/legal/prose.tsx`

- [ ] **Step 1: Implement** (tipografía legible, headings jerárquicos, ancho de lectura)

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Wrapper tipográfico para páginas de texto (legales/contenido). Headings jerárquicos y ancho de lectura. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        "mx-auto max-w-prose space-y-4 py-6 text-foreground",
        "[&_h1]:font-display [&_h1]:text-3xl [&_h1]:mb-2",
        "[&_h2]:font-display [&_h2]:text-xl [&_h2]:mt-8 [&_h2]:mb-2",
        "[&_p]:leading-relaxed [&_p]:text-foreground/90",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
        "[&_a]:text-primary-hover [&_a]:underline [&_a]:underline-offset-2",
        className,
      )}
    >
      {children}
    </article>
  );
}
```

> Nota a11y/contraste: links usan `primary-hover` (#E01E7D) — no `primary` (#FF2E93)— para AA en texto chico.

- [ ] **Step 2: Commit**

```bash
git add src/components/legal/prose.tsx
git commit -m "feat(m5): componente Prose para páginas de texto"
```

### Task 11: `/terminos`

**Files:** Create `src/app/(storefront)/terminos/page.tsx`

- [ ] **Step 1: Implement** — `metadata` (title "Términos y Condiciones") + `<Prose>` con secciones obligatorias: identificación del proveedor (`businessInfo.legalName/taxId/taxCondition/address`), objeto, precios en ARS, medios de pago (`paymentMethods`), formación del contrato, envíos (link a `/envios-y-pagos`), derecho de arrepentimiento (link a `/arrepentimiento`), garantía legal (Ley 24.240), responsabilidad, propiedad intelectual, jurisdicción (`jurisdiction`), datos de contacto (link `/contacto`). Copy real en español; datos del negocio vía `businessInfo`.
- [ ] **Step 2: Commit** `git commit -m "feat(m5): página de términos y condiciones"`

### Task 12: `/privacidad`

**Files:** Create `src/app/(storefront)/privacidad/page.tsx`

- [ ] **Step 1: Implement** — `<Prose>` con: responsable (`businessInfo`), datos que se recolectan (contacto, pedido, navegación), finalidad, base legal/consentimiento (Ley 25.326), destinatarios (MP, Resend, Supabase, Cloudflare, PostHog), derechos ARCO + cómo ejercerlos (email), conservación, baja de comunicaciones, mención AAIP (registro y reclamos), cookies/analytics (PostHog opt-out). Copy real.
- [ ] **Step 2: Commit** `git commit -m "feat(m5): política de privacidad"`

### Task 13: `/contacto` (info-only)

**Files:** Create `src/app/(storefront)/contacto/page.tsx`

- [ ] **Step 1: Implement** — Server Component que lee `Setting` (`prisma.setting.findUnique({ where: { id: "default" }})`) para WhatsApp/IG/TikTok; fallback a `businessInfo`. Render: email (`mailto:`), WhatsApp (`wa.me`), IG/TikTok (si existen), horarios/tiempo de respuesta. Sin formulario. Íconos Lucide con `aria-label`. Targets ≥44px.
- [ ] **Step 2: Commit** `git commit -m "feat(m5): página de contacto (info)"`

### Task 14: `/nosotras`, `/preguntas-frecuentes`, `/envios-y-pagos`

**Files:** Create las 3 `page.tsx`.

- [ ] **Step 1:** `/nosotras` — `<Prose>` con historia/propuesta de marca (`00`: "glam accesible, no humo"), `[COMPLETAR]` donde haga falta detalle del negocio.
- [ ] **Step 2:** `/preguntas-frecuentes` — FAQ accesible con `<details><summary>` nativo (envíos, pagos, cambios/devoluciones→link arrepentimiento, tiempos, stock). Headings jerárquicos.
- [ ] **Step 3:** `/envios-y-pagos` — política de envíos (zonas, envío gratis desde `Setting.freeShippingThreshold`, plazos), medios de pago (`businessInfo.paymentMethods`). Lee `Setting` para el umbral.
- [ ] **Step 4: Commit** `git commit -m "feat(m5): páginas nosotras, FAQ y envíos-y-pagos"`

---

## Fase 5 — Footer + sitemap

### Task 15: Footer con links reales

**Files:** Modify `src/components/layout/site-footer.tsx`

- [ ] **Step 1: Implement** — reemplazar `<span aria-disabled>` por columnas con `<Link>`:
  - **Tienda:** Tienda (`/tienda`).
  - **Ayuda:** Contacto, Preguntas frecuentes, Envíos y pagos, Nosotras.
  - **Legales:** Términos (`/terminos`), Privacidad (`/privacidad`), **Botón de arrepentimiento** (`/arrepentimiento`), Defensa del Consumidor (link externo `businessInfo.consumerDefenseUrl`).
  - Medios de pago: texto real o `[COMPLETAR]`.
  - Todos los links con `hover:text-foreground focus-visible:ring-2`, targets ≥44px (padding), `nav aria-label`.
- [ ] **Step 2:** Verificar visual en `pnpm dev`.
- [ ] **Step 3: Commit** `git commit -m "feat(m5): footer con legales + botón de arrepentimiento"`

### Task 16: Sitemap

**Files:** Modify `src/app/sitemap.ts`

- [ ] **Step 1: Implement** — agregar rutas estáticas al array de retorno:

```ts
const staticPages = ["/terminos", "/privacidad", "/arrepentimiento", "/contacto", "/nosotras", "/preguntas-frecuentes", "/envios-y-pagos"]
  .map((p) => ({ url: absoluteUrl(p), lastModified: now }));
```
y `...staticPages` en el return.

- [ ] **Step 2: Commit** `git commit -m "feat(m5): rutas legales/contenido en sitemap"`

---

## Fase 6 — WhatsApp FAB

### Task 17: WhatsApp FAB

**Files:**
- Create `src/components/layout/whatsapp-fab.tsx`
- Modify `src/app/(storefront)/layout.tsx`

- [ ] **Step 1: Implement** componente (Server Component, lee Setting; no renderiza sin número)

```tsx
import { MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";

function toWaNumber(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export async function WhatsAppFab() {
  const setting = await prisma.setting.findUnique({ where: { id: "default" }, select: { whatsappNumber: true } });
  const num = setting?.whatsappNumber ? toWaNumber(setting.whatsappNumber) : "";
  if (!num) return null;
  const href = `https://wa.me/${num}?text=${encodeURIComponent("¡Hola! Tengo una consulta sobre Glamify Makeup 💄")}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar por WhatsApp"
      className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-soft-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none md:bottom-6"
    >
      <MessageCircle className="h-7 w-7" aria-hidden />
    </a>
  );
}
```

> Si `shadow-soft-lg` no existe en el theme, usar `shadow-lg`. Verificar en `tailwind.config`.

- [ ] **Step 2:** Montar en `(storefront)/layout.tsx`: importar `WhatsAppFab` y renderizar `<WhatsAppFab />` dentro del provider (junto a `<CartDrawer/>`).
- [ ] **Step 3:** Verificar en `pnpm dev` (con `Setting.whatsappNumber` seteado vía seed/DB) que el FAB no tapa el bottom-nav ni CTAs.
- [ ] **Step 4: Commit** `git commit -m "feat(m5): WhatsApp FAB site-wide (condicionado a Setting)"`

---

## Fase 7 — Accesibilidad WCAG AA

### Task 18: Skip-link + landmark main

**Files:**
- Modify `src/app/(storefront)/layout.tsx`
- Modify `src/app/globals.css`

- [ ] **Step 1:** En el layout, antes de `<SiteHeader/>`, agregar skip-link y `id`/`tabIndex` en `<main>`:

```tsx
<a href="#main" className="skip-link">Saltar al contenido</a>
...
<main id="main" tabIndex={-1} className="container flex-1 pb-20 pt-4 md:pb-8">{children}</main>
```

- [ ] **Step 2:** En `globals.css` agregar:

```css
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  padding: 0.5rem 1rem;
  background: hsl(var(--primary-hover));
  color: #fff;
  border-radius: 0 0 0.5rem 0;
}
.skip-link:focus { left: 0; }
```

- [ ] **Step 3:** Verificar con teclado (Tab desde load → aparece skip-link → Enter salta a main).
- [ ] **Step 4: Commit** `git commit -m "feat(m5): skip-link + landmark main (a11y)"`

### Task 19: Auditoría a11y multi-agente + fixes verificados

**Files:** varios componentes según hallazgos.

- [ ] **Step 1: Levantar dev server** — `pnpm dev` (background).
- [ ] **Step 2: Auditar (workflow)** — fan-out por página (home, /tienda, /producto/[slug], /carrito, /checkout, /ingresar, /terminos, /arrepentimiento) ejecutando axe-core vía chrome-devtools MCP (`new_page` → `navigate_page` → `evaluate_script` inyectando `axe.run()`), navegación por teclado, foco visible, contraste (token `#FF2E93` con texto chico), `alt`/`aria-label` en íconos, orden de headings, `prefers-reduced-motion`. Cada hallazgo lo verifica un agente revisor antes de aceptarlo.
- [ ] **Step 3: Aplicar fixes** verificados (color de texto chico sobre rosa → `primary-hover`/vino; `aria-label` faltantes; `alt`; foco). Re-correr axe para confirmar 0 violaciones serias/críticas.
- [ ] **Step 4: Commit** `git commit -m "fix(m5): correcciones de accesibilidad (axe + teclado + contraste)"`

### Task 20: Spec e2e de a11y (CI)

**Files:**
- Create `tests/e2e/a11y.spec.ts`
- Modify `package.json` (devDep `@axe-core/playwright`)

- [ ] **Step 1:** `pnpm add -D @axe-core/playwright`.
- [ ] **Step 2: Implement spec** (corre en CI/Linux):

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = ["/", "/tienda", "/terminos", "/privacidad", "/arrepentimiento", "/contacto"];

for (const path of pages) {
  test(`a11y: ${path} sin violaciones serias/críticas`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => v.id), null, 2)).toEqual([]);
  });
}
```

- [ ] **Step 3: Commit** `git commit -m "test(m5): e2e axe a11y (CI)"`

---

## Fase 8 — Performance LCP/CLS

### Task 21: Auditoría Lighthouse localhost + fixes

**Files:** componentes según hallazgos (probable: `next/image` priority en hero, aspect-ratio).

- [ ] **Step 1:** `pnpm dev` (background). Lighthouse vía chrome-devtools MCP (`performance_start_trace`/`lighthouse_audit` si disponible) en `/`, `/tienda`, `/producto/[slug]`.
- [ ] **Step 2:** Registrar CLS y LCP. Fixes: imágenes con `width/height` o `aspect-ratio` (CLS<0.1), `priority` en LCP image, reservar espacio de hero, lazy below-the-fold.
- [ ] **Step 3:** Re-medir; confirmar mejora.
- [ ] **Step 4: Commit** `git commit -m "perf(m5): fixes de LCP/CLS"`

---

## Fase 9 — E2E de legales (CI)

### Task 22: Spec e2e legal/arrepentimiento

**Files:** Create `tests/e2e/legal.spec.ts`

- [ ] **Step 1: Implement** (corre en CI):

```ts
import { test, expect } from "@playwright/test";

test("footer linkea legales y carga arrepentimiento", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: /arrepentimiento/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: /arrepentimiento/i })).toBeVisible();
});

test("envío del formulario de arrepentimiento devuelve constancia", async ({ page }) => {
  await page.goto("/arrepentimiento");
  await page.getByLabel("Nombre y apellido").fill("Test QA");
  await page.getByLabel("Email").fill("qa@glamify.test");
  await page.getByRole("button", { name: /enviar solicitud/i }).click();
  await expect(page.getByText(/constancia/i)).toBeVisible();
  await expect(page.getByText(/ARR-\d{6}/)).toBeVisible();
});

test("páginas legales/contenido responden 200", async ({ page }) => {
  for (const p of ["/terminos", "/privacidad", "/contacto", "/nosotras", "/preguntas-frecuentes", "/envios-y-pagos"]) {
    const res = await page.goto(p);
    expect(res?.status()).toBe(200);
  }
});
```

- [ ] **Step 2: Commit** `git commit -m "test(m5): e2e legales + arrepentimiento (CI)"`

### Task 23: Launch-readiness como warning (no bloqueante)

**Files:** Create `tests/unit/legal/launch-readiness-warning.test.ts`

- [ ] **Step 1: Implement** — test informativo que nunca falla:

```ts
import { describe, it, expect } from "vitest";
import { findIncompletePlaceholders } from "@/lib/legal/launch-readiness";

describe("launch readiness (warning, no bloqueante)", () => {
  it("avisa si quedan datos del negocio sin completar", () => {
    const missing = findIncompletePlaceholders();
    if (missing.length) console.warn(`⚠️  Datos del negocio sin completar antes del launch: ${missing.join(", ")} (ver docs/LAUNCH.md)`);
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Commit** `git commit -m "test(m5): warning no bloqueante de launch-readiness"`

---

## Fase 10 — Verificación, runbook, review, cierre

### Task 24: Verificación local

- [ ] `pnpm typecheck` → PASS.
- [ ] `pnpm test` → PASS (toda la suite unit/integración).
- [ ] `pnpm lint` → PASS.
- [ ] Evidencia Lighthouse a11y/perf (antes/después) en localhost.

### Task 25: Runbook de lanzamiento

**Files:** Create `docs/LAUNCH.md`

- [ ] **Step 1: Implement** — checklist de §10 del spec (completar `business-info.ts`; catálogo real; secrets PROD MP/MiCorreo/Resend + dominio verificado; DNS→Cloudflare; `prisma migrate deploy`; deploy; Lighthouse PROD; compra real). Incluir comandos exactos y orden.
- [ ] **Step 2: Commit** `git commit -m "docs(m5): runbook de lanzamiento (LAUNCH.md)"`

### Task 26: Code review + cierre

- [ ] **Step 1:** `superpowers:requesting-code-review` sobre el diff de M5.
- [ ] **Step 2:** Resolver hallazgos (con `superpowers:receiving-code-review`).
- [ ] **Step 3:** `superpowers:finishing-a-development-branch` (PR vía `git push` + URL de compare; no hay `gh`).

---

## Self-Review (cobertura del spec)

- §2.1 legales (terminos/privacidad/arrepentimiento) → Tasks 11,12,9 ✓
- §2.2 contacto info-only → Task 13 ✓
- §2.3 contenido (nosotras/FAQ/envíos) → Task 14 ✓
- §3 datos negocio único → Task 1 ✓
- §4 arrepentimiento (modelo/validación/email/servicio/action/form/page) → Tasks 2–9 ✓
- §5 páginas legales (Prose) → Task 10 ✓
- §6 footer + sitemap → Tasks 15,16 ✓
- §7 WhatsApp FAB → Task 17 ✓
- §8 a11y (skip-link, audit, axe CI) → Tasks 18,19,20 ✓
- §9 perf LCP/CLS → Task 21 ✓
- §10 runbook → Task 25 ✓
- §11 verificación → Task 24 ✓
- §9-spec tests (launch-readiness warning) → Task 23 ✓; e2e legal → Task 22 ✓
- Type consistency: `RetractionInput`/`ValidRetraction`/`RetractionResult`/`RetractionDeps`/`RetractionActionResult` usados de forma consistente entre Tasks 4,6,7,8 ✓; `formatRetractionTicket` (Task 3) usado en Tasks 5-test,6 ✓.
