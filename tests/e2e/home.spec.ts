import { test, expect } from "@playwright/test";

test("la home responde y muestra la marca", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Glamify",
  );
  await expect(page.getByRole("button", { name: "Ver tienda" })).toBeVisible();
});
