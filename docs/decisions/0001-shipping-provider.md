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
2. **PAQ.AR API v2 (corporativa)** — exige acuerdo comercial gestionado con ejecutivo; ya se
   intentó por mail sin respuesta útil. **Ojo:** esto aplica a la API v2 corporativa, no a la
   API MiCorreo REST — ver la corrección más abajo, que es la que sí nos sirve.
3. **Andreani** — sí tiene autoservicio sin acuerdo comercial (`pymes.andreani.com`, producto
   "Paquetería"), a diferencia de lo que decían las comparativas genéricas — pero verificado en
   vivo el mismo paquete (Luján→La Plata, 0,5kg/12x5x5cm, $30.000 declarado): **$24.902
   sucursal / $26.724 domicilio**. 2x Zipnova y 4x MiCorreo directo. Descartado por precio, no
   por acceso — el declarado mínimo de $30.000 y el precio plano por tramo ("Chico" hasta 10kg)
   sugieren que el producto está pensado para paquetes más grandes/pesados, no para maquillaje.
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

**Cotización en vivo contra la API oficial de MiCorreo**, por el camino self-service (sin
acuerdo comercial ni atención al cliente), elegido por el dueño el 2026-08-27.

- `lib/shipping/micorreo.ts` implementa el flujo verificado del plugin GPL (`/token` →
  `/users/validate` → `/rates`), y es el `liveQuote` por defecto de `quoteShipping()`
  (`lib/shipping/index.ts`). Sin credenciales en el entorno devuelve `null` y todo cae a la
  tabla de zonas — el checkout nunca se rompe por esto.
- Se activa cargando en el entorno `MICORREO_EMAIL`, `MICORREO_PASSWORD` y
  `MICORREO_GATEWAY_AUTH` (el dueño los pone en `.env` / `wrangler secret`; nunca en el repo).
  Opcionales: `MICORREO_SANDBOX`, `MICORREO_ORIGIN_CP` (default 6700), `MICORREO_VELOCITY`
  (default `classic`).
- Verificación: `pnpm micorreo:probe [cp]` cotiza contra la API real y debe devolver ~$6.113
  a sucursal para La Plata (1900), el número que ya vimos en la web de MiCorreo.
- La tabla de zonas queda de fallback, ya recalibrada al costo real (ver más abajo).

**Riesgo aceptado por el dueño:** la credencial de gateway es un secreto compartido del
ecosistema de plugins, no propia. Si el vendor la rota, la cotización en vivo deja de andar y
todo cae al fallback de zonas (degradación suave, no caída). Es zona gris de ToS. El dueño
priorizó no depender de atención al cliente por encima de ese riesgo.

### Corrección: son DOS APIs distintas (verificado 2026-08-27)

Una investigación previa concluyó que "la API exige acuerdo comercial" leyendo el manual
equivocado. Correo Argentino publica **dos APIs** en su portal de desarrolladores
(`tintegraciones.correoargentino.com.ar`, público, sin gate comercial):

| | **API MiCorreo REST** | **API v2.0 REST (PAQ.AR)** |
|---|---|---|
| Base (real, del plugin) | `api.correoargentino.com.ar/micorreo/v1/` | `.../paqar/v1/` |
| Test | `apitest.correoargentino.com.ar/micorreo/v1/` | `.../paqar/v1/` |
| Utilización de API KEY | **No** | Sí |
| Devuelve ID de usuario de MiCorreo | **Sí** | No |
| Manual | `apiMiCorreo.pdf` | `apiPaqAr-v2.pdf` |

La que nos sirve es **API MiCorreo REST**: valida las credenciales de la cuenta MiCorreo
existente y devuelve un customer ID; no necesita acuerdo comercial ni cuenta corriente (los
envíos se descuentan del saldo prepago de la cuenta, que ya está operativa). Endpoints
relevantes: `users/validate`, `rates`, `agencies`, `shipping/import`. Hay ambiente de test.

**Cómo lo hacen los devs sin depender de atención al cliente (verificado leyendo código
productivo, 2026-08-27).** Se descargaron y auditaron los plugins open-source (GPL) de
WooCommerce que hoy usan cientos de tiendas. El más relevante, `carriers-of-argentina-for-woocommerce`
(vendor "yipi/KShipping"), pega **directo** contra `api.correoargentino.com.ar/micorreo/v1`
sin proxy propio. Su flujo de auth real:

