import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Páginas representativas de cada patrón de componente del storefront.
const pages = [
  "/",
  "/tienda",
  "/arrepentimiento",
  "/terminos",
  "/privacidad",
  "/contacto",
  "/preguntas-frecuentes",
  "/envios-y-pagos",
];

for (const path of pages) {
  test(`a11y: ${path} sin violaciones serias/críticas (WCAG 2 A/AA)`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
  });
}
