/**
 * Envío automático a MiCorreo cuando un pedido pasa a pagado.
 *
 * "Importa" (pre-impone) el pedido en la cuenta de MiCorreo apenas se acredita el
 * pago, así la dueña no tiene que recargar los datos a mano. NO despacha ni cobra:
 * el rótulo y el pago del envío se hacen después desde el panel de MiCorreo
 * (ver el bloque de contexto en `lib/shipping/micorreo.ts`).
 *
 * Es best-effort: se llama fuera de la transacción del webhook y cualquier fallo se
 * traga (el pedido ya está pagado igual). Si no se importa, el Shipment queda como
 * estaba (pending) para carga manual.
 *
 * Límite conocido: sólo funciona para envíos a DOMICILIO. En "sucursal" no guardamos
 * qué sucursal eligió la clienta, así que esos pedidos se cargan a mano.
 */
import {
  createMicorreoShipment,
  type MicorreoShipmentInput,
  type MicorreoEnv,
} from "@/lib/shipping/micorreo";

/** Forma del `shippingAddress` (Json) que guarda el checkout. */
interface StoredAddress {
  cp?: string;
  province?: string | null;
  street?: string;
  number?: string;
  city?: string;
}

/** Campos del pedido que necesita el auto-import. */
export interface AutoShipmentOrder {
  orderNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  shippingMethod: string; // "domicilio" | "sucursal"
  shippingAddress: unknown; // Json guardado en el checkout
  weightGr: number;
  /** Valor declarado del contenido (subtotal de productos). */
  declaredValue: number;
}

export type AutoShipmentOutcome =
  | { imported: true; service: string; detail: string }
  | { imported: false; detail: string };

/** Etiqueta del servicio según la velocidad configurada (para guardar en Shipment.service). */
function serviceLabel(env: MicorreoEnv): string {
  return env.MICORREO_VELOCITY === "express" ? "Correo Argentino Expreso" : "Correo Argentino Clásico";
}

/**
 * Arma el input de importación desde el pedido. Pura y testeable.
 * Devuelve `{ skip }` (con motivo) cuando el pedido no se puede auto-importar.
 */
export function buildImportInput(order: AutoShipmentOrder): { input: MicorreoShipmentInput } | { skip: string } {
  if (order.shippingMethod === "sucursal") {
    return { skip: "pedido a sucursal: no se guarda la sucursal elegida, se carga a mano" };
  }
  const a = (order.shippingAddress ?? {}) as StoredAddress;
  if (!a.street?.trim() || !a.number?.trim() || !a.city?.trim() || !a.cp?.trim() || !a.province?.trim()) {
    return { skip: "dirección incompleta en el pedido" };
  }
  return {
    input: {
      extOrderId: order.orderNumber,
      recipient: { name: order.contactName, email: order.contactEmail, phone: order.contactPhone },
      metodo: "domicilio",
      pesoGr: order.weightGr,
      valorDeclarado: order.declaredValue,
      address: {
        streetName: a.street.trim(),
        streetNumber: a.number.trim(),
        city: a.city.trim(),
        province: a.province.trim(),
        postalCode: a.cp.trim(),
      },
    },
  };
}

/** MiCorreo rechaza un `extOrderId` ya importado; eso es un no-op idempotente, no un error real. */
function isAlreadyImported(error: string): boolean {
  return /importad|anterioridad|already imported/i.test(error);
}

/**
 * Importa el envío en MiCorreo. `importFn` inyectable para tests.
 * Nunca tira: devuelve el resultado como dato.
 */
export async function autoImportShipment(
  order: AutoShipmentOrder,
  importFn: typeof createMicorreoShipment = createMicorreoShipment,
  env: MicorreoEnv = process.env as MicorreoEnv,
): Promise<AutoShipmentOutcome> {
  const built = buildImportInput(order);
  if ("skip" in built) return { imported: false, detail: built.skip };

  const res = await importFn(built.input, env);
  if (res.ok) {
    return { imported: true, service: serviceLabel(env), detail: `importado (${res.createdAt ?? "ok"})` };
  }
  if (isAlreadyImported(res.error)) {
    return { imported: true, service: serviceLabel(env), detail: `ya estaba importado: ${res.error}` };
  }
  return { imported: false, detail: res.error };
}
