import { test, expect } from "@playwright/test";

test("la home responde y muestra la marca", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Glam");
  await expect(page.getByRole("link", { name: "Ver tienda" })).toBeVisible();
  await expect(page.getByRole("banner").getByText("Glamify")).toBeVisible();
});
