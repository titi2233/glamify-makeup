# 09 — Playbook de ejecución

> **Propósito:** cómo construir el sistema fase por fase con Claude Code — los **prompts exactos** que tirás, las **skills** y el **modelo**. Se escribe último porque referencia `00`–`08`.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03

---

## 1. Setup de metodología

- **Motor:** **Superpowers** — `brainstorming` (si hay duda de diseño) → `writing-plans` → `subagent-driven-development`/`executing-plans` (con `test-driven-development`) → `verification-before-completion` → `requesting-code-review` → `finishing-a-development-branch`.
- **UI:** **ux-ui-pro-max** en las fases de interfaz (el design system del `02` ya está; se persiste `design-system/MASTER.md` en M0 y se consulta en M1/M3/M4).
- **Modelo:** **Opus 4.8 + ultracode + dynamic workflows en TODAS las fases** (decisión del dueño: lo último y más avanzado, máxima calidad). `ultracode` activa orquestación multi-agente por defecto → más exhaustivo, más tokens.
- **Git:** rama por milestone (worktrees si conviene), PR + code-review al cerrar cada uno.

## 2. Convenciones de cada prompt

1. Empezar con **`ultracode`**.
2. "Leé `blueprints/` (00–08) y `TODO.md`".
3. Nombrar el **milestone** y su **alcance** + blueprints de referencia.
4. **Plan primero** (`writing-plans`), ejecutar con **TDD**, **verificar** antes de cerrar, **code-review** antes de merge.
5. En fases de UI: usar **ux-ui-pro-max** + `design-system/MASTER.md`.

## 3. Prompts por milestone

### M0 — Cimientos
```
ultracode
Proyecto: Glamify Makeup (ecommerce). Leé TODOS los blueprints en blueprints/ (00–08) y TODO.md.
Milestone M0 — Cimientos. Superpowers: PLAN primero (writing-plans), luego TDD.
Alcance:
- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui.
- Supabase (Postgres + Auth + Storage) + Prisma con el schema del blueprint 01.
- Design tokens del 02 (rosa eléctrico #FF2E93, Playfair Display + Nunito Sans, soft UI). Persistí design-system/MASTER.md con ux-ui-pro-max.
- Layout base + estructura de carpetas. CI (lint/typecheck/test) + deploy a Vercel.
Verificá: build OK, deploy OK, migración Prisma corre.
DoD: app deployada (home placeholder) + DB migrada + tokens aplicados.
```

### M1 — Catálogo (lectura)
```
ultracode
Glamify Makeup — Milestone M1 (Catálogo). Releé 01, 02, 06. Superpowers: plan → TDD. UI con ux-ui-pro-max (design-system/MASTER.md).
Alcance:
- Entidades de catálogo + seed de prueba.
- Home, /tienda con filtros y subcategorías (jerárquico 2 niveles), ficha de producto con variantes (swatches + stock por tono).
- Componentes: ProductCard, VariantSwatchSelector, PriceTag, StockBadge, FilterSheet, breadcrumbs.
- Mobile-first, bottom nav, accesibilidad (02 §10).
Verificá: navegación catálogo→ficha con datos reales en 375/768/1024.
DoD: catálogo y ficha navegables con datos reales.
```

### M2 — Carrito + Checkout + Pagos
```
ultracode
Glamify Makeup — Milestone M2 (Carrito + Checkout + Pagos). Releé 04, 05, 01. Superpowers: plan → TDD.
Alcance:
- Carrito (drawer) + /carrito, cupones.
- Checkout de un paso (02 §7): contacto, entrega (domicilio/sucursal), CP → cálculo de envío (API Correo MiCorreo + zonas fallback, 05).
- MP Checkout Pro (excluir efectivo: ticket+atm), webhook (firma + idempotencia + consultar el pago), máquina de estados del pedido (04), descuento de stock al aprobar.
- Emails de pedido/pago con Resend.
Verificá: compra de punta a punta en sandbox MP; stock baja; email llega; webhook idempotente.
DoD: comprar end-to-end en sandbox funciona.
```

