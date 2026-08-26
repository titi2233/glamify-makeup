/**
 * Cotización en vivo contra Zipnova (agregador multi-carrier).
 *
 * Reemplaza el stub de MiCorreo: Zipnova ya tiene los acuerdos comerciales con
 * Correo Argentino, OCA, Andreani y ~40 operadores más, así que cotiza contra
 * todos y devuelve el ganador por tipo de servicio.
 *
 * El origen NO se manda: la cuenta tiene una ubicación por defecto (Luján 6700)
 * y la API la usa sola cuando se omite `origin_id`.
 */
const API_BASE = "https://api.zipnova.com.ar/v2";
const TIMEOUT_MS = 6000;

/** Dimensiones por unidad (cm). El catálogo guarda `weightGr` pero no medidas, y el
 *  maquillaje es chico y homogéneo; el peso es lo que domina la tarifa. */
export const DEFAULT_ITEM_CM = { height: 5, width: 5, length: 12 } as const;

/** Nuestro método de envío → código de `service_type` de Zipnova. */
const SERVICE_BY_METHOD = {
  domicilio: "standard_delivery",
  sucursal: "pickup_point",
} as const;

export type ZipnovaEnv = {
  ZIPNOVA_API_KEY?: string;
  ZIPNOVA_API_SECRET?: string;
  ZIPNOVA_ACCOUNT_ID?: string;
};

/** ¿Hay credenciales de Zipnova? Sin esto → fallback a la tabla de zonas. */
export function isZipnovaConfigured(env: ZipnovaEnv = process.env as ZipnovaEnv): boolean {
  return Boolean(env.ZIPNOVA_API_KEY && env.ZIPNOVA_API_SECRET && env.ZIPNOVA_ACCOUNT_ID);
}

export interface ZipnovaQuoteInput {
  cpDestino: string;
  /** Obligatorios juntos: la API rechaza el request si falta cualquiera de los dos. */
  localidad: string;
  provincia: string;
  pesoGr: number;
  metodo: "domicilio" | "sucursal";
  valorDeclarado: number;
}

/** Opción ganadora normalizada a lo que necesita el checkout. */
export interface ZipnovaQuote {
  /** Precio final con impuestos, en ARS. Es lo que se le cobra a la clienta. */
  cost: number;
  /** Operador que gana la cotización (ej. "OCA", "Correo Argentino"). */
  carrier: string;
  /** Fecha estimada de entrega (ISO 8601) o null si la API no la informa. */
  estimatedDelivery: string | null;
}

/** Forma mínima de la respuesta que nos importa (la API devuelve bastante más). */
export interface ZipnovaQuoteResponse {
  results?: Record<
    string,
    {
      selectable?: boolean;
      carrier?: { name?: string };
      delivery_time?: { estimated_delivery?: string | null };
      amounts?: { price_incl_tax?: number };
    } | null
  >;
}

/**
 * Elige la opción del método pedido. `results` ya viene indexado por código de
 * servicio y con el ganador (más barato) de cada uno, así que no hay que ordenar.
 * Pura: se testea sin red.
 */
export function pickQuote(res: ZipnovaQuoteResponse, metodo: "domicilio" | "sucursal"): ZipnovaQuote | null {
  const option = res.results?.[SERVICE_BY_METHOD[metodo]];
  if (!option || option.selectable === false) return null;
  const cost = option.amounts?.price_incl_tax;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) return null;
  return {
    cost,
    carrier: option.carrier?.name ?? "",
    estimatedDelivery: option.delivery_time?.estimated_delivery ?? null,
  };
}

/** Header de HTTP Basic auth (btoa existe tanto en Workers como en Node 18+). */
function basicAuth(key: string, secret: string): string {
  return `Basic ${btoa(`${key}:${secret}`)}`;
}

/**
 * Cotiza contra la API. Devuelve null ante cualquier problema (sin credenciales,
 * destino incompleto, timeout, error HTTP, servicio no disponible) para que el
 * orquestador caiga a la tabla de zonas en vez de romper el checkout.
 */
export async function quoteZipnova(
  input: ZipnovaQuoteInput,
  env: ZipnovaEnv = process.env as ZipnovaEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<ZipnovaQuote | null> {
  if (!isZipnovaConfigured(env)) return null;
  // La API exige city + state juntos; sin localidad no tiene sentido ni intentar.
  if (!input.localidad?.trim() || !input.provincia?.trim()) return null;

  const body = {
    account_id: Number(env.ZIPNOVA_ACCOUNT_ID),
    source: "glamify-storefront",
    declared_value: input.valorDeclarado,
    destination: {
      city: input.localidad.trim(),
      state: input.provincia.trim(),
      zipcode: input.cpDestino,
    },
    items: [{ weight: input.pesoGr, ...DEFAULT_ITEM_CM }],
  };

  try {
    const res = await fetchImpl(`${API_BASE}/shipments/quote`, {
      method: "POST",
      headers: {
        Authorization: basicAuth(env.ZIPNOVA_API_KEY!, env.ZIPNOVA_API_SECRET!),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return pickQuote((await res.json()) as ZipnovaQuoteResponse, input.metodo);
  } catch {
    return null;
  }
}
