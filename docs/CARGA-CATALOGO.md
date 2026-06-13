# Cómo cargar el catálogo real (panel `/admin`)

> Después de limpiar los productos de prueba, la tienda quedó **sin productos**.
> Esta guía es para cargar los reales desde el panel. No hace falta tocar código.

## 0. Antes de empezar

- **Entrar al panel:** `https://glamifymakeup.site/admin` → iniciar sesión con tu usuario admin.
  (Si no tenés usuario admin todavía: se crea con `pnpm admin:create`.)
- **Fotos:** se suben solas a Supabase Storage (bucket `product-images`). Si al subir una imagen
  da error, corré una vez `pnpm setup:storage` y reintentá.
- **Las categorías ya existen** (no las borramos). Cada producto se cuelga de una **subcategoría**:

  | Categoría | Subcategorías | Prefijo SKU |
  |---|---|---|
  | Labios | Labiales, Gloss | LAB / GLO |
  | Ojos | Máscaras de pestañas, Sombras | MAS / SOM |
  | Rostro | Rubores, Bases | RUB / BAS |
  | Accesorios | Brochas y esponjas | BRO |

## 1. Crear un producto

`Productos` → **Nuevo producto** (`/admin/productos/nuevo`). Secciones del formulario:

### Datos básicos
- **Nombre** — el que ve la clienta (ej. "Labial Mate Larga Duración").
- **Enlace (slug)** — *dejalo vacío*, se genera solo desde el nombre.
- **Categoría** — elegí la **subcategoría** (Labiales, Gloss, etc.). De acá sale el prefijo del SKU.
- **Producto activo** — encendido = visible en la tienda. Apagado = borrador.
- **Descripción** — texto real, sin humo. Qué es, para qué sirve, acabado.

### Precio y peso
- **Precio (ARS)** — precio de venta. Sin centavos si no querés (ej. `3200`).
- **Precio anterior / oferta** — *solo* si hay oferta real (tiene que ser **mayor** al precio actual).
  Si no hay oferta, dejalo vacío. Esto pinta el "antes/ahora" en la ficha.
- **Costo (ARS)** — lo que te costó a vos (no se muestra a la clienta; sirve para tus métricas).
- **Peso en gramos** — importante: define el costo de envío. Poné el peso real con packaging.

### Imágenes
- Hasta **6 fotos**. Formatos PNG/JPG/WEBP/AVIF, máx **5 MB** c/u.
- La **primera** es la principal (la de las listas y la portada). Cuadradas (1:1) se ven mejor.

### Variantes (tonos / colores)
- **Cada tono es una variante.** Si el producto no tiene tonos, no agregues ninguna:
  se crea una sola llamada **"Único"** (después editala para ponerle stock).
- Por cada variante:
  - **Nombre del tono** — "Rojo Pasión", "Nude Rosado"… o "Único".
  - **SKU** — *dejalo vacío*, se autogenera (ej. `LAB-0007`). Solo escribilo si querés uno propio.
  - **Stock** — unidades reales que tenés. **Esto es lo que se vende; sin stock, no se puede comprar.**
  - **Aviso de bajo stock** — te avisa cuando baja de este número (default 3).
  - **Precio especial** (opcional) — si ese tono cuesta distinto al precio base.
  - **Color del tono (hex)** (opcional) — ej. `#FF2E93`. Pinta el círculo de color en la ficha.
  - **Variante activa** — encendido = se puede elegir y comprar.

### Destacado y SEO
- **Destacar en portada** + **Orden en portada** (1, 2, 3…) — define qué sale en la home.
  Cargá al menos **3-4 destacados** para que la portada no quede pobre.
- **Etiquetas** (separadas por coma) — útiles:
  - `order-bump` → aparece como "sumá esto" en el carrito (ideal para esponjas, brochas baratas).
  - tags de la misma categoría alimentan el "Te puede gustar".
- **Título / Descripción SEO** (opcional) — si los dejás vacíos, usa el nombre y la descripción.

→ **Crear producto**. Repetí por cada producto.

## 2. Combos (opcional)

`Combos` → **Nuevo combo**: elegís variantes existentes + un precio de combo.
Al venderse, descuenta stock de cada componente. (El que borramos, "Dúo Labios Glam", era de prueba.)

## 3. Verificar que quedó bien

- `https://glamifymakeup.site/tienda` → tus productos aparecen por categoría.
- Portada → los **destacados** se ven en el hero/listado.
- Abrí una **ficha** → fotos, tonos con su color, precio, stock, botón de compra.
- El envío gratis se activa solo a partir de **$47.500** de subtotal (configurable en `Setting`).

## Tips
- Mejor **pocos productos bien cargados** (foto buena + descripción + stock real) que muchos a medias.
- Stock 0 → el producto se muestra "Sin stock" y no se puede comprar. Cargá stock real.
- Para una oferta, poné el precio real en **Precio** y el de lista en **Precio anterior** (mayor).
