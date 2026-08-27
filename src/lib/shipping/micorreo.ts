/**
 * Cotización en vivo contra la API oficial de MiCorreo (Correo Argentino).
 *
 * Flujo verificado leyendo el plugin GPL `carriers-of-argentina-for-woocommerce`,
 * que pega directo contra `api.correoargentino.com.ar/micorreo/v1` (ver
 * docs/decisions/0001-shipping-provider.md):
 *
 *   1. POST /token          Basic <gateway> + {email,password}  → { token, expire }
 *   2. POST /users/validate Bearer <token>  + {email,password}  → { customerId }
 *   3. POST /rates          Bearer <token>  + {customerId, CPs, deliveredType, dimensions}
 *                                                               → { rates: [{ productType, price, deliveryTimeMax }] }
 *
 * `productType`: CP = Clásico (2-5 días), EP = Expreso (1-3 días).
 * `deliveredType`: S = sucursal, D = domicilio.
 * `dimensions.weight` va en GRAMOS enteros; largo/ancho/alto en CM.
 *
 * Cae a null ante cualquier problema para que el orquestador use la tabla de zonas
 * en vez de romper el checkout.
 */
import type { LiveQuote } from "@/lib/shipping/index";

const API_BASE_PROD = "https://api.correoargentino.com.ar/micorreo/v1";
const API_BASE_TEST = "https://apitest.correoargentino.com.ar/micorreo/v1";
const TIMEOUT_MS = 6000;
const ORIGIN_CP_DEFAULT = "6700"; // Luján (blueprint 05 §4)

/** Dimensiones por paquete (cm). El catálogo guarda `weightGr` pero no medidas;
 *  el maquillaje es chico y homogéneo, el peso domina la tarifa. */
export const DEFAULT_ITEM_CM = { length: 12, width: 5, height: 5 } as const;

/** Nuestro método → código `deliveredType` de MiCorreo. */
const DELIVERED_BY_METHOD = { domicilio: "D", sucursal: "S" } as const;

/** Nuestra velocidad → `productType` de MiCorreo. Default Clásico (más barato). */
const PRODUCT_BY_VELOCITY = { classic: "CP", express: "EP" } as const;

export type MicorreoEnv = {
  MICORREO_EMAIL?: string;
  MICORREO_PASSWORD?: string;
  /** Token de gateway (parte base64 de "Basic ..."); el código antepone "Basic ". */
  MICORREO_GATEWAY_AUTH?: string;
  /** "1" para pegar contra apitest en vez de producción. */
  MICORREO_SANDBOX?: string;
  /** CP de origen; default 6700 (Luján). */
  MICORREO_ORIGIN_CP?: string;
  /** "classic" (default) o "express". */
  MICORREO_VELOCITY?: string;
};

/** ¿Hay credenciales de MiCorreo? Sin esto → fallback a la tabla de zonas. */
export function isMicorreoConfigured(env: MicorreoEnv = process.env as MicorreoEnv): boolean {
  return Boolean(env.MICORREO_EMAIL && env.MICORREO_PASSWORD && env.MICORREO_GATEWAY_AUTH);
}

export interface MicorreoQuoteInput {
  cpDestino: string;
  pesoGr: number;
  metodo: "domicilio" | "sucursal";
}

/** Forma mínima de la respuesta de /rates que nos importa. */
export interface MicorreoRatesResponse {
  rates?: Array<{
    productType?: string;
    productName?: string;
    price?: number;
    deliveryTimeMax?: number;
  } | null>;
}

/**
 * Elige la tarifa del `productType` pedido (CP/EP). Pura: se testea sin red.
 * `deliveryTimeMax` viene en días hábiles; la exponemos como texto legible.
 */
export function pickRate(res: MicorreoRatesResponse, productType: "CP" | "EP"): LiveQuote | null {
  const rate = res.rates?.find((r) => r?.productType === productType);
  if (!rate) return null;
  const cost = rate.price;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) return null;
  return {
    cost,
    carrier: "Correo Argentino",
    estimatedDelivery: null, // la API da días hábiles (deliveryTimeMax), no una fecha ISO.
  };
}

function apiBase(env: MicorreoEnv): string {
  return env.MICORREO_SANDBOX === "1" ? API_BASE_TEST : API_BASE_PROD;
}

