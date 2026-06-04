import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1024", width: 1024, height: 768 },
];

for (const vp of VIEWPORTS) {
  test.describe(`catálogo @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("home → tienda → ficha con datos reales", async ({ page }) => {
      // Home
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: "Ver tienda" })).toBeVisible();

      // Tienda
      await page.goto("/tienda");
      await expect(page.getByRole("heading", { name: "Tienda" })).toBeVisible();
      const firstProduct = page.locator('a[href^="/producto/"]').first();
      await expect(firstProduct).toBeVisible();

      // Ficha
      await firstProduct.click();
      await expect(page).toHaveURL(/\/producto\//);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // precio en ARS visible (formato "$ 1.234,00")
      await expect(page.getByText(/\$\s?[\d.]+/).first()).toBeVisible();
    });

    test("navegación por categoría con breadcrumbs", async ({ page }) => {
      await page.goto("/tienda/labios");
      await expect(page.getByRole("navigation", { name: "breadcrumb" })).toBeVisible();
      await expect(page.locator('a[href^="/producto/"]').first()).toBeVisible();
    });
  });
}