1. `POST /token` con **dos capas**: header `Authorization: Basic <cred>` (una credencial de
   gateway **hardcodeada y ofuscada** en el plugin) + body `{email, password}` (el login normal
   de la cuenta MiCorreo del comerciante). Devuelve un JWT (`token`) con expiración + el
   `customer_id`.
2. Las llamadas siguientes (`/rates`, `/shipping/import`, sucursales) van con
   `Authorization: Bearer <JWT>` y el `customerId` en el body.

Correcciones a lo que decía antes esta misma sección:

- **La base correcta es `/micorreo/v1/`, no `/paqar/v1/`.** El `/paqar/v1` de la FAQ del portal
  es la API corporativa. Mi probe anterior dio 403 en parte por pegarle a la ruta equivocada.
- **La credencial de gateway NO se pide por comerciante.** Es un secreto compartido embebido
  en los plugins GPL de distribución pública (de facto público, se baja de wordpress.org). El
  único dato por-comerciante es el `email`+`password` de la cuenta MiCorreo — que ya tenemos.
- Sigue siendo cierto que sin la credencial de gateway el endpoint devuelve 403 (mi test lo
  confirmó): la hipótesis "alcanza con email+password" es incompleta, pero le faltaba solo esa
  pieza, que resulta ser pública, no gestionada.

**Implicancia:** hay un camino self-service real, sin atención al cliente ni acuerdo comercial.
`lib/shipping/micorreo.ts` implementaría exactamente ese flujo (`/token` → `/rates`), leyendo
`MICORREO_EMAIL`, `MICORREO_PASSWORD` y `MICORREO_GATEWAY_AUTH` desde `.env` (mismo patrón que
el resto de los secrets; el valor de gateway lo provee el dueño, no se hardcodea en el repo).
Zona estática queda de fallback.

Este flujo es el que implementa `lib/shipping/micorreo.ts` (ver sección Decisión arriba). El
trade-off de riesgo quedó documentado y aceptado por el dueño.

Nota operativa: la cuenta de MiCorreo figura hoy como "Tipo de documento: Consumidor final";
conviene actualizarla a CUIT/monotributo.

### Datos reales verificados el mismo día (paquete idéntico: 12x5x5cm, 0,5kg, $30.000 declarado)

| Destino | Sucursal Clásico | Sucursal Expreso | Domicilio Clásico | Domicilio Expreso |
|---|---|---|---|---|
| Buenos Aires/GBA (La Plata, CP 1900) | $6.113 | $8.410 | $8.955 | $12.314 |
| Córdoba capital | $6.113 | $8.410 | — | — |
| Ushuaia (extremo sur del país) | $6.941 | $15.902 | $9.808 | $22.483 |

Hallazgo clave: **PAQ.AR Clásico a sucursal es casi plano en todo el país** (+13% de Buenos
Aires a Ushuaia, los dos extremos posibles). El `methodFactor` que traía el código
(sucursal = 0.85× domicilio) estaba mal calibrado contra estos datos: la proporción real
medida es 0.68-0.71×.

**Control de distancia (Lazar preguntó si el precio alto de Zipnova se explicaba por la
distancia Luján→La Plata; se verificó agregando dos tramos cortos reales, mismo paquete):**

| Proveedor (a sucursal) | Luján→Luján (0 km) | Luján→Mercedes (~30 km) | Luján→La Plata (~130 km) |
|---|---|---|---|
| **MiCorreo directo** (PAQ.AR Clásico) | **$5.044** | **$5.044** | **$6.113** |
| **Zipnova** (sobre Correo Argentino) | **$11.877** | **$11.877** | **$11.877** |

Zipnova cobra **el mismo número exacto en los tres tramos**, incluso para una entrega dentro
de la misma ciudad de origen. No es una tarifa por distancia: es un precio plano ~2,35× sobre
el costo real del mismo transportista en el tramo corto. MiCorreo directo sí escala (suave)
con la zona real. La distancia no explica nada del markup — lo confirma.

**Confirmado por Tiziana (2026-08-26): costo real, redondeado, sin margen.** `ShippingZone.price`
(costo a domicilio) pasa a $9.000 en AMBA/Buenos Aires interior/Centro y $10.000 en el resto
del país; `methodFactor(sucursal)` pasa de 0.85 a 0.7 (`lib/shipping/quote.ts`). Aplicado en
`prisma/seed.ts` y en la tabla `ShippingZone` de producción.

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
