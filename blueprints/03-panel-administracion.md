# 03 — Panel de administración (de la dueña)

> **Propósito:** la herramienta diaria de la dueña para manejar **todo** sin depender del dev: CRUD completo, control de stock, pedidos, envíos, promos y un dashboard simple. UX **"que lo entienda un nene"**.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03

---

## 1. Principios de UX (no negociables)

- **Vista autoexplicativa:** título + una línea de "para qué sirve".
- **Una acción primaria** por pantalla.
- **Lenguaje humano**, no jerga ("Reponé antes del finde", no "lead time exceeded").
- **Estados con color + texto + ícono** (nunca color solo).
- **Números grandes y legibles**; comparaciones simples.
- **Empty states guiados** ("Todavía no cargaste productos → Cargá el primero").
- **Mobile-friendly:** puede manejarlo del celu.

## 2. Acceso y roles

- Ruta `/admin`, login con **Supabase Auth**.
- Roles: **owner** (la dueña, acceso total) + **admin** (dev, soporte).
- **Acciones peligrosas** (borrar, reembolsar) → diálogo de confirmación claro.
- *(PIN opcional al estilo Elite Padel OS; se usa confirmación simple para un equipo de 1–2 personas.)*

## 3. Navegación del panel

Sidebar (desktop) / drawer + bottom (mobile):
**Dashboard · Productos · Categorías · Combos · Pedidos · Envíos · Cupones · Reseñas · Ajustes**

## 4. Módulos

### Dashboard
- **Ventas** hoy / semana / mes (números grandes).
- **Pedidos pendientes** (a preparar / despachar) con acción directa.
- **Ticket promedio**, top productos, **stock crítico** (alerta).
- Lenguaje simple, sin tableros abrumadores.

### Productos
- Lista con búsqueda + filtros (categoría, activo, bajo stock).
- Crear/editar: fotos (drag-drop a **Supabase Storage**), nombre, descripción, categoría, **precio, costo, peso**, destacado, activo.
- **Variantes:** agregar tonos (nombre, stock, **SKU auto**, foto, override de precio si hace falta).
- Acciones: activar/desactivar, duplicar, borrar (soft-delete).
- **Carga inicial:** **a mano**, producto por producto (pocos SKUs hoy). Import CSV → Fase 2 si crece.

### Categorías
- CRUD **jerárquico** (2 niveles), `skuPrefix`, orden, imagen.

### Combos
- CRUD: elegir variantes + cantidades, `comboPrice`, vigencia, fotos.

### Pedidos
- Lista por estado (chips de color), búsqueda por nº/cliente.
- Detalle: items, contacto, dirección, envío, **estado del pago (MP)**.
- Cambiar estado (preparar → despachar → entregado), cargar tracking/etiqueta.
- Aviso por **email (Resend)** al entrar el pedido.

### Envíos
- Configurar **zonas** (provincia/rango CP → precio), **umbral de envío gratis**, **CP de origen**, métodos (domicilio/sucursal).
- Integración con API Correo → blueprint `05`.

### Cupones
- CRUD (código, tipo, valor, condiciones, vigencia, usos).

### Reseñas
- **Moderación:** aprobar / rechazar (cola de pendientes). Política → blueprint `06`.

### Ajustes
- Datos de tienda, **WhatsApp** (número para el botón wa.me), redes, medios de pago, textos legales, umbral de envío gratis.

## 5. Control de stock

- **Descuento automático** al confirmarse el pago.
- **Alerta de bajo stock** (umbral por variante).
- **Ajuste manual** (post-feria) en un clic.
- Vista de **stock crítico** en el Dashboard.

## 6. Notificaciones

- **Canal (v1): email vía Resend.** Aviso a la **dueña** al entrar un pedido y al confirmarse el pago; y a la **clienta** (confirmación de compra, despacho/tracking). Free tier; usa el dominio `glamifymakeup.site`.
- **WhatsApp (Evolution Go) → diferido** (`TODO.md`): los avisos automáticos por WhatsApp quedan para una fase siguiente (evita sumar infra always-on ahora). *El botón de consultas wa.me en la web sí va (manual, gratis).*

## 7. Decisiones

- **N1 ✔** — Aviso de nuevo pedido/pago: **email (Resend)** en v1. WhatsApp (Evolution Go) **diferido** → `TODO.md`.
- **N2 ✔** — Carga inicial de catálogo: **a mano** (CSV → Fase 2).
- **N3 ✔** — Acciones sensibles: **confirmación simple** (PIN queda como opción futura).
