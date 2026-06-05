import { test, expect } from "@playwright/test";

// Credenciales del admin (creadas con `pnpm admin:create`, ver SETUP.md).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// Pedido de muestra seedeado por `pnpm db:seed` (estado `paid`).
const E2E_ORDER_NUMBER = "GLM-E2E001";

// Sufijo único por corrida para no colisionar slug de producto / código de cupón.
const RUN = Date.now().toString(36).slice(-5).toUpperCase();

test.describe("Panel admin — DoD M3", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Definí ADMIN_EMAIL y ADMIN_PASSWORD (corré `pnpm admin:create`).");

  test("login → crear producto con variante+stock → crear cupón → cambiar estado de pedido", async ({ page }) => {
    // 1) Login.
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/contraseña/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /ingresar/i }).click();

    // Tras login válido se redirige a /admin (dashboard).
    await expect(page).toHaveURL(/\/admin(\/)?$/, { timeout: 15000 });

    // 2) Crear producto con variante + stock.
    await page.goto("/admin/productos/nuevo");
    await page.getByLabel(/nombre/i).first().fill(`Producto E2E ${RUN}`);
    // Categoría: primera opción real del select.
    await page.getByLabel(/categoría/i).selectOption({ index: 1 });
    await page.getByLabel(/precio/i).first().fill("3500");
    // Variante (al menos stock; si no se nombra, el server crea "Único").
    await page.getByLabel(/stock/i).first().fill("7");

    await page.getByRole("button", { name: /guardar|crear/i }).click();

    // Volvemos a la lista de productos y vemos el nuevo producto.
    await expect(page).toHaveURL(/\/admin\/productos/, { timeout: 15000 });
    await expect(page.getByText(`Producto E2E ${RUN}`)).toBeVisible({ timeout: 15000 });

    // 3) Crear cupón.
    await page.goto("/admin/cupones/nuevo");
    const code = `E2E${RUN}`;
    await page.getByLabel(/código/i).fill(code);
    // Tipo porcentaje + valor 10.
    await page.getByLabel(/tipo/i).selectOption("percentage");
    await page.getByLabel(/valor/i).fill("10");

    await page.getByRole("button", { name: /guardar|crear/i }).click();

    await expect(page).toHaveURL(/\/admin\/cupones/, { timeout: 15000 });
    await expect(page.getByText(code)).toBeVisible({ timeout: 15000 });

    // 4) Abrir el pedido seedeado y cambiarle el estado (paid → preparing).
    await page.goto("/admin/pedidos");
    await page.getByRole("link", { name: new RegExp(E2E_ORDER_NUMBER, "i") }).click();

    // Detalle del pedido visible.
    await expect(page.getByRole("heading", { name: new RegExp(E2E_ORDER_NUMBER, "i") })).toBeVisible({ timeout: 15000 });

    // Cambiar estado a "preparing" (a preparar) y confirmar.
    await page.getByLabel(/estado del pedido|cambiar estado/i).selectOption("preparing");
    await page.getByRole("button", { name: /guardar|cambiar|actualizar/i }).click();

    // El estado nuevo se refleja en la página.
    await expect(page.getByText(/preparando|a despachar|preparing/i).first()).toBeVisible({ timeout: 15000 });
  });
});
