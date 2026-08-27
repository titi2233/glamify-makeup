# Fase 6 — Config de producción

## 1. `wrangler.jsonc [vars]` — 🟢

Las 7 vars públicas (`NEXT_PUBLIC_*`) son legítimamente públicas — ninguna secreta está mal puesta ahí. Los secrets reales (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `RESEND_API_KEY`) van por `wrangler secret put` (`SETUP.md:111-117`), no están en `[vars]`. Sin bindings KV/D1/R2 usados en código. Hyperdrive opcional documentado como pendiente futuro, no rompe nada hoy.

🟡 drift menor: `.env.production` tiene `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=false` que `wrangler.jsonc [vars]` no tiene, pese a que ambos "deberían tener los mismos valores" según comentario propio. Next.js inlinea desde `.env.production` en build, no desde `wrangler.jsonc`, así que probablemente sin impacto — es inconsistencia documental.

## 2. `.env.example` vs código leído — 🟢

Todas las vars que el código lee están documentadas en `.env.example`, incluidas las de módulos huérfanos (correo.ts, zipnova.ts, marcados como cancelados). Ninguna falta. 🟡 al revés: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` está documentada pero nadie la usa — ruido, no riesgo.

## 3. Resend: `from` y manejo de fallo — 🔴 (bug real, dinero de por medio)

`from` correcto (`pedidos@glamifymakeup.site`), fallback si falta la key es best-effort (log a consola, no rompe). El problema es la inconsistencia entre call-sites cuando Resend SÍ está configurado pero responde error:

- `admin/shipments/service.ts` y `legal/retraction/service.ts` → try/catch, best-effort, con comentario explícito.
- 🔴 **`src/lib/orders/webhook-service.ts:265-270`** (email de confirmación a la clienta + alerta a la dueña, el path del pago real) → **sin try/catch**. `route.ts:26-29` tampoco envuelve `processWebhook`. Si Resend falla acá: la transacción de pago/stock/cupón YA se commiteó (líneas 122-223), pero la excepción no capturada sube hasta el Route Handler → probablemente 500 sin controlar en vez de `{status:200}`. Contrasta directo con el bloque de auto-import a MiCorreo dos líneas arriba, que sí está en try/catch con el comentario "Best-effort: un fallo NO voltea el webhook" — la misma regla no se aplicó acá.
- **Consecuencia concreta**: MP reintenta el webhook sobre un pago ya procesado (idempotente, no duplica), pero si Resend sigue caído el reintento vuelve a fallar en el mismo punto → loop de 500 en los logs hasta que Resend se recupere o se arregle el código. No hay pérdida de plata/stock (eso ya es idempotente), pero sí ruido de reintentos y un webhook que nunca "cierra" con 200 mientras dure la falla de Resend.
- 🟡 `cart/abandoned-job.ts:71` (cron): tampoco try/catch dentro del for-loop — un fallo corta el resto del batch de hasta 50 carritos, mitigado parcialmente porque `worker.ts` envuelve el `scheduled()` en `Promise.allSettled` (no tira el Worker, pero sí deja carritos sin procesar silenciosamente).

## 4. Hardcodeos de `localhost` — 🟡 (no bug activo, sí duplicación)

`src/lib/http/base-url.ts::getAuthBaseUrl()` es la implementación robusta (headers antes que localhost). `seo/url.ts` y `actions.ts:21-23` (usado en `back_urls`/`notification_url` de MP) duplican una versión más simple con fallback directo a `localhost:3000` — no es bug hoy porque `NEXT_PUBLIC_APP_URL` está seteado en `wrangler.jsonc` y `.env.production`, pero es lógica de "URL base" triplicada (+ `cron/deps.ts`) en vez de reusar una sola función.

## 5. `SETUP.md` vs vars leídas en runtime — 🔴

El bloque de `wrangler secret put` en `SETUP.md:108-118` **no incluye** `RESEND_FROM`, `RESEND_OWNER_EMAIL`, ni las 6 vars de MiCorreo activo (`MICORREO_EMAIL`, `MICORREO_PASSWORD`, `MICORREO_GATEWAY_AUTH`, `MICORREO_SANDBOX`, `MICORREO_ORIGIN_CP`, `MICORREO_VELOCITY`), pese a que el código las lee en producción. Consistente con lo que ya señala `TODO.md` (MiCorreo pendiente de cargar) — dato de un doc, no verificado en vivo.

## Riesgos de negocio si faltan secrets (silenciosos, sin error visible)

- `RESEND_OWNER_EMAIL` vacío → el alert de "nuevo pedido" a la dueña simplemente no se manda, sin error.
- Secrets de MiCorreo faltantes → auto-import y cotización en vivo caen a tabla de zonas fallback (comportamiento esperado, pero riesgo de precio/tiempo desactualizado si nadie lo nota).
- `RESEND_FROM` faltante → cae a `onboarding@resend.dev` (dominio de testing), degrada marca y entregabilidad.

## REQUIERE INPUT

1. `npx wrangler secret list` (o dashboard Cloudflare) — confirmar qué secrets están REALMENTE seteados hoy: `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_OWNER_EMAIL`, 6 vars MiCorreo, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`.
2. Dashboard de Resend → confirmar que `glamifymakeup.site` está verificado (SPF/DKIM).
3. Dashboard de Supabase (Auth → URL Configuration) → confirmar "Site URL"/"Redirect URLs" apuntan a producción, no localhost.
4. Decisión: ¿se acepta que un fallo de Resend en el webhook devuelva 500 (ruido de reintentos, sin pérdida de dinero), o se prioriza el fix (try/catch best-effort, mismo patrón que MiCorreo)?

