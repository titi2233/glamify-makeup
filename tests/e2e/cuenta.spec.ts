import { test, expect } from "@playwright/test";

const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL ?? "";
const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD ?? "";
const PRODUCT_SLUG = "labial-mate-larga-duracion"; // el pedido e2e (GLM-E2E001) compra este producto

test.describe("Cuenta de clienta (DoD M4)", () => {
  test("registro → pantalla de confirmación", async ({ page }) => {
    await page.goto("/ingresar");
    await page.getByRole("button", { name: /crear cuenta/i }).click();
    const unique = `nueva_${Date.now()}@example.com`;
    await page.getByLabel(/nombre/i).fill("Nueva Clienta");
    await page.getByLabel(/email/i).fill(unique);
    await page.getByLabel(/contraseña/i).fill("Password123!");
    await page.getByRole("button", { name: /crear cuenta/i }).click();
    await expect(page.getByText(/revisá tu correo/i)).toBeVisible({ timeout: 15000 });
  });

  test("login → favoritos → reseña sobre producto comprado", async ({ page }) => {
    test.skip(!CUSTOMER_EMAIL || !CUSTOMER_PASSWORD, "Falta CUSTOMER_EMAIL/PASSWORD seedeados");

    // Login
    await page.goto("/ingresar");
    await page.getByLabel(/email/i).fill(CUSTOMER_EMAIL);
    await page.getByLabel(/contraseña/i).fill(CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: /^ingresar$/i }).click();
    await expect(page).toHaveURL(/\/cuenta(\/)?$/, { timeout: 15000 });

    // Wishlist toggle
    await page.goto(`/producto/${PRODUCT_SLUG}`);
    const heart = page.getByRole("button", { name: /agregar a favoritos/i }).first();
    await heart.click();
    await expect(page.getByRole("button", { name: /quitar de favoritos/i }).first()).toBeVisible({ timeout: 10000 });
    await page.goto("/cuenta/favoritos");
    await expect(page.getByRole("link", { name: /labial mate/i }).first()).toBeVisible();

    // Reseña (compra verificada → auto-publicada)
    await page.goto(`/producto/${PRODUCT_SLUG}`);
    await page.getByRole("radio", { name: /5 estrellas/i }).click();
    await page.getByLabel(/tu experiencia/i).fill("Excelente labial, dura todo el día.");
    await page.getByRole("button", { name: /publicar reseña/i }).click();
    await expect(page.getByText(/excelente labial/i)).toBeVisible({ timeout: 15000 });
  });
});
