# M4b — Conversión + Crecimiento · Design Spec

> Estado: aprobado por el usuario (2026-06-06). Fuente de verdad: blueprints `06` (conversión/crecimiento), `02` (storefront/UX), `03` (panel), `01` (dominio), `07` (infra/testing) + el código en disco.
> Milestone: **M4b ("Conversión + Crecimiento")** — la mitad diferida del M4 de blueprint 08/09. Rama: `m4b-conversion` (off HEAD de `m4-cuentas`).

## 0. Objetivo y DoD

Cerrar las palancas de conversión y crecimiento del blueprint 06: **order-bump** y **cross-sell** "Te puede gustar", **exit-intent sutil** (email + cupón de bienvenida), **analytics PostHog** con consentimiento, **SEO + Open Graph** (metadata, sitemap, robots, datos estructurados) y **moderación de reseñas** en el panel (abrir reseñas + aprobar/rechazar).

**Decisiones tomadas (2026-06-06):**
- Reseñas: **abrir + moderar (híbrido)** — cualquiera reseña; compra verificada → auto-aprobada (badge); invitada/no-compradora → `pending` → la dueña aprueba/rechaza.
- Order-bump / cross-sell: **por tags** (campo `Product.tags` existente). Tag `order-bump`; cross-sell por misma categoría.
- Exit-intent: **email + cupón de bienvenida** (captura email → recupero de carrito + revela cupón real configurable).
- Analytics: **banner opt-out** (PostHog carga por defecto; rechazo desactiva captura).

**Sin migración de DB.** Todo reusa campos existentes (`Review.status`, `Review.customerId` nullable, `Review.verifiedPurchase`, `Product.tags`, `Cart.contactEmail`, `Cart.recoveryEmailConsent`). El seed agrega 1 cupón + 1 tag.

**DoD (verificación):**
- Una **invitada** deja una reseña → queda `pending` y **no** aparece en la ficha; la dueña la ve en `/admin/resenas` y puede **Aprobar** (pasa a publicada) o **Rechazar**.
- Una **compradora verificada** sigue auto-publicando (badge "Compra verificada").
- **Order-bump** visible y funcional en carrito/checkout; **"Te puede gustar"** en ficha y carrito.
- **Exit-intent** se muestra una sola vez, captura email (consentimiento) y revela el cupón.
- **PostHog** activo con banner de consentimiento opt-out; eventos clave emitidos.
- **SEO**: `sitemap.xml` y `robots.txt` vivos; ficha emite JSON-LD de producto y comparte con OG (foto real); home con OG/JSON-LD de sitio.
- `pnpm typecheck` + `pnpm test` verdes. E2E nuevos corren en CI.

## 1. Scope

**IN (M4b):**
1. Reseñas abiertas + moderación (híbrido) + UI de panel aprobar/rechazar.
2. Order-bump (por tag) en carrito (drawer + `/carrito`) y checkout.
3. Cross-sell "Te puede gustar" (misma categoría) en ficha y `/carrito`.
4. Exit-intent sutil (una vez): captura email → cart recovery + revela cupón de bienvenida real.
5. PostHog (analytics) con banner de consentimiento opt-out + eventos clave + UTM (autocapture).
6. SEO: metadata por página (OG/Twitter/canonical), `sitemap.ts`, `robots.ts`, datos estructurados (JSON-LD Product + AggregateRating, WebSite/Organization).

**OUT → quedan en `TODO.md`:**
- **Estética IA / assets generados** (06 §5): hero/secciones/banners y **OG image de marca** generadas con IA. M4b usa foto real de producto como OG; OG de marca dedicada = asset diferido.
- **Fotos en reseñas** (la entidad ya tiene `photoUrl`; el alta sigue rating+título+cuerpo).
- Abandonado de 2 etapas (1h+24h) y WhatsApp; libreta de direcciones; magic link.
- Captcha en reseñas (v1 usa honeypot + cola de moderación).

