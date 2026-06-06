# M5 — Pulido, QA y Launch (mitad de código) — Diseño

> Estado: ✅ aprobado · Fecha: 2026-06-06 · Rama: `m4b-conversion` (se trabaja sobre la rama de milestone)
> Fuente de verdad: blueprints `02` (storefront/legales/a11y) y `07` (seguridad/tests). Scope diferido en `TODO.md`.

## 1. Contexto y recorte

M5 (blueprint 08/09) mezcla **trabajo de código** (que hago y verifico acá) con **ops de lanzamiento**
(que requiere secretos/datos/infra y ejecutás vos). Este spec cubre **la mitad de código**; la mitad de
ops se entrega como **runbook** (§10) y cierra el DoD del milestone (`tienda en producción en glamifymakeup.site`).

**Restricciones del entorno (memoria de sesiones previas):**
- En Windows **no** corren localmente `build:worker`, el build standalone ni Playwright e2e (EPERM symlink).
  → Verificación local = `pnpm typecheck` + `pnpm test` (unit/integración) + `pnpm dev` + Lighthouse/axe vía chrome-devtools MCP. Los e2e corren en CI/Linux.
- No hay `gh` CLI: el PR se abre con `git push` + la URL de compare.
- En worktree, Prisma CLI + scripts `tsx` necesitan `.env` (no solo `.env.local`).

## 2. Alcance (código)

1. **Páginas legales:** `/terminos`, `/privacidad`, `/arrepentimiento` (con formulario), link a Defensa del Consumidor.
2. **Contacto:** `/contacto` **informativo** (email, WhatsApp, IG/TikTok, horarios) — **sin formulario**.
3. **Contenido:** `/nosotras`, `/preguntas-frecuentes`, `/envios-y-pagos`.
4. **Botón de Arrepentimiento** (Res. 424/2020): formulario que registra la solicitud, notifica a la dueña y devuelve **constancia con número**.
5. **Footer + navegación:** reemplazar placeholders deshabilitados por links reales; agregar rutas al `sitemap`.
6. **WhatsApp FAB:** botón flotante en toda la tienda (blueprint 02 §6).
7. **Accesibilidad WCAG AA:** skip-link, foco, teclado, contraste, `alt`/`aria`, `prefers-reduced-motion`.
8. **Performance LCP/CLS:** auditoría Lighthouse en localhost + fixes.
9. **Tests:** unit + integración (corren local) + e2e/axe (CI). Test de *launch-readiness* como **warning no bloqueante**.

**Fuera de scope (a runbook / diferido):** carga de catálogo real, credenciales PROD (MP/MiCorreo/Resend),
DNS, deploy, Lighthouse en PROD, compra real. Admin CRUD de solicitudes de arrepentimiento (la dueña actúa por email; ver §4).

## 3. Datos del negocio — fuente única

`src/lib/legal/business-info.ts`: módulo con constantes y placeholders `[COMPLETAR: ...]`. Todas las páginas
legales/contenido lo consumen ⇒ un solo archivo para completar antes del launch.

```ts
export const PLACEHOLDER_PREFIX = "[COMPLETAR";
export const businessInfo = {
  legalName: "[COMPLETAR: razón social o nombre y apellido del/la titular]",
  taxId: "[COMPLETAR: CUIT/CUIL]",
  taxCondition: "[COMPLETAR: condición fiscal (ej. Monotributo)]",
  address: "[COMPLETAR: domicilio comercial/legal]",
  email: "[COMPLETAR: email de contacto]",
  whatsapp: "[COMPLETAR: WhatsApp con código país, ej. +54 9 ...]",
  jurisdiction: "[COMPLETAR: jurisdicción (ej. Tribunales de la Pcia. de Buenos Aires)]",
  retractionDays: 10,            // art. 34 Ley 24.240 — días corridos
  paymentMethods: "[COMPLETAR: medios de pago aceptados]",
} as const;
```

Helper de validación (testeado): `findIncompletePlaceholders(): string[]` recorre los valores y devuelve las claves que aún tienen `[COMPLETAR`.

## 4. Botón de Arrepentimiento — formulario + constancia

**Modelo (migración aditiva, no toca tablas existentes):**

