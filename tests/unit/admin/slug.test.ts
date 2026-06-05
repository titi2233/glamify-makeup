import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/admin/slug";

describe("slugify", () => {
  it("pasa a minúsculas y reemplaza espacios por guiones", () => {
    expect(slugify("Labial Mate")).toBe("labial-mate");
    expect(slugify("Sombra de Ojos")).toBe("sombra-de-ojos");
  });

  it("saca acentos y la ñ", () => {
    expect(slugify("Máscara de Pestañas")).toBe("mascara-de-pestanas");
    expect(slugify("Rubor Melocotón")).toBe("rubor-melocoton");
  });

  it("colapsa espacios/guiones repetidos y recorta extremos", () => {
    expect(slugify("  Labial   Rojo  ")).toBe("labial-rojo");
    expect(slugify("Glam --- Total")).toBe("glam-total");
    expect(slugify("---hola---")).toBe("hola");
  });

  it("elimina símbolos que no sean letra/número/guion", () => {
    expect(slugify("Set 3x1 (¡oferta!)")).toBe("set-3x1-oferta");
    expect(slugify("Kit #1 · Glow")).toBe("kit-1-glow");
  });

  it("devuelve cadena vacía si no queda nada útil", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});