## 2. Convenciones (seguir el patrón existente)

- **Lecturas** en Server Components / funciones `src/lib/<domain>/*` con `"server-only"`; **mutaciones** en Server Actions que devuelven `ActionResult { ok, error }`.
- **Lógica pura** en `src/lib/<domain>/*` (sin I/O) → tests `unit`. **Servicios** con `deps` inyectable (`deps.db`) → tests `integration` (mock `vi.fn`).
- Admin sigue en `src/app/admin/(panel)/*` con `requireAdmin()` (mirror del patrón de `pedidos`/`cupones`). Storefront en `src/app/(storefront)/*`.
- TypeScript strict, nunca `any`. Montos `Decimal(12,2)` → coerción a `number` en el borde (patrón `toNumber`/`Number(...)` ya usado). Timestamps UTC.
- UI con tokens del design system (`design-system/MASTER.md`), Lucide icons, `prefers-reduced-motion`, touch ≥44px, contraste ≥4.5:1.
- `pnpm typecheck` + `pnpm test` después de cada cambio.

## 3. Reseñas — abrir + moderar (híbrido)

### 3.1 Pura
- `src/lib/reviews/moderation.ts` → `classifyReview({ isLoggedIn, hasPurchased }): { status: ReviewStatus; verifiedPurchase: boolean }`:
  - `hasPurchased === true` → `{ status: "approved", verifiedPurchase: true }`.
  - resto (logueada-no-compradora **o** invitada) → `{ status: "pending", verifiedPurchase: false }`.
- `validateReview` (existente) se extiende para el caso invitada: si `customerId == null`, `authorName` requerido (trim, 2–60 chars). Body 1–2000, title ≤120 (sin cambios).

### 3.2 Servicio + actions
- `src/lib/reviews/service.ts` — `createReview` **reescrito**:
  - `CreateReviewInput`: `{ customerId: string | null; authorName: string; customerEmail?: string | null; productId; rating; title?; body }`.
  - Si `customerId != null`: chequea `@@unique([customerId, productId])` (ya existe → error "Ya dejaste tu reseña…") y calcula `hasPurchased` (query `orderItem` existente). Si `customerId == null` (invitada): sin unique, `hasPurchased=false`.
  - Llama `classifyReview` → setea `status` + `verifiedPurchase`. `authorName = input.authorName` (logueada: name ?? email; invitada: el nombre del form).
  - **Ya no lanza error** "solo quienes compraron pueden reseñar": la no-compradora entra a `pending`.
- `src/lib/reviews/service.ts` — `moderateReview(id, action: "approve" | "reject", deps)` → update `status` (`approve`→`approved`, `reject`→`rejected`).
- `src/lib/reviews/queries.ts` — `getModerationQueue()` → reseñas `pending` (con `product: { name, slug }`, autor, rating, fecha) orden desc.
- **Storefront action** (`producto/[slug]/review-actions.ts`): ya no exige `requireCustomer`; usa `getCustomer()` (puede ser null). Pasa `customerId`, `authorName` (de customer o del form si invitada), honeypot check (campo `website` debe venir vacío → si no, retorna `{ ok:true }` sin crear, para no dar feedback al bot). `revalidatePath`.
- **Admin actions** (`admin/(panel)/resenas/actions.ts`): `requireAdmin()` → `approveReviewAction(id)` / `rejectReviewAction(id)` → `moderateReview` → `revalidatePath("/admin/resenas")` + `revalidatePath` de la ficha.

### 3.3 UI
- **Form** `producto/[slug]/review-form.tsx`: visible para todas.
  - Logueada: igual que hoy + nota "Si no compraste este producto, tu reseña se publica tras revisión."
  - Invitada: agrega `<Input name="authorName">` (Nombre, requerido) + nota "Tu reseña se publica tras la revisión de la dueña." + CTA opcional "¿Ya tenés cuenta? Iniciá sesión".
  - **Honeypot**: `<input name="website" tabIndex={-1} className="hidden" autoComplete="off">`.
  - Mensaje de éxito condicional: si quedó `pending` → "¡Gracias! Tu reseña se publicará tras revisión."; si `approved` → "¡Gracias! Ya está publicada." (la action devuelve `{ ok, status }`).
