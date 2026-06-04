# 06 — Conversión y crecimiento

> **Propósito:** las mecánicas que hacen vender, recomprar y crecer — **todas sobre datos reales** (ver `00 §3` y la ley de consumidor AR). Persuasión, no engaño.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03

---

## 1. Principio rector

**Real > trucho.** Nada de stock falso, contadores falsos ni costos ocultos (ilegal en AR + rompe la marca "no humo"). Todo se apoya en datos verdaderos. La persuasión real convierte mejor y trae **recompra**.

## 2. Palancas de ticket (subir el promedio)

- **Barra de envío gratis** ("te faltan $X para $47.500") en home, ficha y carrito.
- **Combos** con **anclaje de precio** ("suelto $A → combo $B").
- **Order-bump** en carrito/checkout ("sumá la brocha a $X").
- **Cross-sell** "Te puede gustar" en ficha y carrito.

## 3. Urgencia y escasez (reales)

- **`StockBadge` real** ("quedan 3") atado al inventario verdadero.
- **Promos con fecha real**: countdown **solo** si la promo existe y termina de verdad.
- Destacar "héroes de catálogo" y novedades.

## 4. Prueba social

- **C1 ✔ — Reseñas abiertas + moderación:** cualquiera puede dejar reseña (con foto + rating), la dueña **aprueba antes de publicar**. Se marca "compra verificada" cuando corresponde.
- "X vendidos" + UGC (fotos reales de clientas, con permiso).

## 5. Estética con IA / fondos (dirección visual premium)

> Pedido del dueño: que la web se vea de primer nivel usando **IA bien hecha**.

- En lugar de fondos planos, usar **imágenes generadas con IA, curadas y on-brand** (girly clean + glam, rosa eléctrico) para **hero, secciones de home, banners de categoría, fondos de cards destacadas y OG images**.
- Alternativa/combinación: **fondos animados sutiles** (gradientes CSS animados, motion suave).
- **Guardrails (para que no parezca "IA cheta" ni rompa nada):**
  - **Art direction cuidada** y coherente con el sistema de diseño (`02`) — que **no se note que es IA**.
  - **Optimizadas**: WebP/AVIF, `lazy`, dimensiones reservadas (no romper LCP/CLS).
  - **`prefers-reduced-motion`** respetado; fallback a gradiente limpio.
  - Generación en **build/diseño** (assets estáticos en Supabase Storage / `public`), no en runtime.

## 6. Recuperación y recompra

- **C2 ✔ — Carrito abandonado por email (Resend)** en v1; requiere email + **consentimiento**. Timing: 1º a ~1h, 2º a ~24h (vía Vercel Cron). WhatsApp diferido → `TODO.md`.
- **Wishlist / favoritos** + **aviso de reposición** (back-in-stock).
- **Cupones**: bienvenida (1ª compra), recompra, recuperación.
- **Opt-in** a novedades (WhatsApp/email) con consentimiento y baja fácil.

## 7. Captación y canales

- **Link en bio** (IG/TikTok) → web con **UTM** (medir qué contenido vende).
- **SEO** (títulos, metas, sitemap, datos estructurados de producto) + **Open Graph** (links lindos al compartir).
- **C4 ✔ — Analytics: PostHog (free tier)** — embudos, eventos, conversiones. (Respeta consentimiento de cookies.)

## 8. Exit-intent y popups

- **C3 ✔ — Sutil, una sola vez:** oferta de salida (descuento real) y/o captura de email cuando detecta que se va. Sin repetir, sin molestar.

## 9. Cumplimiento

- Mensajes (WhatsApp/email) **con consentimiento** + baja. Sin dark patterns. Precios y costos claros antes de pagar.

## 10. Decisiones

- **C1 ✔** — Reseñas **abiertas + moderación** + **estética con IA** (fondos/heros, con guardrails).
- **C2 ✔** — Carrito abandonado: **email (Resend)** en v1; WhatsApp diferido (`TODO.md`).
- **C3 ✔** — Exit-intent: **sutil, una vez**.
- **C4 ✔** — Analytics: **PostHog (free)**.
