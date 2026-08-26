/**
 * Sondeo de la integración con Zipnova: cotiza contra la API REAL usando el mismo
 * módulo que usa el checkout (`lib/shipping/zipnova`), para verificar que el parser
 * funciona contra respuestas reales y no sólo contra el fixture de los tests.
 *
 * Cotizar no consume saldo ni crea envíos.
 *
 *   pnpm zipnova:probe                            # La Plata (1900)
 *   pnpm zipnova:probe 5000 "Cordoba" "Cordoba"   # otro destino
 *   pnpm zipnova:probe 1900 "La Plata" "Buenos Aires" --raw   # ver el JSON crudo
 *
 * Requiere en .env: ZIPNOVA_API_KEY, ZIPNOVA_API_SECRET, ZIPNOVA_ACCOUNT_ID
 */
import { quoteZipnova, isZipnovaConfigured, DEFAULT_ITEM_CM } from "../src/lib/shipping/zipnova";

const METODOS = ["domicilio", "sucursal"] as const;

async function rawDump(zipcode: string, city: string, state: string): Promise<void> {
  const auth = Buffer.from(`${process.env.ZIPNOVA_API_KEY}:${process.env.ZIPNOVA_API_SECRET}`).toString("base64");
  const res = await fetch("https://api.zipnova.com.ar/v2/shipments/quote", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: Number(process.env.ZIPNOVA_ACCOUNT_ID),
      source: "glamify-probe",
      declared_value: 30000,
      destination: { city, state, zipcode },
      items: [{ weight: 150, ...DEFAULT_ITEM_CM }],
    }),
  });
  console.log(`\nHTTP ${res.status}`);
  console.log(JSON.stringify(await res.json(), null, 2));
}

async function main(): Promise<void> {
  if (!isZipnovaConfigured()) {
    throw new Error("Faltan ZIPNOVA_API_KEY / ZIPNOVA_API_SECRET / ZIPNOVA_ACCOUNT_ID en .env");
  }

  const zipcode = process.argv[2] ?? "1900";
  const city = process.argv[3] ?? "La Plata";
  const state = process.argv[4] ?? "Buenos Aires";

  console.log(`Destino: ${city}, ${state} (${zipcode})  ·  paquete 150g\n`);

  for (const metodo of METODOS) {
    const q = await quoteZipnova({
      cpDestino: zipcode,
      localidad: city,
      provincia: state,
      pesoGr: 150,
      metodo,
      valorDeclarado: 30000,
    });
    if (!q) {
      console.log(`  ${metodo.padEnd(10)} sin cotización (cae a la tabla de zonas)`);
      continue;
    }
    const eta = q.estimatedDelivery ? new Date(q.estimatedDelivery).toLocaleDateString("es-AR") : "s/d";
    console.log(`  ${metodo.padEnd(10)} $${q.cost.toLocaleString("es-AR")}  ·  ${q.carrier}  ·  llega ~${eta}`);
  }

  if (process.argv.includes("--raw")) await rawDump(zipcode, city, state);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