- **Ficha** `producto/[slug]/page.tsx`: reemplaza el bloque "solo quienes compraron…" por el form abierto. Display sin cambios (solo `approved`).
- **Panel** `admin/(panel)/resenas/page.tsx`: tabla (producto + link a ficha, autor, rating con `RatingStars`, extracto del body, fecha) + acciones Aprobar/Rechazar (`ConfirmDialog`). `PageHeader` "Reseñas — Moderación".
- **Sidebar** `components/admin/admin-sidebar.tsx`: ítem `{ href:"/admin/resenas", label:"Reseñas", icon: Star }`. La grilla mobile pasa de `grid-cols-6` a `grid-cols-7` (o se reagrupa) — ajustar para que entren 7 ítems sin romper touch targets.

## 4. Order-bump + cross-sell (por tags)

### 4.1 Recomendaciones
- `src/lib/catalog/recommendations.ts`:
  - `getOrderBumpProducts(): Promise<CatalogProduct[]>` — productos activos, no borrados, con `"order-bump"` en `tags`, con stock>0 en alguna variante activa, `include` estándar.
  - `getRelatedProducts(productId, categoryId, limit=4): Promise<CatalogProduct[]>` — misma categoría, activos, excluye `productId`, orden `isFeatured desc, createdAt desc`, `take=limit`.
  - `getCartCrossSell(cartCategoryIds, excludeProductIds, limit=4)` — productos de esas categorías excluyendo los del carrito.
- **Puras** (unit): `selectOrderBump(candidates, cartVariantIds): BumpOffer | null` — filtra los que ya están en el carrito (por variante por defecto), elige el de **menor precio efectivo**; devuelve `{ productId, variantId, name, image, price }`. `rankRelated(products, limit)` — featured primero, corta a `limit`.

### 4.2 UI
- `src/components/cart/order-bump.tsx` (server: resuelve candidatos; client child para el botón optimista) — compacto: "✨ Sumá **[nombre]** a $X" + botón **Agregar** → `addToCartAction({ variantId })` → `router.refresh()`. Emite `order_bump_added`.
  - Render en `CartContents` (drawer), `/carrito` y `/checkout` (encima del resumen). No mostrar si no hay candidato elegible.
- `src/components/catalog/cross-sell.tsx` — "Te puede gustar" + `ProductGrid` (limit 4). Render en ficha (`producto/[slug]/page.tsx`) y `/carrito`.

## 5. Exit-intent (email + cupón de bienvenida)

- `src/components/marketing/exit-intent.tsx` (client) montado en `(storefront)/layout.tsx`:
  - Trigger desktop: `document`/`mouseleave` con `e.clientY <= 0`. Mobile: fallback por inactividad (p. ej. 25s sin scroll) **o** scroll-up rápido. Una sola vez por visitante (`localStorage glamify_exit_seen`).
  - No dispara si el banner de consentimiento sigue visible (coordinación por `localStorage`/estado). Respeta `prefers-reduced-motion` (sin animación de entrada si está activo).
  - Modal accesible (reusa `Dialog` de Radix ya instalado): título "Llevate 10% OFF en tu primera compra", input email, botón "Quiero mi descuento".
  - Submit → `captureExitIntentAction({ email })` → en éxito revela el código de cupón (de `NEXT_PUBLIC_WELCOME_COUPON_CODE`) con botón "Copiar". Emite `exit_intent_submitted`; al mostrarse, `exit_intent_shown`.
- **Server action** `src/app/(storefront)/marketing-actions.ts` → `captureExitIntentAction({ email })`:
  - Valida email. Toma/crea cart activo (reusa `ensureCartId`/cookie). Setea `contactEmail = email`, `recoveryEmailConsent = true` (alimenta `runAbandonedCartJob` de M4). Devuelve `{ ok, couponCode }` (de env; si vacío, `couponCode: null`).
