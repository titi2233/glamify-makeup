# Glamify Makeup — Runbook de lanzamiento (M5)

> La **mitad de código** de M5 ya está hecha y verificada (legales, arrepentimiento, a11y AA, perf, tests).
> Este runbook es la **mitad de ops**: lo ejecutás vos. Al terminarlo se cierra el DoD del milestone:
> **tienda en producción en `glamifymakeup.site`**.
>
> Regla de oro: los **secretos** van solo en `.env.local` y en los secrets de Cloudflare (`wrangler secret put`). Nunca en git ni en el chat.

## Orden de ejecución

### 1. Completar los datos legales del negocio
Editar `src/lib/legal/business-info.ts` y reemplazar **todos** los `[COMPLETAR: ...]`:
- `legalName` — razón social o nombre y apellido del/la titular
- `taxId` — CUIT/CUIL
- `taxCondition` — condición fiscal (ej. Monotributo)
- `address` — domicilio comercial/legal
- `email` — email de contacto
- `whatsapp` — WhatsApp con código país
- `jurisdiction` — jurisdicción para T&C
- `paymentMethods` — medios de pago aceptados

También revisar el copy `[COMPLETAR]` en `src/app/(storefront)/nosotras/page.tsx` (historia de marca).

Verificá que no quede ninguno:
```bash
pnpm test -- launch-readiness   # el warning debe listar 0 claves
```
> Para que `/contacto` muestre WhatsApp/IG/TikTok, cargá `Setting.whatsappNumber`, `instagramUrl`, `tiktokUrl`
> en la DB (panel `/admin` o seed). El WhatsApp FAB también depende de `Setting.whatsappNumber`.

### 2. Cargar el catálogo real
- Subir productos, variantes (tono + stock + SKU) y fotos desde `/admin` (las imágenes van a Supabase Storage).
- Alternativa: adaptar `prisma/seed.ts` y correr `pnpm db:seed`.
- Revisá que haya categorías, destacados y combos para que la home no quede vacía.

### 3. Credenciales de producción (secrets de Cloudflare)
```bash
wrangler secret put DATABASE_URL          # pooled 6543 (?pgbouncer=true)
wrangler secret put DIRECT_URL            # direct 5432 (migraciones)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put MP_ACCESS_TOKEN       # token PROD de Mercado Pago (no TEST)
wrangler secret put MP_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM           # ej. "Glamify Makeup <hola@glamifymakeup.site>"
wrangler secret put RESEND_OWNER_EMAIL    # email donde caen alertas (pedidos + arrepentimientos)
```
Variables públicas (`NEXT_PUBLIC_*`) van en `wrangler.jsonc → [vars]` o dashboard:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL=https://glamifymakeup.site`,
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_WELCOME_COUPON_CODE`.

- **Resend:** verificar el dominio `glamifymakeup.site` (registros SPF/DKIM) para entregabilidad.
- **Mercado Pago:** configurar la URL del webhook de PROD apuntando a `https://glamifymakeup.site/api/webhooks/mercadopago` y excluir efectivo (Checkout Pro).
- **MiCorreo (envíos, cotización en vivo):** cargar los secrets `MICORREO_EMAIL`, `MICORREO_PASSWORD`,
  `MICORREO_GATEWAY_AUTH` y `MICORREO_SANDBOX` (`"true"`/`"false"` — ausente cae al lado seguro, API PROD;
  ver `docs/decisions/0001-shipping-provider.md` para qué es cada uno).
  Sin ellos la cotización cae a la tabla de zonas (ya recalibrada al costo real, así que no hay
  pérdida grave). Verificar con `pnpm micorreo:probe` — debe dar ~$6.113 a sucursal para La Plata (1900).
  Opcionales: `MICORREO_VELOCITY` (`classic` por defecto / `express`), `MICORREO_ORIGIN_CP` (6700).
  - Zipnova fue **cancelado** (markup ~2x); `lib/shipping/zipnova.ts` y sus secrets quedan sin uso.
  - Requisito operativo (no de código): la cuenta MiCorreo se debita de un **saldo prepago** al crear
    cada envío; cargar crédito antes de la primera venta.

### 4. Aplicar la migración M5 a la base
La migración `20260606120000_m5_retraction_request` (tabla `RetractionRequest` del Botón de Arrepentimiento)
está versionada pero **aún no aplicada**. En el entorno con `DIRECT_URL` de PROD:
```bash
pnpm exec prisma migrate deploy
```
> Es aditiva (solo crea enum + tabla + índices); no toca datos existentes.

### 5. DNS + dominio
- Apuntar `glamifymakeup.site` a Cloudflare (nameservers o registro).
- En el Worker → **Custom Domains** → agregar `glamifymakeup.site` (Cloudflare gestiona SSL).

### 6. Deploy
```bash
pnpm deploy        # build:worker + wrangler deploy
```
o auto-deploy desde `main` (mergear la rama `m5-pulido-qa-launch` a `main` primero).

### 7. Verificación en producción
- **Lighthouse** en `https://glamifymakeup.site` (mobile): a11y ≥ 90, best-practices ≥ 90, perf razonable, **CLS < 0.1**, **LCP** real (en local da ~2.3s dominado por TTFB de dev; en PROD con edge + Hyperdrive debe bajar fuerte).
- Verificar que **`/robots.txt`** valide en PROD (en dev Lighthouse lo marca por la negociación RSC de Next; en el Worker se sirve estático).
- E2E en CI verdes (incluye `a11y.spec.ts` y `legal.spec.ts`).
- Probar el **Botón de Arrepentimiento**: enviar el form → ver constancia `ARR-000001` → confirmar que llega el email a `RESEND_OWNER_EMAIL`.
- Revisar el footer: todos los links legales/contenido y el FAB de WhatsApp visibles.

### 8. Compra real de prueba (cierra el DoD)
Flujo completo end-to-end con tarjeta real (monto chico):
catálogo → carrito → checkout → **Mercado Pago PROD** → webhook → estado del pedido `paid` → emails (clienta + dueña).
Verificar que el stock se descuente y el pedido aparezca en `/admin/pedidos`.

---

## Qué ya quedó hecho y verificado (código)
- Páginas: `/terminos`, `/privacidad`, `/arrepentimiento` (form + constancia), `/contacto`, `/nosotras`, `/preguntas-frecuentes`, `/envios-y-pagos`.
- Footer con legales + Botón de Arrepentimiento; rutas en `sitemap`.
- WhatsApp FAB site-wide (condicionado a `Setting.whatsappNumber`).
- Accesibilidad WCAG AA: **0 violaciones axe** (wcag2a/2aa/21a/21aa) en home, tienda, producto, carrito, ingresar, arrepentimiento, términos, FAQ, contacto. Lighthouse a11y **100**. Skip-link + landmark `main`.
- Performance: **CLS 0.00**, imágenes con `aspect-ratio` reservado, LCP image con `priority`, fuentes `swap`.
- Tests: 356 unit/integración verdes + e2e axe/legales para CI.
