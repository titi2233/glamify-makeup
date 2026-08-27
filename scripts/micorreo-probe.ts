/**
 * Sondeo de la integración con MiCorreo: cotiza contra la API REAL usando el mismo
 * módulo que usa el checkout (`lib/shipping/micorreo`), para verificar el flujo
 * completo (token → validate → rates) contra respuestas reales.
 *
 * Cotizar no consume saldo ni crea envíos.
 *
 *   pnpm micorreo:probe                 # La Plata (1900), Clásico
 *   pnpm micorreo:probe 5000            # otro CP destino
 *   pnpm micorreo:probe 1900 --raw      # ver el JSON crudo de /rates
 *
 * Requiere en .env: MICORREO_EMAIL, MICORREO_PASSWORD, MICORREO_GATEWAY_AUTH
 * Opcionales: MICORREO_SANDBOX=1, MICORREO_ORIGIN_CP, MICORREO_VELOCITY=classic|express
 */
import { quoteMicorreo, isMicorreoConfigured, DEFAULT_ITEM_CM } from "../src/lib/shipping/micorreo";

const METODOS = ["domicilio", "sucursal"] as const;
const PESO_GR = 500;

async function main(): Promise<void> {
  if (!isMicorreoConfigured()) {
    throw new Error("Faltan MICORREO_EMAIL / MICORREO_PASSWORD / MICORREO_GATEWAY_AUTH en .env");
  }

  const cp = process.argv[2] ?? "1900";
  const base = process.env.MICORREO_SANDBOX === "1" ? "TEST" : "PROD";
  const velocidad = process.env.MICORREO_VELOCITY === "express" ? "Expreso" : "Clásico";
  const origen = process.env.MICORREO_ORIGIN_CP || "6700";
  console.log(`Origen ${origen} → destino ${cp}  ·  ${PESO_GR}g  ·  ${velocidad}  ·  [${base}]\n`);

  for (const metodo of METODOS) {
    const q = await quoteMicorreo({ cpDestino: cp, pesoGr: PESO_GR, metodo });
    if (!q) {
      console.log(`  ${metodo.padEnd(10)} sin cotización (cae a la tabla de zonas)`);
      continue;
    }
    console.log(`  ${metodo.padEnd(10)} $${q.cost.toLocaleString("es-AR")}  ·  ${q.carrier}`);
  }

  if (process.argv.includes("--raw")) {
    console.log("\n(--raw no implementado para MiCorreo: el flujo hace 3 llamadas con token; usá el probe normal)");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