- **Cupón**: código vía `NEXT_PUBLIC_WELCOME_COUPON_CODE`. Si vacío → modal cae a **solo captura de email** (sin revelar código). Seed crea `BIENVENIDA10` (type `percentage`, value 10, scope `all`, `perCustomerLimit: 1`, `active: true`). El checkout existente valida/aplica cupones reales sin cambios.

## 6. PostHog + consentimiento (opt-out)

- Dependencia `posthog-js` (corre en el **browser**, no en el worker → sin impacto en `build:worker`).
- `src/components/analytics/posthog-provider.tsx` (client) montado en `(storefront)/layout.tsx`:
  - Init solo si `NEXT_PUBLIC_POSTHOG_KEY` presente (sin key → no-op; dev local intacto). Host `NEXT_PUBLIC_POSTHOG_HOST` (default `https://us.i.posthog.com`). `capture_pageview` automático + `autocapture` (incluye UTM).
  - Consentimiento **opt-out**: captura ON por defecto. Lee cookie `glamify_analytics`; si `=== "no"` → `posthog.opt_out_capturing()`.
- `src/components/analytics/cookie-consent.tsx` (client) — banner sutil inferior, una vez (cookie `glamify_analytics` no seteada): "Usamos cookies para mejorar tu experiencia." + **Aceptar** (cookie `yes`) / **Rechazar** (cookie `no` + `opt_out_capturing`). Link a futura política (placeholder `/privacidad` o texto). Respeta tokens + touch targets.
- `src/lib/analytics/track.ts` — wrapper tipado `track(event, props?)` (no-op si PostHog no init). Eventos:
  - `product_viewed` (ficha), `add_to_cart` (en `add-to-cart.tsx` y order-bump), `begin_checkout` (checkout), `purchase` (`/checkout/gracias` con orderNumber + total), `order_bump_added`, `exit_intent_shown`/`exit_intent_submitted`, `review_submitted`.
- **Workers**: PostHog es client-only; no se importa en server/worker. `wrangler.jsonc [vars]` + `.env.example`: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.

## 7. SEO + Open Graph

- **Root** `app/layout.tsx`:
  - `metadataBase: new URL(NEXT_PUBLIC_APP_URL)`, `openGraph` (type website, siteName "Glamify Makeup", locale es_AR, default title/desc), `twitter: { card: "summary_large_image" }`, `robots: { index:true, follow:true }`, `applicationName`.
- **Por página** `generateMetadata` + `alternates.canonical`:
  - Ficha (`producto/[slug]`): suma `openGraph.images = [absoluteUrl(product.images[0])]`, `openGraph.type = "website"` (Next no tipa "product" en OG estándar; usar website), canonical `/producto/[slug]`.
  - Categorías (`tienda`, `tienda/[categoria]`, `[subcategoria]`): title/desc por categoría + OG (foto de categoría o producto destacado) + canonical.
  - Home: OG con imagen de producto destacado (fallback brand) + canonical `/`.
- **`app/sitemap.ts`** (`MetadataRoute.Sitemap`): home, `/tienda`, cada categoría/subcategoría activa, cada producto activo (`getActiveProductSlugs`), con `lastModified` razonable.
- **`app/robots.ts`** (`MetadataRoute.Robots`): `allow: "/"`, `disallow: ["/admin", "/cuenta", "/checkout", "/api", "/ingresar"]`, `sitemap: <APP_URL>/sitemap.xml`.
- **Datos estructurados** `src/lib/seo/jsonld.ts` (puro):
  - `buildProductJsonLd(product, { average, count }, url)` → `Product` + `offers` (price ARS, availability según stock) + `aggregateRating` (solo si `count>0`).
  - `buildWebSiteJsonLd()` / `buildOrganizationJsonLd()` para home.
  - Render con `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />` en la ficha y home.
