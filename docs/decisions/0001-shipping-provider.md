# ADR 0001 — Proveedor de cotización de envíos

**Fecha:** 2026-08-26
**Estado:** aceptada

## Problema

Zipnova (agregador contratado como workaround cuando el acceso directo a la API de MiCorreo
parecía bloqueado) cobra ~2x el costo real de Correo Argentino por el mismo envío. Se cotizó
en vivo el mismo paquete en ambas plataformas el mismo día y se confirmó el markup con la
sesión logueada real, no con documentación de terceros. El blueprint 05 §3-4 siempre
especificó MiCorreo como la API en vivo (Zipnova fue una desviación posterior, no el plan
original) — hace falta resolver el acceso real y, mientras tanto, no depender de ningún
agregador con markup oculto.

## Precedente propio

`blueprints/05-envios-logistica.md` §3-4: "La API de MiCorreo devuelve la tarifa; si no
cotiza, se usa la zona que matchee el CP (fallback)". Ningún número de `methodFactor` está
especificado ahí — el 0.85 actual en `lib/shipping/quote.ts` fue una suposición de
implementación, no un requisito del blueprint.

## Alternativas descartadas

1. **Zipnova / Zippin** — markup ~94% sobre MiCorreo directo, verificado en vivo el mismo día
   con el mismo paquete y mismo transportista (Correo Argentino): $11.877 vía Zipnova vs.
   $6.113 directo (PAQ.AR Clásico). Zippin resultó ser la misma empresa: `zippin.com.ar/precios`
   redirige (301) a `zipnova.com/ar/productos/envios/precios` — no es una alternativa real.
2. **PAQ.AR API directa (Correo Argentino)** — exige acuerdo comercial gestionado con
   ejecutivo; ya se intentó por mail sin respuesta útil. Tres fuentes independientes
   confirman que las credenciales de API (no la cuenta MiCorreo en sí, que es de alta libre)
   pasan por gestión comercial.
3. **Andreani** — misma barrera: acuerdo comercial obligatorio, tarifas de lista más altas,
   descrito como "inaccesible para tiendas chicas" en comparativas 2026.
4. **OCA / ePak** — alta con aprobación de documentación fiscal (AFIP, monotributo/RI), no
   autogestionable end-to-end; hilo de Comunidad Tiendanube confirma fricción real de
   usuarios en situación fiscal similar a la de Tiziana.
5. **Enviopack** — verificado en su sitio el mismo día: hoy es venta consultiva ("Solicitá
   una llamada"), posicionado para fulfillment/mayoristas ("+2500 marcas", logística de
   almacén). Sin alta autoservicio visible — misma barrera comercial que PAQ.AR/Andreani/OCA,
   y forma equivocada (fulfillment de almacén) para una operación casera.
6. **Melonn y otras fulfillment companies** — descartadas sin profundizar: son
   almacén + pick&pack, no aplica a una operación manejada desde casa.

## Decisión

Plan en dos tiempos, sin nueva dependencia externa para lanzar.

**Ahora:** apagar la cotización en vivo. `quoteShipping()` (`lib/shipping/index.ts`) ya no
tiene a Zipnova como proveedor por defecto — cae directo a la tabla estática de
`ShippingZone`. El despacho de cada pedido lo hace Tiziana a mano desde su cuenta MiCorreo ya
operativa (validado en vivo: alta sin acuerdo comercial, cotiza y genera guías sin fricción).

**Después (mejora, no bloquea el lanzamiento):** reintentar el pedido de credenciales de API
de MiCorreo — ahora con CUIT de monotributo válido — por el canal "Ingresar Reclamos" dentro
de la cuenta (más trazable que el mail genérico ya probado). Si se consigue, un
`lib/shipping/micorreo.ts` nuevo se inyecta como `deps.liveQuote` en `checkout-service.ts` /
`actions.ts`, sin tocar el resto de `quoteShipping()`.

### Datos reales verificados el mismo día (paquete idéntico: 12x5x5cm, 0,5kg, $30.000 declarado)

| Destino | Sucursal Clásico | Sucursal Expreso | Domicilio Clásico | Domicilio Expreso |
|---|---|---|---|---|
| Buenos Aires/GBA (La Plata, CP 1900) | $6.113 | $8.410 | $8.955 | $12.314 |
| Córdoba capital | $6.113 | $8.410 | — | — |
| Ushuaia (extremo sur del país) | $6.941 | $15.902 | $9.808 | $22.483 |

Hallazgo clave: **PAQ.AR Clásico a sucursal es casi plano en todo el país** (+13% de Buenos
Aires a Ushuaia, los dos extremos posibles). El `methodFactor` actual en código
(sucursal = 0.85× domicilio) está mal calibrado contra estos datos: la proporción real medida
es ~0.68-0.71×, no 0.85×. Es una corrección de código (el número no viene del blueprint, ver
arriba) — pero el precio final a cobrar en el checkout es una decisión de negocio de Tiziana,
no técnica, y queda pendiente de su confirmación antes de tocar `ShippingZone` en producción.

## Reversibilidad

Barata. `quoteShipping()` aísla el proveedor de cotización en vivo detrás de una función con
fallback null-safe a zona (`LiveQuote` es un tipo genérico, no atado a un vendor). Apagar
Zipnova, recalibrar zonas, o más adelante enchufar MiCorreo real son cambios de un archivo
cada uno, sin migración de datos ni contrato publicado de por medio. No amerita segundo par de
ojos (`architecture-decision-reviewer`) por esta razón — reservado para decisiones caras de
revertir, que esta no es.

## Consecuencias aceptadas

- Sin cotización en vivo al momento del lanzamiento: el checkout muestra una **estimación por
  zona**, no el precio garantizado real — mismo riesgo que ya existía como fallback, ahora es
  el camino principal.
- Despacho 100% manual para Tiziana (login a MiCorreo por pedido) hasta que la API esté
  disponible — carga operativa real, no automatizable todavía.
- Si el pedido de credenciales de API vuelve a estancarse, esta queda como la solución
  permanente, no transitoria — vale la pena asumirlo así desde el vamos.
- `lib/shipping/zipnova.ts` queda huérfano (sin importadores fuera de sus propios tests y del
  script de prueba) pero intacto — no se borra sin autorización explícita de Lazar por ítem.
