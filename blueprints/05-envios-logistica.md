# 05 — Envíos y logística

> **Propósito:** definir el operador de envíos, el cálculo de costo por **código postal**, las zonas, el envío gratis y los estados de envío. Basado en la investigación del contexto argentino.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03

---

## 1. Operador principal: Correo Argentino (MiCorreo / PaqAr)

Elegido por el contexto de un emprendimiento chico:
- **Cobertura nacional** (+5.000 puntos; llega al interior donde Andreani/OCA muchas veces no).
- **Sin acuerdo comercial ni volumen mínimo**; tarifas competitivas desde el primer envío.
- **API real (MiCorreo / PaqAr v2, REST + JWT)** que cotiza por **peso + CP origen/destino** y devuelve JSON.
- OCA/Andreani: convienen con volumen/acuerdo → no para arrancar.

## 2. Arquitectura de envíos

Abstracción **`ShippingProvider.quote({ cpDestino, pesoGr, metodo })`** con dos implementaciones:
- **(a) Correo Argentino API** → cotización **en vivo** por CP. **Primaria desde el día 1.**
- **(b) Tabla de zonas** (la dueña la edita en el panel) → **fallback** (si la API falla o un CP no cotiza) y override manual.

Más: **envío gratis sobre umbral** configurable.

> **Estrategia (D05-2 ✔):** **API de Correo en vivo desde el día 1** (el dev se maneja bien con APIs). La tabla de zonas queda como fallback/override. **Requisito:** registrar la cuenta **MiCorreo** y tener las credenciales de API antes de lanzar.

## 3. Métodos de entrega

- **Envío a domicilio** (Correo, cotiza por CP).
- **Envío a sucursal** de Correo (suele ser más barato).
- *(Sin retiro en persona — la tienda es 100% envíos.)*

## 4. Cálculo de costo por código postal

- Input: **CP de destino** (en ficha de producto y en checkout) + **peso** del pedido.
- **Peso** = suma de pesos de las variantes del carrito (con default sensato si falta; el maquillaje es liviano).
- **CP de origen = 6700 (Luján, Buenos Aires)** — punto de despacho.
- La API de MiCorreo devuelve la tarifa; si no cotiza, se usa la **zona** que matchee el CP (fallback).

## 5. Envío gratis sobre umbral

- **Umbral: $47.500** (configurable desde Ajustes, ajustable cuando quiera).
- Lo **absorbe la dueña** (margen 100%+ lo permite).
- **Barra de progreso** "te faltan $X para envío gratis" en home, ficha y carrito (UI → `02`/`06`).

## 6. Estados de envío (`Shipment`)

`pending → ready → dispatched → in_transit → delivered` (+ `returned`).
- Tracking: carga del número (manual o vía API).
- Etiqueta: MiCorreo permite generar el envío/etiqueta; v1 puede ser manual y luego automatizar.

## 7. Operación

- La dueña ve el pedido pagado → prepara → despacha (Correo) → carga tracking → el estado **avisa a la clienta** (email vía Resend; WhatsApp diferido → `TODO.md`).
- Stock compartido feria/web (ver `01`): ajusta cantidades tras cada feria.

## 8. Decisiones

- **D05-1 ✔** — Operador: **Correo Argentino**.
- **D05-2 ✔** — **API de Correo en vivo desde el día 1**; tabla de zonas como fallback/override (requiere credenciales MiCorreo antes de lanzar).
- **D05-3 ✔** — Umbral de envío gratis: **$47.500** (configurable).
- **D05-4 ✔** — **CP de origen: 6700 (Luján)**.
- **D05-5 ✔** — Métodos: **domicilio + sucursal de Correo** (sin retiro en persona).