- **OG image absoluta**: helper `absoluteUrl(path)` con `NEXT_PUBLIC_APP_URL`. Las fotos de producto viven en Supabase Storage (URL ya absoluta) → usar tal cual; el helper cubre el fallback `public/`.

## 8. Testing (TDD)

- **Unit (puras):** `classifyReview` (3 casos), `validateReview` invitada (authorName), `selectOrderBump` (excluye en-carrito, elige más barato, null si vacío), `rankRelated` (featured primero, corta a limit), `buildProductJsonLd` (con/sin reseñas, availability), sitemap builder (entradas esperadas).
- **Integration (`deps.db` mock):** `createReview` (verificada→approved+badge / logueada-no-compradora→pending / invitada→pending), `moderateReview` (approve/reject), `getModerationQueue`, recomendaciones (order-bump filtra sin stock, related excluye self).
- **E2E (Playwright — corre en CI; local Windows bloqueado por symlink, ver memoria):**
  - `tests/e2e/conversion.spec.ts`: invitada deja reseña → mensaje "tras revisión" + **no** aparece en la ficha (sigue `pending`); order-bump visible en `/carrito`; banner de consentimiento presente y "Rechazar" lo cierra.
  - Reseña verificada (clienta seedeada que compró) → aparece publicada con badge (reusa fixtures de `cuenta.spec.ts`).
  - Exit-intent / PostHog capture: no se e2e-an (frágiles); se cubren por unit/integration + smoke manual.

## 9. Env / seed / docs

- `.env.example`: descomentar/activar `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`; agregar `NEXT_PUBLIC_WELCOME_COUPON_CODE=` (vacío por defecto).
- `wrangler.jsonc [vars]`: agregar las `NEXT_PUBLIC_POSTHOG_HOST` y `NEXT_PUBLIC_WELCOME_COUPON_CODE` (públicas; la key de PostHog también es pública — `NEXT_PUBLIC_*` — pero se setea por entorno).
- `prisma/seed.ts`: cupón `BIENVENIDA10` (idempotente, upsert por `code`) + tag `"order-bump"` en un producto conocido (p. ej. una brocha/accesorio del seed).
- `SETUP.md`: alta de **PostHog** (proyecto free, copiar key/host), creación del **cupón de bienvenida** (ya seedeado; cómo cambiar el código vía env), nota de **OG image de marca pendiente** (estética IA).
- `TODO.md`: mover a hecho los ítems de M4b cubiertos (order-bump, cross-sell, exit-intent, PostHog, SEO/OG, moderación de reseñas); dejar diferidos **estética IA**, **fotos en reseñas**, **OG image de marca**, captcha.

## 10. Riesgos / decisiones abiertas

- **Exit-intent mobile**: no hay `mouseleave` real → fallback por inactividad; "best effort" aceptado.
- **OG image de marca**: requiere asset (estética IA §5) → diferido; mientras tanto foto real de producto (que es buena prueba social al compartir).
- **Opt-out vs opt-in**: elegido opt-out (mejor data; AR Ley 25.326 menos estricta que GDPR). Documentado; el toggle es cambiable.
- **Reseñas abiertas = spam**: honeypot + cola de moderación, sin captcha en v1. Si llega spam real, sumar captcha (TODO).
- **`next/og` dinámico**: NO se usa (incertidumbre en Workers + no verificable en Windows). OG = metadata + foto real.
- **Sidebar admin 7 ítems**: validar que la grilla mobile no rompa touch targets; si aprieta, agrupar "Reseñas" bajo un overflow o reordenar.

## 11. Branch y housekeeping

- Rama **`m4b-conversion`** off HEAD de `m4-cuentas`. Nunca push directo a `main`. PR + code-review al cerrar.
- **Sin migración** (decisión central). Si aparece un campo faltante, frenar y avisar antes de migrar.
- Commits por área (reseñas / recomendaciones / exit-intent / analytics / seo / docs) para review claro.
