export interface MpSignatureInput {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}

/** Parsea "ts=...,v1=..." → { ts, v1 }. */
function parseSignatureHeader(header: string): { ts: string; v1: string } | null {
  const parts = header.split(",").reduce<Record<string, string>>((acc, kv) => {
    const [k, val] = kv.split("=");
    if (k && val) acc[k.trim()] = val.trim();
    return acc;
  }, {});
  if (!parts.ts || !parts.v1) return null;
  return { ts: parts.ts, v1: parts.v1 };
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación constant-time de dos hex del mismo largo. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifica la firma x-signature de Mercado Pago (HMAC-SHA256). Web Crypto → Workers-safe.
 * Manifest (doc MP): `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
 */
export async function verifyMpSignature(input: MpSignatureInput): Promise<boolean> {
  const { xSignature, xRequestId, dataId, secret } = input;
  if (!xSignature || !secret) return false;
  const parsed = parseSignatureHeader(xSignature);
  if (!parsed) return false;

  const manifest = `id:${dataId};request-id:${xRequestId ?? ""};ts:${parsed.ts};`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  return timingSafeEqualHex(toHex(sig), parsed.v1);
}
