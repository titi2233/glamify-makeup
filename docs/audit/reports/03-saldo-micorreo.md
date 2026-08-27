# Fase 3 — Saldo prepago MiCorreo

## Hallazgo único: no hay (ni puede haber) verificación de saldo en código

`src/lib/shipping/micorreo.ts:271-283` documenta explícitamente, en un comentario del propio desarrollo previo, qué hace y qué NO hace el endpoint `POST /shipping/import`:

> "Importar" es una PRE-IMPOSICIÓN: deja el pedido cargado en la cuenta de MiCorreo. La respuesta es sólo `{ createdAt }` — NO devuelve número de seguimiento ni etiqueta. El tracking y el rótulo se obtienen después entrando a MiCorreo, **pagando el envío con el saldo** e imprimiendo.

No existe en el repo ningún endpoint de MiCorreo para consultar saldo (`Grep -i "saldo|balance|prepago|credit"` sobre `src/lib/shipping/` no encuentra ninguna llamada a API de saldo — solo ese comentario). Esto es correcto y esperado: MiCorreo/PaqAr no expone ese dato vía la API que usa el proyecto (confirmado en el blueprint `05-envios-logistica.md:25`, que ya anticipaba "requiere credenciales MiCorreo antes de lanzar" sin mencionar saldo).

**Consecuencia real para el flujo:** el sistema (auto-import + botón "Reintentar") puede reportar `imported: true` con total éxito — la pre-imposición se cargó bien — y el pedido **igual quedar sin despachar** si la cuenta de MiCorreo no tiene saldo cargado cuando Tiziana entra al panel a pagar/imprimir la etiqueta. El código no puede detectar ni avisar esto: es estado de una cuenta externa, invisible para la API que se usa.

🟢 Código: correcto, no hay nada que arreglar — el comentario ya deja explícito el límite, y la burbuja de instrucciones en el admin (`micorreo-panel.tsx`) ya le dice a la usuaria que tiene que entrar al panel de MiCorreo a completar el despacho, lo cual cubre el paso manual de pago/impresión.

🔴 **REQUIERE INPUT — operativo, no de código:** confirmar que la cuenta de MiCorreo tiene saldo prepago cargado ANTES de la primera venta real, y establecer un hábito de recarga (ej. revisar saldo cada vez que entra un pedido nuevo, o recargar con margen antes de una tanda de ventas). Si se agota el saldo a mitad de una racha de pedidos, la falla es silenciosa para el sistema — solo se nota cuando Tiziana entra a MiCorreo a imprimir y no puede.

## Veredicto de la fase

No hay hallazgo de código. El riesgo es 100% operativo y depende de un hábito humano (cargar/vigilar saldo), no de nada que este audit pueda cerrar con un fix.
