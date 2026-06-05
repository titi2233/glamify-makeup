import { test, expect } from "@playwright/test";

// Producto del seed (M1). Si cambia el seed, actualizar el slug.
const PRODUCT_SLUG = "labial-mate-larga-duracion";

test("agregar al carrito → drawer → carrito → checkout", async ({ page }) => {
  await page.goto(`/producto/${PRODUCT_SLUG}`);

  // Agregar al carrito (variante por defecto, qty 1).
  await page.getByRole("button", { name: /agregar al carrito/i }).click();

  // El drawer se abre y muestra el título del carrito.
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("dialog").getByText(/tu carrito/i).first()).toBeVisible();

  // Ir a /carrito y ver una línea + CTA.
  await page.goto("/carrito");
  await expect(page.getByRole("heading", { name: /tu carrito/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /iniciar compra/i })).toBeVisible();

  // Ir a /checkout y ver el form + botón de pago.
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: /finalizá tu compra/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /pagar con mercado pago/i })).toBeVisible();
});
