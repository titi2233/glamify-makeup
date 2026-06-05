export type CorreoEnv = {
  MICORREO_USER?: string;
  MICORREO_PASSWORD?: string;
  MICORREO_AGREEMENT?: string;
};

/** ¿Hay credenciales de MiCorreo? (API real diferida a M5; sin esto → fallback a zonas). */
export function isCorreoConfigured(env: CorreoEnv = process.env): boolean {
  return Boolean(env.MICORREO_USER && env.MICORREO_PASSWORD && env.MICORREO_AGREEMENT);
}

export interface CorreoQuoteInput {
  cpDestino: string;
  pesoGr: number;
  metodo: "domicilio" | "sucursal";
}

/**
 * Cotización en vivo de MiCorreo. Diferido a M5: sin credenciales devuelve null → el
 * orquestador cae a la tabla de zonas. (El seam queda listo para enchufar la API real.)
 */
export async function quoteCorreo(_input: CorreoQuoteInput, env: CorreoEnv = process.env): Promise<number | null> {
  if (!isCorreoConfigured(env)) return null;
  // TODO(M5): llamar a la API REST de MiCorreo (JWT) con CP origen 6700 + peso. Por ahora null.
  return null;
}
