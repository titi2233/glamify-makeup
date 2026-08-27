# Fase 2 — Datos de prueba en DB de producción

**Este es el hallazgo más grave de toda la auditoría.** No es un riesgo teórico aislado: es la causa raíz que agrava a las otras 5 fases.

## 1. `prisma/seed.ts` — sin protección de entorno — 🔴

Sin ningún chequeo de `NODE_ENV`/host antes de conectar con `process.env.DATABASE_URL` (líneas 1-6). Crea 12 productos, 4 `ShippingZone`, 4 cupones, 1 combo, **y un pedido pagado de muestra `GLM-E2E001`** con `Payment` `approved` (líneas 305-386).

Agravante: `upsertZones()` (línea 263-274) hace `shippingZone.deleteMany({})` **sin filtro** antes de recrear — correr `pnpm db:seed` contra prod borraría las 4 zonas de envío reales (recalibradas con cotizaciones reales de MiCorreo, según su propio comentario) y las reemplazaría por las de prueba.

## 2. `scripts/simulate-mp-webhook.ts` — sin protección, deja rastro en prod real — 🔴

Sin guard de entorno. Usa el **mismo módulo de checkout de producción** (`checkout-service.ts`, sin `"server-only"` a propósito para que este script lo importe). El `orderNumber` sale de la **secuencia real** (`nextval('order_number_seq')`) — un pedido simulado es indistinguible de uno real por formato.

Efectos reales confirmados (no mockeados):
- Descuento de stock real sobre una variante real.
- Envío de emails reales vía Resend real — al `contactEmail` simulado y **al email real de la dueña** si `RESEND_OWNER_EMAIL` estaba seteada quien recibiría un alert de "nuevo pedido" que nunca existió.
- `RESEND_API_KEY` con valor real (`re_...`) confirmado presente en `.env`/`.env.local` → el envío de email real era técnicamente posible.

Único cuidado que sí tomaron en su momento: `autoImportShipment` es no-op explícito ("no crear un envío real en MiCorreo"). El mismo criterio **no se aplicó** a la DB ni a los emails.

**Marcador identificable**: `Payment.mpPaymentId` con prefijo `SIM-${timestamp}` — permite auditar en la DB real qué corrió.

`package.json` → `"sim:webhook": "tsx --env-file=.env scripts/simulate-mp-webhook.ts"` carga `.env`, que apunta al **mismo proyecto Supabase que producción** (ver punto 5) — correr este comando tal cual está en el repo hoy escribe contra la base real.

## 3. Script de limpieza — existe pero con gap — 🟡

`prisma/cleanup-seed.ts` está bien hecho (dry-run por default, transacción, chequea FKs), pero solo cubre lo sembrado por `seed.ts` (12 slugs fijos, `GLM-E2E001`). **No cubre pedidos de `sim:webhook`** (esos tienen `orderNumber` real tipo `GLM-000042`, no está en la lista fija). No hay ningún otro script de limpieza en el repo.

## 4. Sin flag `isTest` en el schema — 🔴 (hallazgo estructural, no bug de código)

`Order` y `Payment` no tienen ningún campo que distinga un pedido real de uno de prueba una vez insertado. La única forma de identificarlos post-hoc es heurística (`mpPaymentId LIKE 'SIM-%'`, contacto `sim@example.com`).

## 5. Dev y prod comparten la MISMA base de datos — 🔴 (causa raíz)

Confirmado por evidencia de archivo, mismo project ref de Supabase en los tres lugares:
- `.env` → `yrskhxzynvgvheovyjro.supabase.co`
- `.env.local` → mismo ref
- `wrangler.jsonc` (config que se despliega a producción) → mismo ref exacto

`SETUP.md:32-42` documenta un único proyecto Supabase, sin sección de "creá uno separado para dev". `SETUP.md:144-146` confirma explícitamente: *"El `.env.local` ya fue creado con las credenciales reales."* No hay `shadowDatabaseUrl` ni lógica condicional por entorno en `schema.prisma`.

**Esto es la causa raíz de los puntos 1 y 2**: no hay ninguna base "de prueba" separada — cualquier script corrido en la laptop local con el `.env` del repo escribe en la misma base que sirve `glamifymakeup.site`.

## ⚠️ Nota de seguridad — exposición de secreto durante esta auditoría

El subagente que hizo esta fase leyó `.env`/`.env.local` para comparar project refs y, en el proceso, un comando intermedio expuso el valor real de `MP_ACCESS_TOKEN` (token de producción, prefijo `APP_USR-...`) en su propia salida de herramienta. No se reproduce ese valor acá ni en ningún otro lado. **Recomendación por precaución: rotar `MP_ACCESS_TOKEN` en el dashboard de Mercado Pago** dado que quedó en la transcripción de una sesión de agente, y volver a cargarlo con `wrangler secret put MP_ACCESS_TOKEN`.

## REQUIERE INPUT — verificación directa en la DB real

Nadie de este lado tiene acceso a la DB de prod desde este entorno. Alguien con acceso a Supabase (SQL editor) tiene que correr:

```sql
-- Pedidos de simulación (marcador confiable)
SELECT o."orderNumber", o.status, o."contactEmail", o."createdAt", p."mpPaymentId", p.status AS payment_status, p.amount
FROM "Order" o JOIN "Payment" p ON p."orderId" = o.id
WHERE p."mpPaymentId" LIKE 'SIM-%';

-- Pedido/clientas de seed
SELECT "orderNumber", status, "contactEmail", "contactName", "createdAt" FROM "Order"
WHERE "contactEmail" IN ('sim@example.com','e2e@example.com') OR "orderNumber" = 'GLM-E2E001';

SELECT id, email, "createdAt" FROM "Customer" WHERE email ILIKE '%example.com' OR email ILIKE '%test%';
SELECT id, email, role, "createdAt" FROM "User" WHERE email ILIKE '%example.com' OR email ILIKE '%test%';
```

Si la primera query devuelve filas: hay evidencia dura de que `simulate-mp-webhook.ts` corrió contra la base real, con stock real ya decrementado y posiblemente un email real ya recibido por la dueña.

## Decisiones de negocio (no las resuelvo, las señalo)

1. Si el query de arriba devuelve filas: decidir si se extiende `cleanup-seed.ts` para borrarlas por `mpPaymentId LIKE 'SIM-%'`, y si hace falta restaurar a mano el stock decrementado.
2. ¿Agregar `isTest boolean @default(false)` a `Order`/`Payment` antes de lanzar? (migración de schema, no la implemento acá.)
3. ¿Separar Supabase dev/prod (segundo proyecto), o aceptar el riesgo y blindar los scripts con guard de entorno (`if (!process.env.DATABASE_URL?.includes("prod")) throw`, o similar)? Decisión de costo/arquitectura.

## Veredicto de la fase

🔴 **Bloqueante.** No es un problema de "puede que haya datos de prueba" — es que el repo, tal como está hoy, no tiene NINGUNA barrera entre "correr un comando en la laptop" y "escribir en la base que sirve a clientas reales". Antes de la primera venta real hay que, como mínimo: (a) confirmar con el SQL de arriba si ya hay contaminación, (b) decidir cómo se van a correr seeds/scripts de ahora en más sin este riesgo.
