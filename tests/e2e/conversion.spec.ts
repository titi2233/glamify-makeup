import { test, expect } from "@playwright/test";

// Producto sin reseñas aprobadas seedeadas: sirve para verificar que la reseña de invitada
// queda pendiente (no se publica) hasta que la dueña la apruebe.
const GUEST_REVIEW_SLUG = "primer-facial-poro-cero";
// Producto cualquiera para llenar el carrito y disparar el order-bump.
const CART_SLUG = "labial-mate-larga-duracion";

async function dismissConsent(page: import("@playwright/test").Page) {
  const accept = page.getByRole("button", { name: /aceptar/i });
  if (await accept.isVisible().catch(() => false)) await accept.click();
}

test.describe("Conversión + crecimiento (M4b)", () => {
  test("banner de consentimiento: presente y se cierra al rechazar", async ({ page }) => {
    await page.goto("/");
    const reject = page.getByRole("button", { name: /rechazar/i });
    await expect(reject).toBeVisible({ timeout: 10000 });
    await reject.click();
    await expect(reject).toBeHidden();
  });

  test("reseña de invitada queda pendiente (no se publica)", async ({ page }) => {
    await page.goto(`/producto/${GUEST_REVIEW_SLUG}`);
    await dismissConsent(page);

    const unique = `Reseña invitada ${Date.now()}`;
    await page.getByLabel(/tu nombre/i).fill("Visitante Test");
    await page.getByRole("radio", { name: /5 estrellas/i }).click();
    await page.getByLabel(/tu experiencia/i).fill(unique);
    await page.getByRole("button", { name: /publicar reseña/i }).click();

    // Mensaje de moderación + la reseña NO aparece en la lista pública (sigue pending).
    await expect(page.getByText(/se publicará tras la revisión/i)).toBeVisible({ timeout: 15000 });
    await page.reload();
    await dismissConsent(page);
    await expect(page.getByText(unique)).toHaveCount(0);
  });

  test("order-bump visible en el carrito", async ({ page }) => {
    await page.goto(`/producto/${CART_SLUG}`);
    await dismissConsent(page);
    await page.getByRole("button", { name: /agregar al carrito/i }).click();

    await page.goto("/carrito");
    await dismissConsent(page);
    // El order-bump ofrece un accesorio barato ("Sumá ... a $...").
    await expect(page.getByText(/sumá/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /^agregar$/i }).first()).toBeVisible();
  });
});