// Cache de token + customerId por isolate (Workers) / proceso (Node). El /token
// trae expiración; /users/validate es estable. Evita 2 round-trips extra por cotización.
interface AuthCache {
  token: string;
  customerId: string;
  expiresAt: number;
}
let authCache: AuthCache | null = null;

/** Resetea el cache de auth (para tests). */
export function __resetMicorreoAuthCache(): void {
  authCache = null;
}

async function getAuth(
  env: MicorreoEnv,
  fetchImpl: typeof fetch,
  now: number,
): Promise<{ token: string; customerId: string } | null> {
  if (authCache && authCache.expiresAt > now) {
    return { token: authCache.token, customerId: authCache.customerId };
  }
  const base = apiBase(env);
  const creds = { email: env.MICORREO_EMAIL, password: env.MICORREO_PASSWORD };

  // 1. Token (Basic gateway + credenciales de la cuenta).
  const tokenRes = await fetchImpl(`${base}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${env.MICORREO_GATEWAY_AUTH}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(creds),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!tokenRes.ok) return null;
  const tokenJson = (await tokenRes.json()) as { token?: string; expire?: string };
  const token = tokenJson.token;
  if (!token) return null;

  // 2. customerId (Bearer token + credenciales).
  const validateRes = await fetchImpl(`${base}/users/validate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(creds),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!validateRes.ok) return null;
  const validateJson = (await validateRes.json()) as { customerId?: string | number };
  const customerId = validateJson.customerId;
  if (customerId === undefined || customerId === null || customerId === "") return null;

  // Cache hasta 60s antes de la expiración informada; si no parsea, 10 min conservador.
  const expMs = tokenJson.expire ? Date.parse(tokenJson.expire) : NaN;
  const expiresAt = Number.isFinite(expMs) ? expMs - 60_000 : now + 10 * 60_000;
  authCache = { token, customerId: String(customerId), expiresAt };
  return { token, customerId: String(customerId) };
}

/** Sucursal de MiCorreo normalizada para el selector del checkout. */
export interface MicorreoAgency {
  /** Código de agencia (lo que espera `shipping.agency` en /shipping/import). */
  code: string;
  /** Etiqueta legible para la clienta (nombre · dirección · localidad). */
  label: string;
  /** Localidad, para filtrar por la que ingresó la clienta. */
  locality: string;
}

/** Fila cruda de /agencies (estructura real anidada, verificada contra la API). */
interface RawAgency {
  code?: string;
  name?: string;
  services?: { packageReception?: boolean } | null;
  location?: { address?: { streetName?: string; streetNumber?: string; locality?: string; city?: string } | null } | null;
}

/** Normaliza una fila de /agencies. Pura y testeable. Null si no tiene código. */
export function pickAgency(row: RawAgency): MicorreoAgency | null {
  const code = (row.code ?? "").trim();
  if (!code) return null;
  const addr = row.location?.address ?? {};
  const locality = (addr.locality || addr.city || "").trim();
  const street = [addr.streetName, addr.streetNumber].filter((s) => s?.trim()).join(" ");
  const parts = [row.name?.trim(), street.trim(), locality].filter((p) => p);
  return { code, label: parts.length ? parts.join(" · ") : code, locality };
}

/**
 * Lista las sucursales de MiCorreo que RECIBEN paquetes en una provincia (código de
 * MiCorreo, ej. "B", "X"), opcionalmente filtradas por localidad (match parcial, sin
 * acentos). Devuelve [] ante cualquier problema para que el checkout degrade sin romperse.
 */
export async function getMicorreoAgencies(
  provinceCode: string,
  localityFilter: string | null = null,
  env: MicorreoEnv = process.env as MicorreoEnv,
  fetchImpl: typeof fetch = fetch,
  nowMs: number = Date.now(),
): Promise<MicorreoAgency[]> {
  if (!isMicorreoConfigured(env) || !provinceCode?.trim()) return [];
  try {
    const auth = await getAuth(env, fetchImpl, nowMs);
    if (!auth) return [];
    const url = `${apiBase(env)}/agencies?customerId=${encodeURIComponent(auth.customerId)}&provinceCode=${encodeURIComponent(provinceCode.trim())}`;
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as RawAgency[] | { agencies?: RawAgency[] };
    const rows = Array.isArray(json) ? json : (json.agencies ?? []);
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    const needle = localityFilter?.trim() ? norm(localityFilter) : null;
    return rows
      .filter((r) => r?.services?.packageReception !== false) // sólo las que reciben paquetes
      .map(pickAgency)
      .filter((a): a is MicorreoAgency => a !== null)
      .filter((a) => (needle ? norm(a.locality).includes(needle) : true));
  } catch {
    return [];
  }
}

