# 02 — Storefront: páginas, flujos y diseño

> **Propósito:** definir la arquitectura de información, las páginas, los flujos de la clienta y el **sistema de diseño** de la tienda (lo que ve y usa quien compra). El diseño visual fino se implementa con **ux-ui-pro-max** en el build; este documento fija las decisiones.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03
> Sistema de diseño generado con **ux-ui-pro-max**. Anclado al logo `logo-glamify.jpeg`.

---

## 1. Dirección de diseño

- **Estilo:** *Soft UI Evolution* — sombras suaves, profundidad sutil, mucho aire, foco en accesibilidad (WCAG AA+). **Light mode** (sin dark mode por ahora: el perfil girly-clean lo pide así).
- **Vibe:** **girly clean + acento glam**, **rosa eléctrico** + blanco. Limpio, femenino, moderno, **no intimidante**. Bajada del `00`: *"glam accesible, no humo"*.
- **Anclaje al logo:** el logo es un **wordmark serif** en rosa eléctrico → la **paleta** y la **tipografía** se anclan a él para coherencia de marca.
- **Principios:** mobile-first · una acción primaria clara por pantalla · jerarquía por tamaño/espacio (no solo color) · **la foto de producto es protagonista** · cero clutter.
- **Evitar (anti-patterns del sistema):** neón que canse, animaciones bruscas, dark mode.
- **Fondos con IA / animados:** en lugar de fondos planos, imágenes generadas con IA **curadas y on-brand** (que no parezcan IA) o **gradientes/animaciones sutiles**; siempre **optimizadas** (WebP/AVIF, lazy, sin romper LCP/CLS) y con `prefers-reduced-motion`. Detalle → `06 §5`.

## 2. Paleta (design tokens)

Anclada al **logo** (wordmark serif en **rosa eléctrico**). Hex afinados con muestreo del logo en el build.

| Rol | Hex | Token | Nota |
|---|---|---|---|
| Primario (marca/CTA) | `#FF2E93` | `--color-primary` | rosa eléctrico (del logo) |
| Primario hover/pressed | `#E01E7D` | `--color-primary-hover` | pink más profundo (contraste) |
| Sobre primario | `#FFFFFF` | `--color-on-primary` | |
| Secundario | `#FF9ED1` | `--color-secondary` | rosa suave para tints/fondos |
| Acento (opcional) | `#8B5CF6` | `--color-accent` | lavanda, pop puntual — se puede quitar para full pink |
| Fondo | `#FFFFFF` | `--color-background` | secciones alternas en `#FFF5FA` |
| Texto (foreground) | `#6E0B3F` | `--color-foreground` | vino oscuro, AA sobre claro |
| Muted | `#FBEFF6` | `--color-muted` | |
| Borde | `#FBCFE8` | `--color-border` | |
| Error | `#DC2626` | `--color-destructive` | |
| Focus ring | `#FF2E93` | `--color-ring` | |

> **Rosa eléctrico con disciplina:** el pink fuerte es protagonista (logo, hero, CTAs, badges) **sobre fondo claro/blanco** — NO inunda todo — para que sea atractivo sin volverse neón cansador.
> **Contraste (build):** para botones, texto blanco sobre `#FF2E93` ronda ~3:1 (OK para texto grande). Para texto chico o más margen AA, el botón usa `#E01E7D` o texto vino. Se valida con la herramienta antes de cerrar.

## 3. Tipografía

