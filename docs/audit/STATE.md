# Estado — Auditoría de pre-lanzamiento

**Cerrada.** 6/6 fases completas, 2026-08-27/28.

| Fase | Superficie | Veredicto |
|---|---|---|
| 1 | Pago real E2E | 🔴 sin timeout en llamadas a MP (arreglable, patrón ya existe en el repo) |
| 2 | Datos de prueba en DB de prod | 🔴 **bloqueante** — dev y prod comparten la misma DB, sin guard en seed/scripts |
| 3 | Saldo prepago MiCorreo | 🟢 código correcto — riesgo 100% operativo (hábito de recarga) |
| 4 | Pesos reales de productos | 🟢 código correcto — riesgo 100% operativo (pesar y cargar productos reales) |
| 5 | Legal/fiscal Argentina | 🔴 sin facturación AFIP en el flujo, sin checkbox de aceptación de T&C |
| 6 | Config de producción | 🔴 email de confirmación sin try/catch en el webhook (dinero de por medio), SETUP.md incompleto |

Ver `docs/audit/reports/SUMMARY.md` para el veredicto consolidado go/no-go y el detalle completo en cada `0N-*.md`.

**Siguiente paso:** los fixes de código (fases 1 y 6) van por `protocolo-fixes-general` en una sesión aparte — auditar ≠ fixear. Las decisiones de negocio (fase 2, 5) requieren input de Lazar antes de tocar nada.

## Fixes aplicados post-auditoría

- **2026-08-28 — Fase 2**: guard de entorno en `prisma/seed.ts` y `scripts/simulate-mp-webhook.ts` (`scripts/prod-write-guard.ts`). Decisión del dueño: blindar scripts, no separar Supabase todavía. Detalle en `reports/02-datos-prueba-prod.md`.
- **2026-08-28 — Fase 1**: timeout/`AbortSignal` en las llamadas a Mercado Pago (`src/lib/payments/mercadopago.ts`). Detalle en `reports/01-pago-real-e2e.md`.
- **2026-08-28 — Fase 6**: try/catch best-effort en el email post-pago del webhook (`src/lib/orders/webhook-service.ts` + test nuevo), drift de `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` cerrado en `wrangler.jsonc`, `SETUP.md` alineado con `docs/LAUNCH.md`. Detalle en `reports/06-config-produccion.md`.
- Judge tras los 4 fixes: `pnpm typecheck` verde, `pnpm test` 465/465 verde, `pnpm build` verde, `wrangler deploy --dry-run` confirma config. Revisión adversarial de contexto fresco corrida sobre el diff completo.
- **Sin resolver, deliberadamente**: fase 5 (checkbox de aceptación de T&C en checkout, facturación AFIP) — son decisión de negocio/UX, no bug de código; siguen en REQUIERE INPUT. Fase 3 y 4 no tenían hallazgo de código.
- **Revisión adversarial de contexto fresco** sobre el diff completo: aprobado con reservas, encontró 2 fallas reales (no bloqueantes) + 1 gap menor:
  - `package.json` (`db:seed` + `prisma.seed`) no cargaba `.env` → el guard nuevo de fase 2 mostraba `"(DATABASE_URL no seteada)"` en vez del host real, vaciando su propósito en el script más peligroso. Fix: agregado `--env-file=.env`.
  - Timeout de MP filtraba `"The operation was aborted due to timeout"` (inglés) a la clienta en el checkout. Fix: `src/app/(storefront)/actions.ts` mapea `DOMException TimeoutError/AbortError` a mensaje en español.
  - `MICORREO_SANDBOX` faltaba en `SETUP.md`/`docs/LAUNCH.md` (5 de 6 vars documentadas). Fix: agregada a ambos.
  - Judge tras esta segunda ronda: `pnpm typecheck`/`pnpm lint`/`pnpm test` (465/465) verdes.
- **2026-08-28 — Fase 5 (checkbox T&C)**: decisión del dueño, aplicado. `checkout-form.tsx` — checkbox obligatorio antes de pagar, con links a `/terminos`/`/privacidad`. Verificado en navegador real: bloquea sin tildar, pasa y llega a MP con el checkbox tildado. Detalle en `reports/05-legal-fiscal.md`.
- **Hallazgo incidental (no parte de las 6 fases) — bug de hidratación en breadcrumbs**: durante la verificación en navegador del checkbox se encontró `<li>` anidado en `<li>` en `CatalogBreadcrumbs` (BreadcrumbSeparator como hijo de BreadcrumbItem en vez de hermano) — HTML inválido, tiraba error de hidratación de React en TODAS las páginas de producto/categoría, confirmado también en producción (`glamifymakeup.site`, React error #418 en consola). Se verificó con evidencia que esto **no** rompía "Agregar al carrito" (el botón funciona bien pese al error) — es un bug real pero de menor severidad que lo que parecía en un primer momento. Fix mecánico de una línea (separator como hermano, no hijo) en `src/components/catalog/catalog-breadcrumbs.tsx`, verificado que el error desapareció en una pestaña nueva del navegador.
- Todo lo de arriba está sin commitear — el dueño pidió juntar todos los hallazgos y commitear al final.