## Veredicto de la fase

🔴 **Dos hallazgos de código reales**: falta try/catch best-effort en el email de confirmación dentro del webhook (inconsistente con el propio patrón que el repo ya usa), y `SETUP.md` no documenta todos los secrets que el código realmente necesita en runtime. Ninguno de los dos es de datos/dinero perdido (la idempotencia del pago no se rompe), pero sí generan ruido operativo y riesgo de "silencio" (emails que no salen sin que nadie se entere).

## Fixes aplicados (2026-08-28)

- **Punto 3 (email sin try/catch)**: `src/lib/orders/webhook-service.ts` — bloque 6b envuelto en try/catch, mismo criterio que el bloque 6a (auto-import MiCorreo) dos líneas arriba. Test nuevo en `tests/integration/webhook-service.test.ts` ("un fallo de Resend al mandar los emails NO voltea el webhook"). Nota al reverificar: `SETUP.md:108-118` en verdad estaba desactualizado — `docs/LAUNCH.md` (el runbook vigente) YA tenía `RESEND_FROM`/`RESEND_OWNER_EMAIL`/MiCorreo completos; el hallazgo real era que `SETUP.md` no reflejaba lo que `LAUNCH.md` ya sabía, no que faltara documentar en todos lados.
- **Punto 1 (drift `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`)**: agregado a `wrangler.jsonc [vars]`. Confirmado con `npx wrangler deploy --dry-run` que el binding queda cargado correctamente (sin impacto funcional real — el código ya usaba `=== "true"` como comparación estricta, así que ausente o `"false"` se comportaban igual).
- **Punto 5 (`SETUP.md` incompleto)**: `SETUP.md` §3.3 actualizado para incluir la lista completa de secrets, alineada con `docs/LAUNCH.md`.

Verificación: `pnpm typecheck` verde, `pnpm test` completo (465/465) verde, `pnpm build` verde, `wrangler deploy --dry-run` confirma el binding nuevo. Revisión adversarial de contexto fresco corrida sobre el diff.

No se tocó: duplicación de "URL base" en 3 lugares (punto 4, refactor sin bug activo — queda como deuda técnica, no bloquea). El resto de fase 6 (secrets realmente cargados en Cloudflare, dominio Resend verificado, redirect URLs de Supabase) sigue siendo operativo, no verificable desde el repo.

## Corrección tras revisión adversarial (2026-08-28)

El reviewer notó que `SETUP.md` (ya corregido arriba) documenta 5 de las 6 vars de MiCorreo pero falta `MICORREO_SANDBOX` (usada en `micorreo.ts:88` para elegir base URL TEST vs PROD) — el gap era preexistente también en `docs/LAUNCH.md`, no cerrado por el primer pase. Fix: agregada a ambos documentos (`SETUP.md` y `docs/LAUNCH.md`). Impacto bajo (ausente, cae al lado seguro — API PROD), pero cierra el hallazgo original al 100% en vez de 5/6.
