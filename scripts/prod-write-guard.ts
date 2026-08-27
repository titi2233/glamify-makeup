import { createInterface } from "node:readline/promises";

/**
 * Confirmación interactiva obligatoria antes de que un script local mute datos.
 *
 * Dev y producción comparten la MISMA base (mismo DATABASE_URL en .env/.env.local
 * que en wrangler.jsonc de prod) — no hay forma de distinguirlas por URL ni por
 * NODE_ENV. Esta es la barrera real: mostrar contra qué host se va a escribir y
 * obligar a una persona a leerlo y confirmarlo a mano, tipeando el host exacto.
 *
 * Ninguno de los scripts que llaman a esto corre en CI ni en ningún flujo
 * automático (ver .github/workflows/ci.yml) — negarse sin TTY es seguro, nunca
 * cuelga un pipeline real.
 */
export async function confirmProdWrite(action: string): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/?]+)/)?.[1] ?? "(DATABASE_URL no seteada)";

  if (!process.stdin.isTTY) {
    throw new Error(
      `Bloqueado: "${action}" necesita confirmación interactiva y no hay TTY. Corré este script a mano en una terminal.`,
    );
  }

  console.log(`\n⚠️  Vas a ${action} contra: ${host}`);
  console.log(`   Dev y prod comparten esta base — si es la real, lo que crees o borres queda ahí de verdad.\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let answer: string;
  try {
    answer = await rl.question(`Escribí "${host}" para confirmar (cualquier otra cosa cancela): `);
  } finally {
    rl.close();
  }

  if (answer.trim() !== host) {
    throw new Error("Cancelado: la confirmación no coincidió con el host.");
  }
}
