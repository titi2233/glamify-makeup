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

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoSeriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
}

for (const path of pages) {
  test(`a11y: ${path} sin violaciones serias/críticas (WCAG 2 A/AA)`, async ({ page }) => {
    await page.goto(path);
    await expectNoSeriousViolations(page);
  });
}

// Ficha de producto (monta el VariantSwatchSelector con role=radiogroup).
test("a11y: ficha de producto sin violaciones serias/críticas (WCAG 2 A/AA)", async ({ page }) => {
  await page.goto("/tienda");
  const href = await page.locator('a[href^="/producto/"]').first().getAttribute("href");
  test.skip(!href, "sin productos en el catálogo");
  await page.goto(href!);
  await expectNoSeriousViolations(page);
});