/**
 * Cotiza un envío. Devuelve null ante cualquier problema (sin credenciales,
 * timeout, error HTTP, tarifa ausente) para caer a la tabla de zonas.
 *
 * `nowMs` es inyectable sólo para tests (el cache de auth necesita un reloj); en
 * producción usa Date.now().
 */
export async function quoteMicorreo(
  input: MicorreoQuoteInput,
  env: MicorreoEnv = process.env as MicorreoEnv,
  fetchImpl: typeof fetch = fetch,
  nowMs: number = Date.now(),
): Promise<LiveQuote | null> {
  if (!isMicorreoConfigured(env)) return null;
  if (!input.cpDestino?.trim()) return null;

  try {
    const auth = await getAuth(env, fetchImpl, nowMs);
    if (!auth) return null;

    const productType = PRODUCT_BY_VELOCITY[env.MICORREO_VELOCITY === "express" ? "express" : "classic"];
    const body = {
      customerId: auth.customerId,
      postalCodeOrigin: (env.MICORREO_ORIGIN_CP || ORIGIN_CP_DEFAULT).trim(),
      postalCodeDestination: input.cpDestino.trim(),
      deliveredType: DELIVERED_BY_METHOD[input.metodo],
      dimensions: {
        // La API exige el peso en GRAMOS enteros (probado: 400 "must be Integer value in [g]").
        weight: Math.max(1, Math.round(input.pesoGr)),
        ...DEFAULT_ITEM_CM,
      },
    };

    const res = await fetchImpl(`${apiBase(env)}/rates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return pickRate((await res.json()) as MicorreoRatesResponse, productType);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Importación de envíos (POST /shipping/import)
//
// OJO — qué hace y qué NO hace (verificado en la librería `ylazzari-correoargentino`):
// "Importar" es una PRE-IMPOSICIÓN: deja el pedido cargado en la cuenta de MiCorreo.
// La respuesta es sólo `{ createdAt }` — NO devuelve número de seguimiento ni etiqueta.
// El tracking y el rótulo se obtienen después entrando a MiCorreo, pagando el envío
// con el saldo e imprimiendo. O sea: ahorra recargar los datos a mano y evita errores
// de tipeo, pero no reemplaza el paso por el panel.
//
// Idempotencia: `extOrderId` debe ser único; MiCorreo rechaza el duplicado con
// "La orden ya fue importada con anterioridad". Usamos el orderNumber del pedido,
// así reintentar el botón nunca genera un envío doble.
// ─────────────────────────────────────────────────────────────────────────────

/** Códigos oficiales de provincia de MiCorreo (tomados del selector de su propia web). */
export const PROVINCE_CODES: Record<string, string> = {
  "BUENOS AIRES": "B",
  "CAPITAL FEDERAL": "C",
  CABA: "C",
  "CIUDAD AUTONOMA DE BUENOS AIRES": "C",
  CATAMARCA: "K",
  CHACO: "H",
  CHUBUT: "U",
  CORDOBA: "X",
  CORRIENTES: "W",
  "ENTRE RIOS": "E",
  FORMOSA: "P",
  JUJUY: "Y",
  "LA PAMPA": "L",
  "LA RIOJA": "F",
  MENDOZA: "M",
  MISIONES: "N",
  NEUQUEN: "Q",
  "RIO NEGRO": "R",
  SALTA: "A",
  "SAN JUAN": "J",
  "SAN LUIS": "D",
  "SANTA CRUZ": "Z",
  "SANTA FE": "S",
  "SANTIAGO DEL ESTERO": "G",
  "TIERRA DEL FUEGO": "V",
  TUCUMAN: "T",
};

/** Nombre de provincia → código de MiCorreo. Tolera acentos, minúsculas y espacios. */
export function provinceCode(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  return PROVINCE_CODES[key] ?? null;
}

export interface MicorreoShipmentInput {
  /** ID único del pedido de nuestro lado (orderNumber). Da idempotencia. */
  extOrderId: string;
  recipient: { name: string; email: string; phone?: string | null };
  metodo: "domicilio" | "sucursal";
  pesoGr: number;
  valorDeclarado: number;
  /** Requerido si metodo === "domicilio". */
  address?: {
    streetName: string;
    streetNumber: string;
    city: string;
    province: string;
    postalCode: string;
  } | null;
  /** Código de sucursal (de /agencies). Requerido si metodo === "sucursal". */
  agency?: string | null;
}

export type MicorreoShipmentResult =
  | { ok: true; createdAt: string | null }
  | { ok: false; error: string };

/**
 * Importa (pre-impone) un envío en MiCorreo. Ver el bloque de arriba: NO devuelve
 * tracking ni etiqueta. A diferencia de `quoteMicorreo`, acá los fallos se devuelven
 * con el motivo — es una acción del panel y la admin necesita saber qué pasó.
 */
export async function createMicorreoShipment(
  input: MicorreoShipmentInput,
  env: MicorreoEnv = process.env as MicorreoEnv,
  fetchImpl: typeof fetch = fetch,
  nowMs: number = Date.now(),
): Promise<MicorreoShipmentResult> {
  if (!isMicorreoConfigured(env)) {
    return { ok: false, error: "Falta configurar las credenciales de MiCorreo." };
  }
  if (!input.extOrderId?.trim()) return { ok: false, error: "Falta el número de pedido." };
  if (!input.recipient?.name?.trim() || !input.recipient?.email?.trim()) {
    return { ok: false, error: "El pedido no tiene nombre o email de contacto." };
  }

  const deliveryType = DELIVERED_BY_METHOD[input.metodo];
  const shipping: Record<string, unknown> = { deliveryType };

  if (input.metodo === "sucursal") {
    if (!input.agency?.trim()) {
      return {
        ok: false,
        error:
          "Este pedido es a sucursal y todavía no guardamos cuál eligió la clienta. Cargalo a mano en MiCorreo.",
      };
    }
    shipping.agency = input.agency.trim();
  } else {
    const a = input.address;
    if (!a?.streetName?.trim() || !a?.streetNumber?.trim() || !a?.city?.trim() || !a?.postalCode?.trim()) {
      return { ok: false, error: "La dirección del pedido está incompleta (calle, número, localidad o CP)." };
    }
    const code = provinceCode(a.province);
    if (!code) return { ok: false, error: `No reconozco la provincia "${a.province}".` };
    shipping.address = {
      streetName: a.streetName.trim(),
      streetNumber: a.streetNumber.trim(),
      city: a.city.trim(),
      provinceCode: code,
      postalCode: a.postalCode.trim(),
    };
  }

  // Peso en gramos acá (a diferencia de /rates, que lo toma en kg).
  shipping.weight = Math.max(1, Math.round(input.pesoGr));
  shipping.declaredValue = input.valorDeclarado;
  shipping.length = DEFAULT_ITEM_CM.length;
  shipping.width = DEFAULT_ITEM_CM.width;
  shipping.height = DEFAULT_ITEM_CM.height;

  try {
    const auth = await getAuth(env, fetchImpl, nowMs);
    if (!auth) return { ok: false, error: "No pude autenticarme con MiCorreo. Revisá las credenciales." };

    const res = await fetchImpl(`${apiBase(env)}/shipping/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        customerId: auth.customerId,
        extOrderId: input.extOrderId.trim(),
        recipient: {
          name: input.recipient.name.trim(),
          email: input.recipient.email.trim(),
          ...(input.recipient.phone ? { phone: input.recipient.phone.trim() } : {}),
        },
        shipping,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const json = (await res.json().catch(() => null)) as { createdAt?: string; message?: string } | null;
    if (!res.ok) {
      return { ok: false, error: json?.message || `MiCorreo rechazó el envío (HTTP ${res.status}).` };
    }
    return { ok: true, createdAt: json?.createdAt ?? null };
  } catch {
    return { ok: false, error: "No pude conectarme con MiCorreo. Probá de nuevo en un momento." };
  }
}
