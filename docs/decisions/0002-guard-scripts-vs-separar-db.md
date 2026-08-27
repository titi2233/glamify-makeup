# ADR 0002 — Blindar scripts locales en vez de separar Supabase dev/prod

**Fecha:** 2026-08-28
**Estado:** aceptada

## Problema

La auditoría de pre-lanzamiento (`docs/audit/reports/02-datos-prueba-prod.md`) encontró que `.env`, `.env.local` y `wrangler.jsonc` (el config que se despliega a producción) apuntan al **mismo proyecto Supabase** — no hay separación dev/prod. `prisma/seed.ts` y `scripts/simulate-mp-webhook.ts` no tenían ningún guard de entorno: correr esos comandos en la laptop local escribe contra la base real (pedido de prueba `GLM-E2E001`, `shippingZone.deleteMany({})` sin filtro, y en el caso de `simulate-mp-webhook.ts`, stock real decrementado + emails reales enviados).

## Decisión

**Blindar los scripts con un guard de entorno interactivo** (`scripts/prod-write-guard.ts`) en vez de crear un segundo proyecto Supabase para dev/staging. El guard obliga a tipear de vuelta el host real de `DATABASE_URL` antes de que `seed.ts`/`simulate-mp-webhook.ts` muten datos; sin TTY (automatización) se niega de inmediato.

## Alternativas descartadas

1. **Separar Supabase dev/prod (segundo proyecto)** — la opción "correcta" en abstracto (aislamiento real, no depende de que un humano lea un prompt). Descartada por ahora: implica migrar todo el flujo de desarrollo (seed, scripts, `.env.local` de cada máquina) a apuntar a un proyecto distinto, mover/replicar el catálogo real que la pareja del dueño ya está cargando a mano en la base compartida, y probablemente un plan pago adicional de Supabase. Decisión explícita del dueño en sesión: "Blindá los scripts con guard de entorno, no separemos Supabase todavía" — costo/tiempo no justificado en esta etapa del proyecto (pre-lanzamiento, un solo desarrollador).
2. **Gate solo por `NODE_ENV`** — descartado porque `NODE_ENV` no distingue "mi laptop corriendo contra la DB compartida" de "el mismo comando corriendo en cualquier otro contexto": el problema de fondo es que dev y prod son la MISMA base, no que falte detectar el entorno de ejecución.
3. **Confirmación no interactiva (flag `--yes` o variable de entorno)** — descartada porque no obliga a leer nada: un `--yes` copiado y pegado en un alias de shell reproduce exactamente el problema original (ejecutar sin pensar). El valor del guard elegido es forzar a que una persona LEA el host real antes de confirmar.

## Limitación conocida (documentada, no bloqueante)

El guard depende de que `DATABASE_URL` esté cargada en `process.env` al momento de ejecutarse — si el script que lo usa no carga `.env` (ver gotcha `tsx-no-autocarga-env` en la memoria del OS), el guard muestra `"(DATABASE_URL no seteada)"` en vez del host real, vaciando su propósito. Ya corregido para `seed.ts`/`simulate-mp-webhook.ts` (`package.json` con `--env-file=.env`); cualquier script NUEVO que use `confirmProdWrite()` tiene que verificar lo mismo.

## Revisitar cuándo

Si el equipo crece (más de una persona corriendo scripts locales regularmente), o si se detecta una segunda vez que el guard no evitó una escritura accidental, reconsiderar la opción 1 (separar Supabase dev/prod de verdad).
