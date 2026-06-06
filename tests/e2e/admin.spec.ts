import { test, expect } from "@playwright/test";

// Credenciales del admin (creadas con `pnpm admin:create`, ver SETUP.md).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// Pedido de muestra seedeado por `pnpm db:seed` en estado `paid`
// (el seed resetea su estado a `paid` en cada corrida, así el test es repetible).
const E2E_ORDER_NUMBER = "GLM-E2E001";

// Sufijo único por corrida para no colisionar slug de producto / código de cupón.
const RUN = Date.now().toString(36).slice(-5).toUpperCase();

test.describe("Panel admin — DoD M3", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Definí ADMIN_EMAIL y ADMIN_PASSWORD (corré `pnpm admin:create`).");

  test("login → crear producto con variante+stock → crear cupón → cambiar estado de pedido", async ({ page }) => {
    // 1) Login. El botón dice "Entrar" (login-form.tsx).
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/contraseña/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /entrar/i }).click();

    // Tras login válido se redirige a /admin (dashboard).
    await expect(page).toHaveURL(/\/admin(\/)?$/, { timeout: 15000 });

    // 2) Crear producto CON variante + stock (no la "Único" automática).
    await page.goto("/admin/productos/nuevo");
    const productName = `Producto E2E ${RUN}`;
    await page.getByLabel("Nombre", { exact: true }).fill(productName);

    // Categoría: es un Select de Radix (combobox + opciones en portal), no un <select> nativo.
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();

    await page.getByLabel("Precio (ARS)").fill("3500");
    await page.getByLabel("Costo (ARS)").fill("1000");
    await page.getByLabel("Peso en gramos").fill("20");

    // Las variantes no se muestran hasta tocar "Agregar variante".
    await page.getByRole("button", { name: /agregar variante/i }).click();
    await page.getByLabel(/nombre del tono/i).fill(`Tono ${RUN}`);
    await page.getByLabel("Stock", { exact: true }).fill("7");

    await page.getByRole("button", { name: /crear producto/i }).click();

    // Volvemos a la lista de productos y vemos el nuevo producto.
    await expect(page).toHaveURL(/\/admin\/productos\/?$/, { timeout: 15000 });
    await expect(page.getByText(productName)).toBeVisible({ timeout: 15000 });

    // 3) Crear cupón (tipo porcentaje, 10%).
    await page.goto("/admin/cupones/nuevo");
    const code = `E2E${RUN}`;
    await page.getByLabel(/código/i).fill(code);
    // "Tipo de descuento" es un <select> nativo; percentage es el default.
    await page.getByLabel(/tipo de descuento/i).selectOption("percentage");
    // Con type=percentage el campo de valor se etiqueta "Porcentaje (1 a 100)".
    await page.getByLabel("Porcentaje (1 a 100)").fill("10");

    await page.getByRole("button", { name: /crear cupón/i }).click();

    await expect(page).toHaveURL(/\/admin\/cupones\/?$/, { timeout: 15000 });
    await expect(page.getByText(code)).toBeVisible({ timeout: 15000 });

    // 4) Abrir el pedido seedeado y cambiarle el estado (paid → preparing).
    await page.goto("/admin/pedidos");
    await page.getByRole("link", { name: E2E_ORDER_NUMBER }).click();

    // Detalle del pedido visible (el título es un <h1> "Pedido GLM-E2E001").
    await expect(page.getByRole("heading", { name: new RegExp(E2E_ORDER_NUMBER, "i") })).toBeVisible({ timeout: 15000 });

    // El cambio de estado es un BOTÓN, no un select. Para un pedido `paid` el botón
    // disponible es "Pasar a preparando" (order-status-control.tsx).
    await page.getByRole("button", { name: /pasar a preparando/i }).click();

    // Tras el cambio, el badge de estado del pedido pasa a "Preparando".
    await expect(page.getByText("Preparando", { exact: true })).toBeVisible({ timeout: 15000 });
  });
});
