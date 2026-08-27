# Auditoría de pre-lanzamiento — glamify-makeup

Objetivo: veredicto go/no-go por superficie antes de vender con plata real. Envíos MiCorreo ya auditado y cerrado (ver memoria `envios-micorreo-idempotencia`, `deploy-migracion-prod-flow`) — fuera de scope acá.

Naturaleza mixta: 3 de las 6 superficies no son verificables por código (plata real, saldo de cuenta externa, peso físico, alta AFIP) — en esas el resultado es evidencia parcial + REQUIERE INPUT, no un fix.

**Desvío deliberado del "una fase por sesión":** cada superficie es acotada (config + unos pocos archivos, no un sweep de miles de líneas) y el pedido fue "arrancá la auditoría" en una sesión — se corren las 6 en esta sesión, un report por fase igual, para mantener trazabilidad.

## Fases

1. **Pago real E2E** — código de checkout/webhook en modo producción (token MP, gates de mock, verificación de firma). No incluye ejecutar una compra real (decisión/plata del dueño).
2. **Datos de prueba en DB de prod** — pedidos/usuarios de test que haya que borrar antes de vender.
3. **Saldo prepago MiCorreo** — código de cara al saldo (si existe check), resto es estado de cuenta externa → REQUIERE INPUT.
4. **Pesos reales de productos** — weightGr cargado vs placeholder, impacto en cálculo de envío.
5. **Legal/fiscal Argentina** — CUIT visible, Términos y Condiciones, botón de arrepentimiento (Ley 24.240), facturación. Alta AFIP real → REQUIERE INPUT.
6. **Config de producción** — secrets vs vars públicas en Cloudflare, dominio verificado en Resend, `wrangler.jsonc`.

## Reports

Un archivo por fase en `docs/audit/reports/0N-<superficie>.md`.
