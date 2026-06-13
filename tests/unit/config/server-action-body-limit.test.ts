import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// El uploader de imágenes (src/lib/admin/products/images.ts, MAX_BYTES) permite
// archivos de hasta 5 MB. El límite de body de los Server Actions de Next por
// defecto es 1 MB: subir una foto >1 MB tira una excepción full-page ANTES de
// entrar al handler (no la atrapa el try/catch de la action). El config debe
// permitir al menos ese tamaño, con algo de margen para el sobre multipart.
const IMAGE_MAX_MB = 5;

function parseSizeToMb(s: string): number {
  const mb = /([\d.]+)\s*mb/i.exec(s);
  if (mb) return Number(mb[1]);
  const kb = /([\d.]+)\s*kb/i.exec(s);
  if (kb) return Number(kb[1]) / 1024;
  const bytes = /^(\d+)$/.exec(s.trim());
  if (bytes) return Number(bytes[1]) / (1024 * 1024);
  throw new Error(`No pude parsear el tamaño: "${s}"`);
}

describe("next.config serverActions.bodySizeLimit", () => {
  const src = readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");

  it("define un bodySizeLimit explícito (el default de 1 MB rompe el upload)", () => {
    expect(src).toMatch(/bodySizeLimit/);
  });

  it("permite al menos el tamaño máximo de imagen (5 MB)", () => {
    const m = /bodySizeLimit:\s*["'`]([^"'`]+)["'`]/.exec(src);
    expect(m, "falta serverActions.bodySizeLimit en next.config.mjs").not.toBeNull();
    expect(parseSizeToMb(m![1])).toBeGreaterThanOrEqual(IMAGE_MAX_MB);
  });
});
