# Fase 1 — Pago real E2E (Mercado Pago producción)

## 1. Credenciales — 🟢 (código) / REQUIERE INPUT (¿ya cargado en Cloudflare?)

Token solo llega vía `process.env.MP_ACCESS_TOKEN` (`src/lib/payments/mercadopago.ts:11-12`), nunca hardcodeado ni en variable pública. `wrangler.jsonc` `[vars]` solo tiene `NEXT_PUBLIC_*`. `docs/LAUNCH.md:41-42` documenta `wrangler secret put MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` como paso del runbook — no evidencia de que ya se corrió.

Nota menor: `NEXT_PUBLIC_MP_PUBLIC_KEY` en `wrangler.jsonc:21` (formato `APP_USR-`, prod) no se usa en ningún lado de `src/` (Checkout Pro redirect no necesita SDK client-side) — config muerta, no riesgo.

## 2. Gate contra mock en producción — 🟢

Sin archivos `*mock*` en `src/`/`scripts/`. El único reemplazo es DI explícita, usada solo en tests y en `scripts/simulate-mp-webhook.ts` (standalone, no importado por `src/app`). `webhook-service.ts`/`checkout-service.ts` apuntan siempre a las factories reales, sin rama condicionada por env var. El mock ni es alcanzable desde el árbol de la app.

## 3. Firma antes de payload — 🟢 con matiz 🟡

`webhook-service.ts:94-101`: firma se verifica primero, recién después se llama `getPayment` (fuente de verdad real, nunca se confía en `status`/`amount` del body). Matiz: el route handler (`route.ts:21-24`) lee `type`/`topic` del body antes del paso de firma para decidir un ack temprano (200 sin tocar DB) — sin impacto de negocio, pero estrictamente es lectura antes de firma. Mejora cosmética, no bloqueante.

## 4. Idempotencia — 🟢

Doble capa: `Payment.mpPaymentId @unique` (schema.prisma:339) + transición atómica `updateMany({status:"pending_payment"}) → count===1` (`webhook-service.ts:142-146`), todos los efectos de una sola vez gateados por ese guard. Testeado explícitamente para concurrencia (`webhook-service.test.ts:193-213`). Ya auditado y corregido en pase anterior (commits `25491ba`, `37ecbe1`).

## 5. Timeout en llamadas a MP — 🔴

`src/lib/payments/mercadopago.ts:53-76` (`createPreference`, `getPayment`): `fetch` **sin `AbortSignal`, sin timeout**. El propio repo ya tiene el patrón resuelto en `shipping/micorreo.ts:24` (`TIMEOUT_MS = 6000` + `AbortSignal.timeout` en 5 call sites) — no se aplicó a pagos. Si la API de MP se cuelga: el checkout puede colgar la Server Action sin feedback a la clienta, y el webhook puede colgar la invocación del Worker sin devolver 200/401 a tiempo → reintentos de MP sobre una invocación que sigue corriendo.

## 6. Cobertura real de `simulate-mp-webhook.ts` — 🟡

Corre contra DB real y prueba bien idempotencia/stock/cupón, pero **fakea** `createPreference`, `getPayment` y `autoImportShipment` (comentario propio: *"No-op en la simulación: no crear un envío real en MiCorreo"*). No ejercita: la llamada real HTTP a la API de MP (ni sandbox ni prod), el route handler HTTP real (llama `processWebhook()` en proceso, saltea parseo real de query/headers/body), ni el redirect real a `init_point`/`back_urls`. `docs/LAUNCH.md:87-90` ya lo marca como paso 8 pendiente del runbook ("Compra real de prueba... cierra el DoD").

## REQUIERE INPUT

1. ¿`wrangler secret put MP_ACCESS_TOKEN` ya se corrió con el token PROD real (no `TEST-`)?
2. ¿`wrangler secret put MP_WEBHOOK_SECRET` ya se corrió y la URL de webhook de PROD está configurada en el dashboard de MP?
3. ¿Se hizo ya la compra real de prueba (paso 8 del runbook)? Sin evidencia en git de que se haya corrido — inherentemente no verificable desde el repo.
4. Decisión de prioridad: ¿arreglar el 🔴 de timeout antes de salir a producción, o aceptar el riesgo?

## Veredicto de la fase

🔴 **Un hallazgo de código real y arreglable**: falta timeout/AbortSignal en las llamadas a MP (patrón ya existente en el repo, aplicarlo es mecánico). El resto —firma, idempotencia, gate de mock— está sólido. La compra real de prueba sigue sin evidencia de haberse ejecutado.