### M3 — Panel de administración
```
ultracode
Glamify Makeup — Milestone M3 (Panel admin). Releé 03, 01, 05. Superpowers: plan → TDD. UI con ux-ui-pro-max + UX simple del 03 ("que lo entienda un nene").
Alcance:
- Auth admin (owner/dev), RLS.
- CRUD productos (fotos a Storage, variantes, SKU auto), categorías (jerárquico), combos.
- Stock (alerta + ajuste manual), pedidos (estados + tracking), envíos (zonas, umbral, CP origen), cupones, reseñas (moderación), ajustes, dashboard.
Verificá: la dueña carga producto, ve pedido, cambia estado, ajusta stock — sin tocar código.
DoD: operación completa desde el panel.
```

### M4 — Cuenta + Conversión + Crecimiento
```
ultracode
Glamify Makeup — Milestone M4 (Cuenta + Conversión). Releé 06, 02. Superpowers: plan → TDD. UI con ux-ui-pro-max.
Alcance:
- Cuentas (email + Google), wishlist, reseñas (alta + display + moderación).
- Conversión (06): barra envío gratis, combos, order-bump, cross-sell, stock badges reales.
- Carrito abandonado (Vercel Cron + email Resend), exit-intent sutil.
- PostHog, SEO + Open Graph, estética IA (06 §5, con guardrails de performance/reduced-motion).
Verificá: funnel completo + eventos en PostHog + emails de recupero.
DoD: funnel y medición andando.
```

### M5 — Pulido, QA y Launch
```
ultracode
Glamify Makeup — Milestone M5 (Pulido, QA, Launch). Releé 02 (legales/a11y), 07 (seguridad/tests).
Superpowers: plan → TDD → verification → code-review → finishing-a-development-branch.
Alcance:
- Legales: Botón de Arrepentimiento, Términos, Privacidad.
- Accesibilidad (WCAG AA), performance (LCP/CLS), tests (unit/integración/e2e Playwright).
- Carga de catálogo real, credenciales PROD (MP, MiCorreo, Resend), DNS del dominio.
Verificá: tests verdes, Lighthouse OK, compra real de prueba en PROD.
DoD: tienda en producción en glamifymakeup.site.
```

## 4. Definición de "listo" (por milestone)

Cada milestone se cierra **solo** cuando su **DoD** está verificado con evidencia (build/tests/observación real), nunca por asunción. `verification-before-completion` es obligatorio antes de marcar listo.

## 6. Ramas, seed y preview

- **Siempre en rama, nunca `main`:** una rama por milestone (`m0-cimientos`, `m1-catalogo`, …). PR + code-review antes de mergear a `main`.
- **Seed de "producción falsa":** en **M1** se carga un **seed realista** (productos, variantes, combos, fotos placeholder) para **ver cómo queda la tienda** sin esperar datos reales. El seed es **solo dev/preview**.
- **Preview deploy:** cada PR genera un **deploy de preview en Vercel** → una URL para ver la tienda en vivo con el seed.
- **Datos reales:** la dueña carga los productos **uno por uno** desde el panel (M3). El seed se limpia antes del launch (M5).

## 7. Manejo de contexto (`/clear` y `/compact`)

La fuente de verdad son los **blueprints + el código en disco**, no el historial del chat. Por eso:

- **Entre milestones → `/clear`.** Empezá cada milestone con contexto limpio y su prompt (que dice "leé `blueprints/`"); se re-funda el contexto desde el disco. **Commiteá antes de `/clear`** (que el progreso esté en git, no en el chat).
- **Dentro de un milestone, si se llena el contexto → `/compact`.** Resume y libera espacio sin perder el hilo. **No uses `/clear` a mitad** de un milestone (perderías el razonamiento en curso).
- **`ultracode` ayuda:** orquesta en subagentes con su propio contexto, así el hilo principal se mantiene liviano.
- **Regla práctica:** barra de contexto pasa ~70–80% a mitad de tarea → `/compact`. Milestone terminado y mergeado → `/clear` y al siguiente.

## 8. Decisión

- **D09-1 ✔** — Modelo: **Opus 4.8 + ultracode + dynamic workflows** en todas las fases.
- **D09-2 ✔** — Build siempre en **rama (nunca `main`)** + **seed para preview**; datos reales por el panel.
- **D09-3 ✔** — Contexto: **`/clear` entre milestones**, **`/compact` dentro** de un milestone.
