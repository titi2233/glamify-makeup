# Fase 4 — Pesos reales de productos

## 1. Schema (`prisma/schema.prisma`)

- `Product.weightGr`: `Int` NOT NULL, sin `@default` — confirmado también a nivel DB (`prisma/migrations/20260604125542_init/migration.sql:62`).
- `ProductVariant.weightGrOverride`: `Int?` nullable, override opcional por variante.
- `Order.weightGr`: `Int @default(0)` — es snapshot al checkout (`checkout-service.ts:153`), no dato fuente; el default 0 es correcto porque siempre se sobreescribe.

🟢 El campo fuente es obligatorio y sin default — no puede quedar `NULL` por diseño.

## 2. Seed (`prisma/seed.ts`)

12 productos, pesos escalonados por tipo real (esponja 12g … set de brochas 200g), no un placeholder uniforme. 🟢 para ser fixtures — pero **`seed.ts` es dev/preview, no el catálogo real** que va a vender la dueña.

## 3. Formulario admin

`product-form.tsx:46` arranca en `weightGr: ""` (vacío, sin default trampa). `validation.ts:145` rechaza crear/editar si `weightGr` no es entero > 0 (`isPositiveInt`). 🟢 No hay bypass: en el flujo normal es imposible cargar un producto sin peso.

## 4. Cálculo de envío (`src/lib/shipping/quote.ts:3-9`)

```ts
export const DEFAULT_WEIGHT_GR = 50;
export function orderWeightGr(lines) {
  const total = lines.reduce((acc, l) => acc + (l.weightGr > 0 ? l.weightGr : DEFAULT_WEIGHT_GR) * l.qty, 0);
  return total > 0 ? total : DEFAULT_WEIGHT_GR;
}
```
Si una línea trae `weightGr <= 0` cae a 50g — comportamiento intencional y documentado (blueprint 05:36), testeado (`tests/unit/shipping/quote.test.ts:13-18`). Dado el punto 1 y 3, en el flujo normal es casi imposible llegar a esto (única vía teórica: combo vacío). El fallback es **silencioso** — no loguea ni alerta cuando se dispara.

Caja fija sin medidas reales (`micorreo.ts:29`, `DEFAULT_ITEM_CM`): decisión de producto ya documentada ("el peso domina la tarifa"), no bug.

🟢 mecanismo / 🟡 impacto si el dato fuente es placeholder: si el peso real es mayor a 50g y por error se cargó como 0, MiCorreo cotiza de menos y la dueña absorbe la diferencia sin aviso.

## REQUIERE INPUT

1. **¿Los productos reales del catálogo (no los 12 del seed) ya fueron pesados en balanza y cargados con su peso real en el admin?** Tarea operativa — el código fuerza a completar el campo pero no puede verificar que el número sea físicamente correcto.
2. Si ya hay productos en producción, verificar los `weightGr` reales en la DB (esta auditoría solo pudo leer el seed de dev/preview, sin acceso a DB de prod).
3. Decisión de producto (no bloqueante): ¿alertar cuando `orderWeightGr` cae al fallback de 50g en un pedido real, para pescar productos mal cargados? Hoy es silencioso.

## Veredicto de la fase

Código: 🟢 sólido — obligatoriedad + validación + fallback documentado y testeado. El riesgo real es 100% operativo: que los números cargados sean el peso físico verdadero de cada producto, algo que solo la dueña puede confirmar pesando y cargando el catálogo real antes de vender.
