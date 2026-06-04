# 04 — Checkout, pagos y ciclo de pedido

> **Propósito:** definir el flujo de pago con **Mercado Pago Checkout Pro**, los **webhooks**, la **máquina de estados** del pedido y los **casos borde**. Es el corazón transaccional: acá no se improvisa.
>
> Estado: ✅ **aprobado** · Fecha: 2026-06-03

---

## 1. Flujo de checkout (un paso)

1. Carrito → `/checkout`: contacto (email, nombre, tel), entrega (CP → cotiza envío), resumen, cupón.
2. El server crea la **`Order`** con `status = pending_payment` + crea una **MP Preference** (items, `back_urls`, `external_reference = orderId`, `notification_url = webhook`) con **métodos offline/efectivo EXCLUIDOS** (`excluded_payment_types: ["ticket","atm"]`) → solo **tarjeta** (crédito/débito, cuotas) + **dinero en cuenta MP**. Pagos **instantáneos**.
3. Redirige a **Mercado Pago (Checkout Pro)**.
4. Vuelve a `/checkout/gracias` (back_urls: success / failure / pending).

## 2. Webhook de pago (la fuente de verdad)

- MP envía notificación al endpoint server (route handler de Next).
- **Nunca confiar solo en el redirect** ni en el payload: al recibir el aviso, **consultar el pago a la API de MP** por su `id` y usar ese estado.
- **Idempotencia** por `mpPaymentId` (índice único) → un webhook repetido no duplica efectos.
- **Verificación de origen:** validar la firma `x-signature` de MP antes de procesar.
- Actualiza `Payment` + `Order` según el estado real.

## 3. Máquina de estados del pedido

```
pending_payment ──approved──▶ paid ──▶ preparing ──▶ shipped ──▶ delivered
       │
       ├─ rejected / expirado(24h) ──▶ cancelled
       │
paid ──refund (manual)──▶ refunded
```

- `pending_payment` es **transitorio** (segundos): al ser todo pago instantáneo, casi no hay limbo.
- `PaymentStatus` (espejo de MP) maneja el sub-estado del cobro; `OrderStatus` el ciclo operativo.

## 4. Stock en el flujo

- **D04-1 ✔ — No se reserva** stock al iniciar checkout. Se **descuenta al confirmarse el pago** (webhook `approved`), con **validación de disponibilidad** en ese momento.
- Chequeo suave de stock antes de crear la preference.
- **Oversell:** volumen bajo → riesgo mínimo; si tras el pago no hay stock (doble compra del último item), se marca el pedido y se resuelve por WhatsApp (devolución/coordinación).

## 5. Casos borde

- **Efectivo / offline: EXCLUIDO** → no hay pedidos "pendientes" de efectivo.
- **Tarjeta en revisión (`in_process`):** raro; el pedido queda `pending_payment` hasta que el webhook confirme `approved`/`rejected` (automático).
- **No pagado / abandonado en MP:** la `Order` se **autocancela a las 24h** si no llega `approved` (no hay efectivo que esperar). **(D04-2)**
- **Rechazado:** permitir **reintento** (regenerar preference). **Preference expirada:** regenerar.
- **Webhook duplicado / fuera de orden:** idempotencia + estado más reciente de MP.
- **Cupón** revalidado en el server antes de confirmar el total.

> **Nota (tradeoff):** excluir efectivo simplifica la operación pero deja afuera a clientas sin tarjeta (Rapipago/Pago Fácil es popular en AR). Reactivable a futuro con manejo de pendientes a 24–48h si se quiere captar ese público.

## 6. Reembolsos, consultas y reclamos

- **D04-3 ✔ — Todo por el WhatsApp de Glamify**, lo maneja la dueña a mano. **Sin reembolsos automáticos ni por API.**
- Si corresponde devolver, la dueña lo hace desde el **panel de Mercado Pago** y marca el pedido en el admin (`refunded`/`cancelled`) para registro.
- La web muestra el **WhatsApp** para consultas/reclamos. El **Botón de Arrepentimiento** legal (ver `02`) deriva al mismo canal/proceso.

## 7. Seguridad

- Verificar **firma del webhook** (`x-signature`) + **consultar el pago** a MP (doble check).
- `external_reference = orderId` para mapear sin ambigüedad.
- **Secrets** (access token MP, webhook secret) en variables de entorno — nunca en el cliente.
- **Montos y total recalculados en el server** (nunca confiar en el precio que manda el cliente).
- Idempotencia en el procesamiento del webhook.

## 8. Decisiones

- **D04-1 ✔** — Stock: no reservar; descontar al pagar.
- **D04-2 ✔** — Solo pasarela MP **instantánea** (efectivo/offline excluido); pedidos no aprobados se autocancelan a las **24h**.
- **D04-3 ✔** — Reembolsos/consultas/reclamos por **WhatsApp**, manual; sin automáticos.