```prisma
enum RetractionStatus { pending processed rejected }

model RetractionRequest {
  id           String           @id @default(uuid()) @db.Uuid
  seq          Int              @unique @default(autoincrement()) // constancia: ARR-000123
  orderNumber  String?          // pedido referenciado por el consumidor (opcional)
  contactName  String
  contactEmail String
  contactPhone String?
  reason       String?
  status       RetractionStatus @default(pending)
  createdAt    DateTime         @default(now())

  @@index([status])
}
```

- Constancia = `formatRetractionTicket(seq)` → `ARR-000123` (mismo patrón que `formatOrderNumber`). Se **deriva de `seq`**, no se guarda columna extra.
- **Validación** `src/lib/legal/retraction/validation.ts`: email válido, nombre (2–80), `orderNumber`/`phone`/`reason` opcionales con límites, honeypot vacío.
- **Servicio** `src/lib/legal/retraction/service.ts`: `createRetractionRequest(input, { db, sendEmail })` con deps inyectables (patrón del repo) → crea registro, envía email a la dueña (`ADMIN_EMAIL`/`SETTING` o `RESEND_FROM` fallback; sin `RESEND_API_KEY` loguea a consola) y devuelve `{ ticket }`.
- **Server action** `src/app/(storefront)/arrepentimiento/actions.ts`: `requestRetractionAction(input): Promise<RetractionActionResult>` (extiende `ActionResult` con `ticket?`).
- **Client form** `retraction-form.tsx`: `useState` + `onSubmit`/`preventDefault` + `FormData` + honeypot oculto (igual a `review-form.tsx`); al ok muestra la **constancia** (número + texto) en pantalla.
- **Página** `/arrepentimiento`: explica el derecho (art. 34, `retractionDays` días corridos, sin costo), cómo ejercerlo, plazos de reintegro, link a Defensa del Consumidor, y el formulario.
- **Visibilidad (norma):** link "Botón de arrepentimiento" en el **footer** (site-wide ⇒ visible en home).
- **Email a la dueña:** plantilla nueva en `src/lib/email/templates.ts` (`retractionAlertEmail`) con datos de la solicitud + constancia.

> La dueña procesa la solicitud por fuera (contacto directo). Un CRUD admin de solicitudes queda **diferido** (`TODO.md`); el registro en DB + email cumplen el requisito de constancia y trazabilidad.

## 5. Páginas legales/contenido

Server Components con el design system existente (`container`, tipografía Playfair/Nunito, tokens). Estructura
común: `<h1>` + secciones `<section>` con headings jerárquicos (a11y). Metadata por página (`title`/`description`).
Contenido legal correcto para AR con `[COMPLETAR]` para datos del negocio:

- `/terminos` — identificación del proveedor, objeto, precios en ARS, formas de pago, formación del contrato, envíos, derecho de arrepentimiento (link), garantías (Ley 24.240), jurisdicción.
- `/privacidad` — Ley 25.326: responsable, datos recolectados, finalidad, consentimiento, derechos ARCO, baja, AAIP, cookies/analytics (PostHog opt-out ya implementado).
- `/contacto` — email, WhatsApp (`wa.me`), IG/TikTok (de `Setting`), horarios y tiempo de respuesta. **Sin form.**
- `/nosotras` — historia/propuesta de marca (copy `[COMPLETAR]`).
- `/preguntas-frecuentes` — FAQ (envíos, pagos, cambios, tiempos) en `<Accordion>` o `<details>` accesible.
- `/envios-y-pagos` — política de envíos (zonas, envío gratis, plazos), medios de pago.

## 6. Footer + sitemap

- `site-footer.tsx`: columnas **Tienda** / **Ayuda** (Contacto, FAQ, Envíos y pagos, Nosotras) / **Legales** (Términos, Privacidad, **Botón de arrepentimiento**, link Defensa del Consumidor). Medios de pago: texto real o `[COMPLETAR]`. Todos los targets ≥44px, foco visible.
- `src/app/sitemap.ts`: agregar las rutas estáticas nuevas.

## 7. WhatsApp FAB