- **Títulos / display:** **Playfair Display** (serif elegante, hace juego con el logo) — en MAYÚSCULAS con tracking leve para títulos de sección. ✔
- **Texto / UI:** **Nunito Sans** (300–700) — legible, amigable, buena para conversión. ✔
- **Escala:** 12 / 14 / 16 / 18 / 24 / 32 (/40 /48 hero desktop). **Body 16px mínimo** en mobile (evita auto-zoom iOS). Line-height 1.5–1.7 en texto.
- **Números tabulares** para precios y totales.
- Carga con `next/font` + `font-display: swap`.
- **Import (referencia):**
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap');
  ```

## 4. Efectos y movimiento

- Sombras **suaves** (soft UI), radios redondeados (cards ~16px, botones ~12px).
- Transiciones **150–300ms ease-out**; respetar `prefers-reduced-motion`.
- Microinteracciones: `scale 0.97` en press de cards/botones; **skeletons** en cargas > 300ms.
- **Íconos: Lucide (SVG)**, un solo set, stroke consistente. **Nada de emojis como íconos.**

## 5. Sitemap / arquitectura de información

**Públicas**
- Home `/`
- Tienda `/tienda` · categoría `/tienda/[categoria]` · subcategoría `/tienda/[categoria]/[subcategoria]`
- Ficha `/producto/[slug]`
- Combos `/combos`
- Búsqueda `/buscar`
- Carrito `/carrito` · Checkout `/checkout` · Confirmación `/checkout/gracias`

**Cuenta**
- `/cuenta` (pedidos, datos, direcciones, favoritos) · Ingreso/registro `/ingresar`

**Contenido / soporte**
- `/nosotras` · `/preguntas-frecuentes` · `/envios-y-pagos` · `/contacto`

**Legales (Argentina)**
- `/terminos` · `/privacidad` · **Botón de Arrepentimiento** `/arrepentimiento` (obligatorio por ley AR) · link a Defensa del Consumidor

**Admin:** `/admin/*` → blueprint `03` (fuera del storefront).

## 6. Navegación

- **Header sticky:** logo, buscador (ícono → expande), ícono **carrito** con contador, hamburguesa (categorías) en mobile.
- **Bottom nav mobile** (app-like, ≤5 ítems): **Inicio · Tienda · Buscar · Carrito · Cuenta**. ✔
- **Carrito = slide-over (drawer)**, no saca a la clienta de la página.
- **Botón flotante de WhatsApp** (consultas): visible pero discreto, no tapa CTAs.
- Desktop: nav de categorías en header (mega-menú simple si hay subcategorías), sin bottom nav.
- **Breadcrumbs** en fichas y categorías (3+ niveles). Estado activo visible. Back preserva scroll/filtros.

## 7. Páginas (mobile-first, sección por sección)

### Home
1. **Hero**: imagen/banner + headline + 1 CTA ("Ver tienda").
2. **Barra de envío gratis** (progreso) bajo el hero.
3. **Categorías destacadas** (grid con foto).
4. **Héroes de catálogo** (carrusel de destacados).
5. **Combos destacados**.
6. **Prueba social** (reseñas con foto, "X vendidos").
7. **Newsletter / WhatsApp opt-in**.
8. **Footer** (links, legales, redes, medios de pago, botón de arrepentimiento).

### Tienda / Catálogo `/tienda`
- Grid responsive (**2 col mobile / 3–4 desktop**) de `ProductCard`.
- **Filtros**: categoría/subcategoría, precio, "en oferta", "disponible". En mobile → **bottom-sheet**. Orden: relevancia / precio / novedades.
- Chips de filtros activos. Paginación o scroll infinito (virtualizar si 50+). Empty state guiado.

### Ficha de producto `/producto/[slug]`
- **Galería** (swipe) + badges (oferta, **bajo stock real**).
- Nombre, precio (tachado si oferta), **selector de variante (tono)** con swatches + **stock por tono**.
- `QuantityStepper` + **"Agregar al carrito"** (primario) + "Comprar ahora".
- **Envío**: input CP → "Calculá tu envío" + "te faltan $X para envío gratis".
- Descripción, detalles, atributos.
- **Reseñas** (rating + fotos) + "X vendidos".
- **Combos** que incluyen este producto + relacionados (upsell). Botón WhatsApp "Consultar".

### Carrito (drawer + `/carrito`)
- Líneas (foto, nombre, tono, precio, cantidad, eliminar). Barra de envío gratis.
- Subtotal + cupón + CTA **"Iniciar compra"**.
- **Order-bump** ("sumá X a $Y") + cross-sell "Te puede gustar".

### Checkout `/checkout` (un paso, mobile-friendly)
- Contacto (email, nombre, tel).
- **Entrega**: domicilio / sucursal (Correo). Dirección con **CP → cotiza envío** (API Correo + zonas fallback).
- Resumen + cupón. **Pago → redirección a Mercado Pago Checkout Pro.**
- **Checkout invitado** (cuenta opcional al final).
- Validación inline, error bajo el campo + autofocus al primero inválido, `autocomplete`, teclados semánticos (tel/email).
- `/checkout/gracias`: nº de pedido + seguimiento + CTA WhatsApp.

### Cuenta `/cuenta`
- Pedidos (estado + seguimiento), datos, direcciones, favoritos.
- Ingreso/registro: **email (contraseña / magic link) + Google**.

### Estáticas / legales
- Nosotras · FAQ · Envíos y pagos · Contacto · Términos · Privacidad · **Arrepentimiento**.

## 8. Inventario de componentes (shadcn/ui + custom)

- **Base shadcn:** Button, Input, Select, Sheet (drawer), Dialog, Tabs, Accordion, Badge, Card, Carousel, Sonner (toast), Skeleton, Form, Pagination, Breadcrumb, RadioGroup (envío), Separator.
- **Custom:** `ProductCard` · `VariantSwatchSelector` · `PriceTag` (tachado/oferta) · `FreeShippingBar` · `StockBadge` (real) · `RatingStars` · `ReviewCard` · `ComboCard` · `CartDrawer` · `CPShippingCalculator` · `WhatsAppFab` · `FilterSheet` · `QuantityStepper` · `EmptyState` · `SocialProofBadge` ("X vendidos").

## 9. Conversión en la UI (mecánicas reales — detalle en `06`)

`FreeShippingBar` · `StockBadge` real ("quedan 3") · combos con anclaje de precio · order-bump + cross-sell · reseñas con foto + "X vendidos" · exit-intent (descuento real) · wishlist · aviso de reposición · urgencia real (fin de promo con fecha real).

> **Todo atado a datos reales** — sin fake countdowns ni stock trucho (cumple `00 §3` y la ley de consumidor).

## 10. Accesibilidad y responsive

- Breakpoints **375 / 768 / 1024 / 1440**, mobile-first.
- Touch targets ≥ **44px**, spacing ≥ 8px.
- Contraste texto ≥ 4.5:1 · focus visible · navegación por teclado · alt text · aria-labels en íconos.
- `prefers-reduced-motion` · imágenes WebP/AVIF + lazy + aspect-ratio (CLS < 0.1).
- **El color nunca es el único indicador** (badges con texto + ícono).

## 11. Tokens para el build (ux-ui-pro-max)

- Colores §2 como CSS vars / theme Tailwind + shadcn.
- Fuentes (§3) con `next/font`.
- Radii, sombras (soft), spacing 4/8.
- En el build se persiste como `design-system/MASTER.md` (patrón de ux-ui-pro-max) + overrides por página.

## 12. Decisiones

- **Logo:** ✔ recibido (`logo-glamify.jpeg` + `logo-glamify-makeup.svg`). Ojo: el SVG es un **JPEG envuelto** (raster con fondo blanco), no vector real. Sirve sobre fondos claros. *Ideal (no bloquea): SVG vectorial real o PNG con fondo transparente para footer/secciones de color.*
- **Paleta:** ✔ **rosa eléctrico** (`#FF2E93`) + blanco; lavanda como acento opcional.
- **Tipografías:** ✔ **Playfair Display** (títulos) + **Nunito Sans** (cuerpo).
- **Bottom nav mobile:** ✔ sí.
