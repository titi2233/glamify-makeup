# Glamify Makeup — Design System (MASTER)

> **Fuente de verdad visual** de la tienda. Generado con **ux-ui-pro-max** y anclado al **blueprint 02** (que fijó las decisiones de marca a partir del logo). Esta es la referencia global; las desviaciones por página viven en `design-system/pages/<página>.md` y **sobreescriben** lo de acá.
>
> Implementación viva: `src/app/globals.css` (CSS vars) + `tailwind.config.ts` (clases). Si algo cambia en el código, actualizar este archivo.
>
> Última actualización: 2026-06-04 (M0).

---

## 1. Dirección y principios

- **Estilo:** _Soft UI Evolution_ — sombras suaves, profundidad sutil, mucho aire, contraste cuidado (WCAG AA+). Confirmado por ux-ui-pro-max para "beauty / soft-ui / girly".
- **Modo:** **Light only** (sin dark mode por ahora; el perfil girly-clean lo pide así — blueprint 02 §1).
- **Vibe:** girly clean + acento glam · **rosa eléctrico** + blanco · limpio, femenino, moderno, **no intimidante**.
- **Anclaje al logo:** wordmark serif rosa → paleta y tipografía se anclan al logo.
- **Principios:** mobile-first · **una acción primaria por pantalla** · jerarquía por tamaño/espacio (no solo color) · la **foto de producto es protagonista** · cero clutter.
- **Pattern de página:** Hero-Centric + Social Proof (CTA above-the-fold).

### Anti-patterns (NO hacer)

- Neón que canse · animaciones bruscas · **dark mode**.
- Stock/contadores falsos (rompe marca "no humo" + ilegal en AR — blueprint 00 §3 / 06).
- Emojis como íconos estructurales · color como único indicador.

> **Nota de marca vs. recomendación genérica:** ux-ui-pro-max sugirió _Varela Round_ (display) y `#EC4899` (primary). **Se mantiene la decisión del blueprint 02:** **Playfair Display** (display, hace juego con el wordmark serif) y **`#FF2E93`** (muestreado del logo). La dirección general (Soft UI, Nunito Sans, sin dark mode) coincide.

---

## 2. Paleta (design tokens)

Implementada como CSS vars HSL (convención shadcn) en `globals.css`, expuesta como clases en `tailwind.config.ts`. Light mode.

| Rol                        | Hex (blueprint 02) | Token shadcn             | HSL implementado | Clase Tailwind                |
| -------------------------- | ------------------ | ------------------------ | ---------------- | ----------------------------- |
| Primario (marca/CTA)       | `#FF2E93`          | `--primary`              | `331 100% 59%`   | `bg-primary` / `text-primary` |
| Primario hover/pressed     | `#E01E7D`          | `--primary-hover`        | `331 76% 50%`    | `hover:bg-primary-hover`      |
| Sobre primario             | `#FFFFFF`          | `--primary-foreground`   | `0 0% 100%`      | `text-primary-foreground`     |
| Secundario (rosa suave)    | `#FF9ED1`          | `--secondary`            | `328 100% 81%`   | `bg-secondary`                |
| Sobre secundario           | `#6E0B3F`          | `--secondary-foreground` | `328 82% 24%`    | `text-secondary-foreground`   |
| Acento (lavanda, opcional) | `#8B5CF6`          | `--accent`               | `258 90% 66%`    | `bg-accent`                   |
| Sobre acento               | `#FFFFFF`          | `--accent-foreground`    | `0 0% 100%`      | `text-accent-foreground`      |
| Fondo                      | `#FFFFFF`          | `--background`           | `0 0% 100%`      | `bg-background`               |
| Sección alterna            | `#FFF5FA`          | `--surface-alt`          | `330 100% 98%`   | `bg-surface-alt`              |
| Texto (foreground)         | `#6E0B3F`          | `--foreground`           | `328 82% 24%`    | `text-foreground`             |
| Muted (fondo tenue)        | `#FBEFF6`          | `--muted`                | `324 60% 96%`    | `bg-muted`                    |
| Muted foreground           | —                  | `--muted-foreground`     | `328 25% 45%`    | `text-muted-foreground`       |
| Borde / input              | `#FBCFE8`          | `--border` / `--input`   | `326 84% 90%`    | `border-border`               |
| Error / destructivo        | `#DC2626`          | `--destructive`          | `0 72% 51%`      | `bg-destructive`              |
| Focus ring                 | `#FF2E93`          | `--ring`                 | `331 100% 59%`   | `ring-ring`                   |
| Card / popover             | `#FFFFFF`          | `--card` / `--popover`   | `0 0% 100%`      | `bg-card`                     |

