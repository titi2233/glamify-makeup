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
 * `dimensions.weight` va en KG (decimales); largo/ancho/alto en CM.
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
        weight: Math.max(0.1, input.pesoGr / 1000), // gramos → kg; piso 0.1kg.
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
