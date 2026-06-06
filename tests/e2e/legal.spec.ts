import { test, expect } from "@playwright/test";

test("el footer linkea el botón de arrepentimiento y carga la página", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: /arrepentimiento/i }).click();
  await expect(page).toHaveURL(/\/arrepentimiento$/);
  await expect(page.getByRole("heading", { level: 1, name: /arrepentimiento/i })).toBeVisible();
});

test("el formulario de arrepentimiento devuelve una constancia", async ({ page }) => {
  await page.goto("/arrepentimiento");
  await page.getByLabel("Nombre y apellido").fill("Test QA");
  await page.getByLabel("Email").fill("qa@glamify.test");
  await page.getByRole("button", { name: /enviar solicitud/i }).click();
  await expect(page.getByText(/recibimos tu solicitud/i)).toBeVisible();
  await expect(page.getByText(/ARR-\d{6}/)).toBeVisible();
});

test("las páginas legales y de contenido responden 200", async ({ page }) => {
  for (const p of [
    "/terminos",
    "/privacidad",
    "/contacto",
    "/nosotras",
    "/preguntas-frecuentes",
    "/envios-y-pagos",
  ]) {
    const res = await page.goto(p);
    expect(res?.status(), `GET ${p}`).toBe(200);
  }
});