`src/components/layout/whatsapp-fab.tsx` (Server Component que lee `Setting.whatsappNumber`; **no renderiza si está vacío**).
- `<a href="https://wa.me/<num>?text=...">` con `aria-label="Consultar por WhatsApp"`, ícono Lucide (`MessageCircle`), `target="_blank" rel="noopener"`.
- Posición `fixed bottom-24 right-4 md:bottom-6` (sobre el bottom-nav en mobile; no tapa CTAs), `z` por debajo de drawers/diálogos.
- Tamaño táctil ≥44px, sombra soft, `transition` con `motion-reduce:transition-none`.
- Montado en `(storefront)/layout.tsx`.

## 8. Accesibilidad (WCAG AA)

- **Skip-link** "Saltar al contenido" (visible al focus) + `id="main"` y `tabIndex={-1}` en `<main>` del layout.
- **Auditoría multi-agente** (workflow) sobre páginas clave (home, tienda, producto, carrito, checkout, ingresar, legales): axe (vía chrome-devtools MCP injectando axe-core), navegación por teclado, foco visible, `alt`/`aria-label` en íconos, orden de headings, `prefers-reduced-motion`. Cada hallazgo se **verifica** antes de arreglar.
- **Contraste:** verificar el riesgo conocido (blueprint 02 §2) de `#FF2E93` con texto chico (~3:1) → usar `#E01E7D`/texto vino o texto grande donde falle AA. Confirmar que el color **no es el único indicador** (badges con ícono+texto).
- Specs Playwright + `@axe-core/playwright` para CI.

## 9. Performance (LCP/CLS)

- Lighthouse vía chrome-devtools MCP contra `pnpm dev` (localhost). Foco: **CLS** (aspect-ratio en imágenes/hero, reserva de espacio), **LCP** (hero, `next/font` swap ya OK, prioridad de imagen), code-split de lo no crítico.
- Fixes concretos según hallazgos. Números reales de PROD → runbook (localhost es indicativo, sin red real).

## 10. Runbook de lanzamiento (entrego; ejecutás vos)

`docs/LAUNCH.md` con checklist:
1. Completar `src/lib/legal/business-info.ts` (todos los `[COMPLETAR]`) + medios de pago del footer. Verificar con `pnpm test` (warning de launch-readiness debe quedar en 0).
2. Cargar catálogo real (`/admin` o ajustar `prisma/seed.ts`) con fotos en Supabase Storage.
3. Secrets PROD (Cloudflare): `MP_ACCESS_TOKEN` (prod), `MP_WEBHOOK_SECRET`, `RESEND_API_KEY` (+ dominio `glamifymakeup.site` verificado SPF/DKIM en Resend), `RESEND_FROM`, MiCorreo (si aplica), `DATABASE_URL`/`DIRECT_URL`.
4. DNS de `glamifymakeup.site` → Cloudflare; Custom Domain en el Worker.
5. Migración en PROD (`prisma migrate deploy` con `DIRECT_URL`).
6. Deploy (`pnpm deploy` / auto-deploy desde `main`).
7. Lighthouse en PROD (a11y ≥90, perf razonable, CLS<0.1).
8. **Compra real de prueba** end-to-end (catálogo → carrito → MP prod → webhook → emails → estado).

## 11. Plan de verificación (esta sesión)

- `pnpm typecheck` verde.
- `pnpm test` verde (unit + integración nuevos y existentes).
- Lighthouse a11y/perf en localhost vía chrome-devtools (evidencia: scores antes/después).
- Revisión manual de teclado/foco en páginas nuevas.
- `superpowers:requesting-code-review` antes de cerrar.

## 12. Decisiones

- **D-M5-1** — Datos del negocio: módulo único con `[COMPLETAR]`, no `Setting`/DB.
- **D-M5-2** — Arrepentimiento: formulario + constancia (DB `RetractionRequest` + email a dueña). CRUD admin diferido.
- **D-M5-3** — `/contacto` informativo, sin formulario.
- **D-M5-4** — Páginas extra incluidas: `/nosotras`, `/preguntas-frecuentes`, `/envios-y-pagos`.
- **D-M5-5** — Launch-readiness test = **warning no bloqueante** (la suite pasa hoy con placeholders).
- **D-M5-6** — WhatsApp FAB site-wide, condicionado a `Setting.whatsappNumber`.
- **D-M5-7** — Ops de launch = runbook (`docs/LAUNCH.md`); el DoD de producción depende de su ejecución.
