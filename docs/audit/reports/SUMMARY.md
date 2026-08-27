# Veredicto go/no-go — Auditoría de pre-lanzamiento glamify-makeup

Fecha: 2026-08-27/28. Alcance: 6 superficies fuera del módulo de envíos MiCorreo (ya auditado y cerrado antes). Método: solo lectura de código/config, sin conexión a DB de prod ni llamadas reales a proveedores.

## Veredicto general: **NO-GO todavía** — no por volumen de bugs, sino por un hallazgo estructural (fase 2)

## Ordenado por gravedad real

### 🔴🔴 Bloqueante — Fase 2: dev y prod comparten la misma base de datos
`.env`, `.env.local` y `wrangler.jsonc` (el que se despliega a Cloudflare) apuntan al **mismo proyecto Supabase**. `prisma/seed.ts` y `scripts/simulate-mp-webhook.ts` no tienen ningún guard de entorno, y el script de simulación usa el checkout real, la secuencia real de `orderNumber`, descuenta stock real y manda emails reales (incluido el alert a la dueña). No se puede saber desde acá si ya corrió contra prod — hay un marcador (`mpPaymentId LIKE 'SIM-%'`) y un SQL listo para chequearlo en `docs/audit/reports/02-datos-prueba-prod.md`.

**Por qué es el más grave de los seis**: los otros 5 son "esto podría salir mal a futuro"; este es "esto puede haber pasado ya, y va a volver a pasar cada vez que alguien corra un comando local sin darse cuenta". Antes de vender con plata real hay que cerrar esto, no solo documentarlo.

### 🔴 Fase 5 — legal/fiscal
Sin ningún mecanismo de facturación AFIP en el flujo (ni campo, ni comprobante, ni mención en ningún blueprint — no fue evaluado, no es que se pospuso a propósito). Sin checkbox de aceptación de Términos en el checkout. Las páginas de consumidor (T&C, privacidad, arrepentimiento) están sólidas y ya cumplen Ley 24.240/Res. 424/2020.

### 🔴 Fase 6 — email de confirmación sin try/catch en el webhook de pago
Si Resend falla justo en ese momento, el pago ya está confirmado en DB pero el webhook devuelve 500 en vez de 200 → MP reintenta indefinidamente sobre un pago que ya es idempotente (no duplica plata/stock, pero sí genera ruido de reintentos sin resolución). Contrasta con el propio patrón best-effort que el repo ya usa en MiCorreo y en otros 2 call-sites de email — es una inconsistencia arreglable, no una decisión de diseño.

### 🔴 Fase 1 — sin timeout en llamadas a Mercado Pago
`createPreference`/`getPayment` sin `AbortSignal`. Si la API de MP se cuelga, puede colgar el checkout o el webhook indefinidamente. El patrón (`AbortSignal.timeout`) ya existe y está probado en `shipping/micorreo.ts` — aplicarlo es mecánico.

### 🟢 Fase 3 — saldo MiCorreo, 🟢 Fase 4 — pesos reales
Código correcto en ambas. El riesgo es 100% operativo/humano: vigilar el saldo prepago de MiCorreo, y pesar/cargar el peso real de cada producto del catálogo real (no el del seed de desarrollo).

## Los 4 hallazgos de código (fases 1, 5 checkbox, 6) son chicos y rápidos de arreglar

Ninguno requiere rediseño. El timeout de MP y el try/catch del email son cada uno un cambio acotado siguiendo un patrón que ya existe en el repo. El checkbox de T&C es un campo + validación. Lo que SÍ toma tiempo real y no es negociable con código es: separar o blindar la DB (fase 2), resolver la facturación AFIP (fase 5, requiere decisión de la dueña sobre cómo se factura hoy), y las tareas operativas de fase 3/4.

## REQUIERE INPUT — decisiones que no puedo tomar

1. **(Urgente, fase 2)** Correr el SQL de `02-datos-prueba-prod.md` contra la DB real para saber si ya hay contaminación de pedidos/stock de prueba.
2. **(Urgente, fase 2)** ¿Separar Supabase dev/prod en dos proyectos, o blindar `seed.ts`/`simulate-mp-webhook.ts` con un guard de entorno? Es decisión de costo (un proyecto Supabase nuevo puede tener costo/tiempo de migración) vs. blindaje de código (más rápido, menos robusto).
3. **(Fase 5)** ¿Cómo se está facturando hoy cada venta ante AFIP — manual fuera del sistema, o no se está haciendo?
4. **(Fase 5)** ¿Los textos de `/terminos` y `/privacidad` fueron revisados por un abogado, o son genéricos?
5. **(Nota de seguridad, fase 2)** Rotar `MP_ACCESS_TOKEN` por precaución — quedó expuesto en la transcripción de un subagente durante esta auditoría (detalle en `02-datos-prueba-prod.md`).
6. Confirmar en el dashboard de Cloudflare/Resend/Supabase los 3 puntos operativos que ningún código puede certificar: secrets realmente cargados, dominio de Resend verificado, redirect URLs de Supabase apuntando a producción (detalle en `06-config-produccion.md`).

## Próximo paso

Auditar ≠ fixear (regla del propio método). Los 3 fixes de código (timeout MP, try/catch email, checkbox T&C) van por `protocolo-fixes-general` en una sesión aparte con contexto limpio. Antes de esa sesión, necesito tu respuesta a los puntos 1-4 de arriba — en particular el 1 y 2, porque cambian qué tan urgente es todo lo demás.
