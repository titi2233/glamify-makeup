# Glamify Makeup — Blueprints

> **Tienda online oficial de Glamify Makeup** — ecommerce custom (Next.js + Supabase + Vercel), operado por la dueña, con foco en venta por redes (IG/TikTok → web), envíos a todo el país y mecánicas de conversión.
>
> **Regla de oro:** estos blueprints son la **fuente de verdad** del sistema. No se escribe código hasta que estén cerrados y aprobados. El desarrollo arranca recién cuando los 10 documentos estén lockeados.

Última actualización: **2026-06-03** · **Estado: ✅ planificación completa (10/10) — listo para construir M0**

---

## Mapa de blueprints

| # | Documento | Qué cubre | Estado |
|---|-----------|-----------|--------|
| **00** | [Visión, alcance y marca](00-vision-alcance-marca.md) | ADN, personas, objetivos, métricas de éxito, scope Fase 1/2 | ✅ aprobado |
| **01** | [Modelo de dominio y datos](01-modelo-dominio-datos.md) | Entidades + relaciones + schema Prisma + SKU + estados | ✅ aprobado |
| **02** | [Storefront: páginas, flujos y diseño](02-storefront-paginas-flujos-diseno.md) | Sitemap, page-by-page, UX, design system girly-clean | ✅ aprobado |
| **03** | [Panel de administración (de la dueña)](03-panel-administracion.md) | CRUD, stock, pedidos, envíos, promos, dashboard, UX simple | ✅ aprobado |
| **04** | [Checkout, pagos y ciclo de pedido](04-checkout-pagos-pedido.md) | MP Checkout Pro, webhooks, máquina de estados, edge cases | ✅ aprobado |
| **05** | [Envíos y logística](05-envios-logistica.md) | ShippingProvider, Correo Argentino API, zonas, envío gratis, pesos | ✅ aprobado |
| **06** | [Conversión y crecimiento](06-conversion-crecimiento.md) | Kit FOMO real, combos, carrito abandonado, reseñas, IA visual, SEO/OG, analytics | ✅ aprobado |
| **07** | [Arquitectura, infra y seguridad](07-arquitectura-infra-seguridad.md) | Estructura Next.js, Supabase, auth, secrets, ley del consumidor, testing, deploy | ✅ aprobado |
| **08** | [Roadmap y fases](08-roadmap-fases.md) | Milestones del desarrollo | ✅ aprobado |
| **09** | [Playbook de ejecución](09-playbook-ejecucion.md) | Prompts fase por fase para Claude Code (skills + modelo) | ✅ aprobado |

**Leyenda:** ✅ aprobado · 🟡 borrador para revisar · ⬜ pendiente

> El **09** se escribe al final: sus prompts referencian los blueprints 00–08 ya cerrados.

---

## Proceso

1. Aprobar/ajustar este mapa.
2. Ir **uno por uno, en orden**. En cada blueprint: borrador + preguntas/opciones puntuales → pulir → **aprobar** → siguiente.
3. Con los 10 cerrados, arranca el desarrollo siguiendo el playbook (09).

---

## Decisiones tomadas (resumen)

- **Build:** custom, no plataforma. Stack: Next.js 15 (App Router) + TypeScript + Supabase (Postgres/Auth/Storage) + Prisma + shadcn/ui + Vercel.
- **Operación:** la dueña gestiona todo (CRUD, stock, pedidos, envíos) desde un panel propio; soporte técnico a cargo del dev.
- **Cobro:** Mercado Pago Checkout Pro (Fase 1).
- **Envíos:** Correo Argentino (MiCorreo/PaqAr) como operador principal; cálculo por código postal; envío gratis sobre umbral; retiro en persona.
- **Dominio:** `glamifymakeup.site` (ya comprado).
- **Volumen actual:** bajo (stock y ventas chicos hoy); el sistema se diseña para **crecer**, no para el volumen de hoy.
- **Motor de ejecución:** Superpowers + ux-ui-pro-max + ultracode (modelo Opus/Sonnet híbrido por fase). GSD se evalúa aparte en un proyecto descartable, no en este build.
- **Mercado:** Argentina, ARS, español. Sin multi-moneda/idioma (se deja preparado, no se construye ahora).
- **Notificaciones:** **email (Resend)** en v1; **WhatsApp (Evolution Go) diferido** → `TODO.md`. Stack 100% serverless.

## Pendientes / decisiones abiertas

- [ ] **Datos reales** para KPIs y pricing (ver 00 §7 y §12).
- [ ] **Scope diferido** (WhatsApp/Evolution Go, Vercel Pro, Sentry, logo vectorial, Fase 2) → [`../TODO.md`](../TODO.md).
