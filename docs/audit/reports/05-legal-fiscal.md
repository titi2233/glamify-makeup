# Fase 5 — Legal/fiscal Argentina

## 1. Páginas legales obligatorias — 🟢

| Página | Ruta | Estado |
|---|---|---|
| Términos y Condiciones | `/terminos` | Completa (proveedor, precios, contrato, envíos, art. 34 Ley 24.240, garantía, privacidad, jurisdicción) |
| Política de Privacidad | `/privacidad` | Cita Ley 25.326, derechos ARCO con plazos, autoridad de control (AAIP) |
| Botón de Arrepentimiento | `/arrepentimiento` | Cita art. 34 Ley 24.240 y Res. 424/2020, formulario funcional con constancia `ARR-000001`, email de confirmación |

Linkeadas desde el footer global (`site-footer.tsx:24-32`). Cubierto por `tests/e2e/legal.spec.ts`.

## 2. CUIT visible — 🟡

`src/lib/legal/business-info.ts:5-16`: `taxId: "27-44380532-5"`, `taxCondition: "Monotributista Social"` (cargado en commit `f88925e`, reemplazó un placeholder). Visible en `/terminos` y `/privacidad` únicamente — **no** en footer ni en checkout ni en los emails. Público pero no "a un click": una clienta tiene que entrar a una página legal para verlo. No es incumplimiento (la ley no exige footer), pero es menos visible que el estándar del rubro.

## 3. Facturación electrónica / AFIP — 🔴

Sin ningún mecanismo en el flujo: no hay campo de CUIT/DNI del comprador en checkout, no hay tipo de comprobante, el email de confirmación (`orderConfirmationEmail`) no incluye número de comprobante fiscal ni CAE, y no hay modelo en `prisma/schema.prisma` para eso. Es 100% manual fuera del sistema, o directamente inexistente — el código no puede distinguir cuál de las dos.

**La facturación electrónica ante AFIP es obligatoria en Argentina para toda venta, incluso en monotributo — es una obligación separada de Defensa del Consumidor.**

## 4. Blueprints — 🔴 ausencia total, no scope diferido consciente

`facturación`/`AFIP`/`comprobante fiscal`: 0 resultados en `blueprints/` (00-09), en `TODO.md`, y en `docs/LAUNCH.md` (runbook de M5). Las páginas legales (T&C/privacidad/arrepentimiento) sí están documentadas como requisito ("obligatorio por ley AR") en `blueprints/02` y `07`. La facturación simplemente no fue evaluada en ningún doc de scope — no es que se pospuso a propósito.

## 5. Checkbox de aceptación de términos en checkout — 🔴

`checkout-form.tsx` no tiene checkbox ni link a `/terminos`, solo el botón "Pagar con Mercado Pago" con el texto "Pago seguro. Te redirigimos a Mercado Pago." La única cobertura es el texto corrido de `/terminos` ("Al navegar o realizar un pedido, aceptás estos términos") — aceptación implícita, sin trazabilidad server-side (no hay `termsAcceptedAt` en `Order`).

## REQUIERE INPUT

1. **¿Se está emitiendo factura electrónica AFIP manualmente por cada venta (portal AFIP/Monotributo)?** Si no, es incumplimiento fiscal activo — no verificable ni resoluble desde el código.
2. ¿El alta ante AFIP / inscripción Monotributista Social del CUIT `27-44380532-5` está vigente? El código solo refleja lo cargado en `business-info.ts`, no valida la inscripción real.
3. Validez legal de los textos de `/terminos` y `/privacidad`: no hay evidencia de revisión por abogado (son textos genéricos consistentes con la normativa citada, no una validación jurídica).
4. Decisión de producto: ¿agregar checkbox de aceptación de T&C en checkout y/o mostrar CUIT en footer/checkout?

## Veredicto de la fase

🔴 **Hay un gap real y no bloqueante-de-código pero sí bloqueante-legal**: falta el mecanismo de facturación (o al menos confirmar que se hace manual) y falta aceptación explícita de términos en el checkout. Las páginas legales de consumidor están sólidas; lo fiscal (AFIP) no fue contemplado en ningún lado del proyecto.

## Fix aplicado (2026-08-28) — checkbox de T&C

Decisión del dueño: agregar el checkbox. `src/app/(storefront)/checkout/checkout-form.tsx` — nuevo estado `acceptedTerms`, nueva regla en `validate()` ("Tenés que aceptar los Términos y Condiciones."), checkbox + links a `/terminos` y `/privacidad` antes del botón de pago. Mínimo a propósito: sin persistir `termsAcceptedAt` en `Order` (no hay migración de schema) — si se quiere trazabilidad legal más fuerte (poder probar que una clienta puntual aceptó), es un paso aparte.

Verificado en el navegador real (dev local, no solo unit test): sin tildar → bloquea con el mensaje esperado, no llega a llamar a Mercado Pago. Con el checkbox tildado → pasa la validación y sí llama a la Server Action real (confirmado porque llegó hasta un error real de la API de Mercado Pago por `back_url` en `http://localhost` — límite conocido de probar en local, no un bug). `pnpm typecheck`/`pnpm lint`/`pnpm test` (465/465) verdes.

Facturación AFIP: sigue sin resolver — decisión de negocio, ver conversación con el dueño (necesita un modelo de facturación, no un fix de código).