**Rosa con disciplina:** el pink fuerte es protagonista (logo, hero, CTAs, badges) **sobre fondo claro/blanco** — no inunda todo, para no volverse neón cansador.
**Contraste:** texto blanco sobre `#FF2E93` ≈ 3:1 (OK solo para texto grande/botones). Para texto chico, usar texto vino (`--foreground`) o el botón en `#E01E7D`. Verificar AA antes de cerrar cada pantalla.

---

## 3. Tipografía

Cargadas con `next/font/google` (`display: swap`) en `src/app/layout.tsx`, expuestas como CSS vars.

- **Display / títulos:** **Playfair Display** (serif elegante) → var `--font-display` → clase `font-display`. Pesos 400–700. Títulos de sección en MAYÚSCULAS con tracking leve.
- **Texto / UI:** **Nunito Sans** (300–700) → var `--font-sans` → clase `font-sans` (default del `body`). Legible, amigable, buena conversión.
- **Escala:** 12 / 14 / 16 / 18 / 24 / 32 (/40 /48 hero desktop). **Body 16px mínimo** en mobile (evita auto-zoom iOS). Line-height 1.5–1.7 en texto.
- **Números tabulares** para precios/totales → clase `tabular-nums` (`font-variant-numeric: tabular-nums`).
- **Pesos:** títulos 600–700 · body 400 · labels 500.

---

## 4. Forma, profundidad y movimiento

- **Radios:** cards `rounded-2xl` (16px) · botones/inputs `rounded-xl` (~12px, `--radius: 0.75rem`).
- **Sombras (soft UI):** `shadow-soft` (`0 2px 8px -2px rgba(110,11,63,.08), 0 4px 16px -4px rgba(255,46,147,.10)`) · `shadow-soft-lg` para overlays/cards destacadas.
- **Spacing:** sistema 4/8. Touch targets ≥ **44px** (botón default `h-11`). Gap entre targets ≥ 8px.
- **Movimiento:** transiciones **150–300ms ease-out** (entradas) / ease-in (salidas). Press: `active:scale-[0.97]` en cards/botones. **Skeletons** en cargas > 300ms. Respetar **`prefers-reduced-motion`** (ya global en `globals.css`).
- **Íconos:** **Lucide** (`lucide-react`), un solo set, stroke consistente. **Nunca emojis como íconos.**

---

## 5. Inventario de componentes (para M1/M3/M4)

- **Base shadcn:** Button ✓ (M0) · Input · Select · Sheet (drawer) · Dialog · Tabs · Accordion · Badge · Card · Carousel · Sonner (toast) · Skeleton · Form · Pagination · Breadcrumb · RadioGroup · Separator.
- **Custom:** `ProductCard` · `VariantSwatchSelector` · `PriceTag` (tachado/oferta) · `FreeShippingBar` · `StockBadge` (real) · `RatingStars` · `ReviewCard` · `ComboCard` · `CartDrawer` · `CPShippingCalculator` · `WhatsAppFab` · `FilterSheet` · `QuantityStepper` · `EmptyState` · `SocialProofBadge`.
- **Variantes de Button implementadas:** `default` (rosa) · `secondary` · `outline` · `ghost` · `destructive` · `link`. Tamaños: `default` (h-11) · `sm` · `lg` · `icon`.

---

## 6. Navegación (referencia)

- **Header sticky:** logo · buscador · carrito con contador · hamburguesa (mobile).
- **Bottom nav mobile** (≤5): Inicio · Tienda · Buscar · Carrito · Cuenta.
- **Carrito = slide-over (drawer).** Botón flotante de WhatsApp discreto. Breadcrumbs en fichas/categorías. Back preserva scroll/filtros.

---

## 7. Conversión (mecánicas — todas sobre datos reales)

`FreeShippingBar` (umbral $47.500) · `StockBadge` real · combos con anclaje de precio · order-bump + cross-sell · reseñas con foto + "X vendidos" · exit-intent sutil (una vez) · wishlist · aviso de reposición · urgencia real (fin de promo con fecha real). Detalle: blueprint 06.

---

## 8. Accesibilidad (checklist por pantalla)

- [ ] Contraste texto ≥ 4.5:1 (grande ≥ 3:1).
- [ ] Focus visible (ring rosa) · navegación por teclado · tab order = orden visual.
- [ ] Touch targets ≥ 44px · spacing ≥ 8px.
- [ ] `alt` en imágenes · `aria-label` en botones-ícono.
- [ ] **El color nunca es el único indicador** (badge = texto + ícono).
- [ ] `prefers-reduced-motion` respetado · imágenes WebP/AVIF + lazy + aspect-ratio (CLS < 0.1).
- [ ] Breakpoints 375 / 768 / 1024 / 1440, mobile-first, sin scroll horizontal.

---

## 9. Recuperación jerárquica (cómo usar este archivo)

Al construir una página: leer **`design-system/MASTER.md`** y, si existe, **`design-system/pages/<página>.md`** (sus reglas tienen prioridad sobre el Master). Si no existe el archivo de página, regir solo por el Master.
