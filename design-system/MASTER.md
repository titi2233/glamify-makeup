# Glamify Makeup — Design System (MASTER)

> **Fuente de verdad visual** de la tienda. Actualizado a la identidad **Editorial Beauty & Modern Luxury** con el nuevo logo en serif negra + destello magenta (`#E6007A`) y fondo 3D en relieve cosmético.
>
> Implementación viva: `src/app/globals.css` (CSS vars) + `tailwind.config.ts` (clases). Si algo cambia en el código, actualizar este archivo.
>
> Última actualización: 2026-08-17 (Rebrand Editorial).

---

## 1. Dirección y principios

- **Estilo:** _Editorial Beauty & Modern Luxury_ — fondo texturizado monocromático 3D suave, tipografía serif negra de alto impacto, acentos frambuesa/magenta y tarjetas blancas con bordes ultrafinos.
- **Modo:** **Light only** (alta luminosidad, estética boutique).
- **Vibe:** Clean, sofisticado, moderno, accesible pero con presencia de marca de lujo (estilo Rhode, Glossier, Rare Beauty).
- **Anclaje al logo:** Wordmark "GLAMIFY" en serif negra profunda (`#111111`) con destello estrella en **magenta frambuesa (`#E6007A`)** sobre la "Y" y subtítulo "M A K E U P" espaciado.
- **Principios:** Mobile-first · **una acción primaria por pantalla** · jerarquía limpia · la **foto de producto es protagonista** · tarjetas nítidas sobre fondo en relieve.

---

## 2. Paleta (design tokens)

Implementada como CSS vars HSL en `globals.css`, expuesta como clases en `tailwind.config.ts`. Light mode.

| Rol                        | Hex               | Token shadcn             | HSL implementado | Clase Tailwind                |
| -------------------------- | ----------------- | ------------------------ | ---------------- | ----------------------------- |
| Primario (Acento / Destello)| `#E6007A`         | `--primary`              | `328 100% 45%`   | `bg-primary` / `text-primary` |
| Primario hover             | `#C20067`         | `--primary-hover`        | `328 95% 38%`    | `hover:bg-primary-hover`      |
| Sobre primario             | `#FFFFFF`         | `--primary-foreground`   | `0 0% 100%`      | `text-primary-foreground`     |
| Secundario (porcelana)     | `#FAF5F7`         | `--secondary`            | `330 30% 96%`    | `bg-secondary`                |
| Sobre secundario           | `#262626`         | `--secondary-foreground` | `0 0% 15%`       | `text-secondary-foreground`   |
| Texto (foreground)         | `#1A1A1A`         | `--foreground`           | `0 0% 10%`       | `text-foreground`             |
| Fondo base                 | `#FFFFFF` / `#FBFBFB` | `--background`       | `0 0% 100%`      | `bg-background`               |
| Muted                      | `#F8F5F6`         | `--muted`                | `330 15% 96%`    | `bg-muted`                    |
| Muted foreground           | `#6B6B6B`         | `--muted-foreground`     | `0 0% 42%`       | `text-muted-foreground`       |
| Borde / input              | `#ECE6E9`         | `--border` / `--input`   | `330 10% 91%`    | `border-border`               |
| Error / destructivo        | `#DC2626`         | `--destructive`          | `0 72% 51%`      | `bg-destructive`              |
| Focus ring                 | `#E6007A`         | `--ring`                 | `328 100% 45%`   | `ring-ring`                   |
| Card / popover             | `#FFFFFF`         | `--card` / `--popover`   | `0 0% 100%`      | `bg-card`                     |

---

## 3. Tipografía

Cargadas con `next/font/google` (`display: swap`) en `src/app/layout.tsx`.

- **Display / títulos:** **Playfair Display** (serif elegante, tracking amplio).
- **Texto / UI:** **Nunito Sans** (limpio, geométrico, alta legibilidad).
- **Body 16px mínimo** en mobile (evita auto-zoom iOS).
- **Números tabulares** para precios/totales (`tabular-nums`).

---

## 4. Forma, profundidad y movimiento

- **Fondo:** Patrón 3D en relieve (`bg-pattern-mobile.png` y `bg-pattern-desktop.png`) fijo en `body`.
- **Radios:** cards `rounded-2xl` (16px) · botones/inputs `rounded-xl` (~12px).
- **Sombras:** `shadow-soft` y `shadow-soft-lg` con tinte sutil neutro y frambuesa.
- **Movimiento:** transiciones suaves 200–300ms ease-out. Respeto de `prefers-reduced-motion`.
